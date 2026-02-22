import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PlanSession } from '@/lib/riskEngine';
import { Sparkles, ArrowRight, Clock, Zap, RefreshCw } from 'lucide-react';

interface Props {
  athleteId: string;
}

interface PlanDiff {
  day: string;
  changeType: 'type' | 'intensity' | 'duration' | 'multiple';
  original: PlanSession;
  adjusted: PlanSession;
  notes?: string;
}

function intensityIcon(intensity: string) {
  if (intensity === 'High') return '🔴';
  if (intensity === 'Medium') return '🟡';
  return '🟢';
}

function friendlyChangeLabel(diff: PlanDiff): string {
  const changes: string[] = [];
  if (diff.original.type !== diff.adjusted.type) {
    changes.push(`swapped to ${diff.adjusted.type}`);
  }
  if (diff.original.intensity !== diff.adjusted.intensity) {
    changes.push(`intensity ${diff.original.intensity.toLowerCase()} → ${diff.adjusted.intensity.toLowerCase()}`);
  }
  if (diff.original.duration !== diff.adjusted.duration) {
    const delta = diff.adjusted.duration - diff.original.duration;
    changes.push(`${delta > 0 ? '+' : ''}${delta} min`);
  }
  return changes.join(', ');
}

function changeIcon(diff: PlanDiff) {
  if (diff.original.type !== diff.adjusted.type) return <RefreshCw className="h-3.5 w-3.5" />;
  if (diff.original.intensity !== diff.adjusted.intensity) return <Zap className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

export default function PlanChanges({ athleteId }: Props) {
  const [diffs, setDiffs] = useState<PlanDiff[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('weekly_plans')
        .select('original_plan, adjusted_plan')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;

      const original = (data.original_plan as unknown as PlanSession[]) || [];
      const adjusted = (data.adjusted_plan as unknown as PlanSession[]) || [];
      const results: PlanDiff[] = [];

      adjusted.forEach(adj => {
        const orig = original.find(o => o.day === adj.day);
        if (!orig) return;
        const typeChanged = orig.type !== adj.type;
        const intensityChanged = orig.intensity !== adj.intensity;
        const durationChanged = orig.duration !== adj.duration;
        if (!typeChanged && !intensityChanged && !durationChanged) return;

        const changeCount = [typeChanged, intensityChanged, durationChanged].filter(Boolean).length;
        results.push({
          day: adj.day,
          changeType: changeCount > 1 ? 'multiple' : typeChanged ? 'type' : intensityChanged ? 'intensity' : 'duration',
          original: orig,
          adjusted: adj,
          notes: adj.notes,
        });
      });

      setDiffs(results);
    };
    load();
  }, [athleteId]);

  if (!diffs.length) return null;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Plan Adjustments</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
          {diffs.length} {diffs.length === 1 ? 'change' : 'changes'}
        </span>
      </div>

      <div className="space-y-2.5">
        {diffs.map((diff, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-card/50 p-3 transition-colors hover:bg-card"
          >
            {/* Day badge */}
            <div className="shrink-0 w-10 text-center">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">{diff.day.slice(0, 3)}</p>
              <div className="mt-0.5 text-primary">{changeIcon(diff)}</div>
            </div>

            {/* Change details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm flex-wrap">
                <span className="font-medium text-muted-foreground line-through decoration-muted-foreground/40">
                  {diff.original.type} {intensityIcon(diff.original.intensity)} {diff.original.duration}m
                </span>
                <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                <span className="font-semibold">
                  {diff.adjusted.type} {intensityIcon(diff.adjusted.intensity)} {diff.adjusted.duration}m
                </span>
              </div>
              {diff.notes && (
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{diff.notes}</p>
              )}
              {!diff.notes && (
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">{friendlyChangeLabel(diff)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
