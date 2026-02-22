import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brain, ThumbsUp, ThumbsDown, Pencil, ShieldAlert, Zap, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface AgentState {
  policy_mode: string;
  autonomy_override: string | null;
  autonomy_override_until: string | null;
  adjustment_intensity_multiplier: number;
  escalation_threshold_override: string | null;
  updated_at: string;
}

interface FeedbackSummary {
  accepted: number;
  rejected: number;
  modified: number;
}

interface Props {
  athleteId: string;
  lastUpdated?: string | null;
  planAdjusted?: boolean;
}

const POLICY_INFO = {
  normal: {
    label: 'Full Autonomy',
    color: 'text-primary',
    bg: 'bg-primary/10',
    desc: 'Agent auto-adjusts your plan based on risk',
  },
  dampened: {
    label: 'Dampened',
    color: 'text-warning',
    bg: 'bg-warning/10',
    desc: 'Adjustments reduced to 50% — agent recalibrating',
  },
  suggest_only: {
    label: 'Suggest Only',
    color: 'text-muted-foreground',
    bg: 'bg-secondary',
    desc: 'Agent suggests changes, no auto-apply',
  },
} as const;

export default function AgentAdaptabilityCard({ athleteId, lastUpdated, planAdjusted }: Props) {
  const [state, setState] = useState<AgentState | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary>({ accepted: 0, rejected: 0, modified: 0 });

  useEffect(() => {
    const load = async () => {
      const { data: agentState } = await supabase
        .from('athlete_agent_state')
        .select(
          'policy_mode, autonomy_override, autonomy_override_until, adjustment_intensity_multiplier, escalation_threshold_override, updated_at'
        )
        .eq('athlete_id', athleteId)
        .maybeSingle();

      if (agentState) setState(agentState as AgentState);

      const since = new Date(Date.now() - 14 * 86400000).toISOString();
      const { data: events } = await supabase
        .from('feedback_events')
        .select('feedback_type')
        .eq('athlete_id', athleteId)
        .gte('created_at', since);

      if (events) {
        const summary = { accepted: 0, rejected: 0, modified: 0 };
        events.forEach(e => {
          if (e.feedback_type === 'accepted') summary.accepted++;
          else if (e.feedback_type === 'rejected') summary.rejected++;
          else if (e.feedback_type === 'modified') summary.modified++;
        });
        setFeedback(summary);
      }
    };
    load();
  }, [athleteId]);

  const mode = (state?.policy_mode ?? 'normal') as keyof typeof POLICY_INFO;
  const info = POLICY_INFO[mode] ?? POLICY_INFO.normal;
  const isAdapted = mode !== 'normal' || !!state?.autonomy_override;
  const totalFeedback = feedback.accepted + feedback.rejected + feedback.modified;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Smart Adjustments</h3>
        {isAdapted && (
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
            Adapted
          </span>
        )}
      </div>

      {/* Current policy mode */}
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${info.bg}`}>
        <Zap className={`h-4 w-4 ${info.color} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm ${info.color}`}>{info.label}</p>
          <p className="text-xs text-muted-foreground">{info.desc}</p>
        </div>
        {state && mode !== 'normal' && (
          <p className="text-xs text-muted-foreground shrink-0">
            ×{state.adjustment_intensity_multiplier.toFixed(1)}
          </p>
        )}
      </div>

      {/* Override expiry */}
      {state?.autonomy_override_until && (
        <p className="text-xs text-muted-foreground">
          Reverts to full autonomy{' '}
          {formatDistanceToNow(parseISO(state.autonomy_override_until), { addSuffix: true })}
        </p>
      )}

      {/* Escalation threshold note */}
      {state?.escalation_threshold_override === 'high_only' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-warning flex-shrink-0" />
          Only escalating critical risk (false alarm threshold raised)
        </div>
      )}

      {/* Feedback tally */}
      {totalFeedback > 0 && (
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground flex-1">Your feedback (14 days)</p>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-primary font-medium">
              <ThumbsUp className="h-3 w-3" /> {feedback.accepted}
            </span>
            <span className="flex items-center gap-1 text-destructive font-medium">
              <ThumbsDown className="h-3 w-3" /> {feedback.rejected}
            </span>
            {feedback.modified > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground font-medium">
                <Pencil className="h-3 w-3" /> {feedback.modified}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Last update + plan adjusted */}
      {lastUpdated && (
        <div className="flex items-center justify-between pt-1 border-t border-border text-xs text-muted-foreground">
          <span>Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}</span>
          {planAdjusted && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Plan adjusted
            </span>
          )}
        </div>
      )}
    </div>
  );
}
