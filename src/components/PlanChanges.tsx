import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { type PlanSession } from '@/lib/riskEngine';
import { Sparkles } from 'lucide-react';

interface Props {
  athleteId: string;
}

export default function PlanChanges({ athleteId }: Props) {
  const [changes, setChanges] = useState<string[]>([]);

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
      const diffs: string[] = [];

      adjusted.forEach(adj => {
        const orig = original.find(o => o.day === adj.day);
        if (!orig) return;
        if (orig.intensity !== adj.intensity) {
          diffs.push(`${adj.day}: intensity → ${adj.intensity}`);
        }
        if (orig.duration !== adj.duration) {
          diffs.push(`${adj.day}: duration → ${adj.duration} min`);
        }
        if (orig.type !== adj.type) {
          diffs.push(`${adj.day}: changed to ${adj.type}`);
        }
      });

      setChanges(diffs);
    };
    load();
  }, [athleteId]);

  if (!changes.length) return null;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Plan Changes</h3>
      </div>
      <ul className="space-y-1.5">
        {changes.map((c, i) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
