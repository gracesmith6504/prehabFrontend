import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingDown, TrendingUp, ArrowLeftRight, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Goal {
  id: string;
  metric_type: string;
  direction: string;
  target_value: number;
  target_range_min: number | null;
  target_range_max: number | null;
  baseline_value: number;
  current_value: number | null;
  progress_pct: number;
  status: string;
  reason: string | null;
  created_by_type: string;
  deadline: string;
  achieved_at: string | null;
  created_at: string;
}

const METRIC_LABELS: Record<string, string> = {
  risk_score: 'Risk Score',
  acr: 'Training Load Ratio',
  weekly_load: 'Weekly Training Volume',
};

const DIRECTION_ICONS: Record<string, typeof TrendingDown> = {
  decrease: TrendingDown,
  increase: TrendingUp,
  maintain_range: ArrowLeftRight,
};

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  active: { color: 'bg-primary/10 text-primary border-primary/20', icon: Clock, label: 'Active' },
  achieved: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2, label: 'Achieved' },
  failed: { color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle, label: 'Failed' },
  cancelled: { color: 'bg-muted text-muted-foreground border-border', icon: XCircle, label: 'Cancelled' },
};

export default function GoalTracker({ athleteId }: { athleteId: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) return;
    supabase
      .from('athlete_goals')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setGoals((data as unknown as Goal[]) || []);
        setLoading(false);
      });
  }, [athleteId]);

  if (loading) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm uppercase">Goals</h3>
        </div>
        <div className="h-20 bg-secondary animate-pulse rounded-lg" />
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm uppercase">Goals</h3>
        </div>
        <p className="text-sm text-muted-foreground">No goals yet. The AI agent will auto-create goals after enough training data is collected.</p>
      </div>
    );
  }

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status !== 'active');

  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase">Goals</h3>
        {activeGoals.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-auto">{activeGoals.length} active</Badge>
        )}
      </div>

      <div className="space-y-3">
        {activeGoals.map(goal => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        {completedGoals.length > 0 && activeGoals.length > 0 && (
          <div className="border-t border-border pt-2 mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Completed</p>
          </div>
        )}
        {completedGoals.slice(0, 3).map(goal => (
          <GoalCard key={goal.id} goal={goal} compact />
        ))}
      </div>
    </div>
  );
}

function GoalCard({ goal, compact = false }: { goal: Goal; compact?: boolean }) {
  const DirIcon = DIRECTION_ICONS[goal.direction] || TrendingDown;
  const statusConfig = STATUS_CONFIG[goal.status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000));

  const targetLabel = goal.direction === 'maintain_range'
    ? `${goal.target_range_min}–${goal.target_range_max}`
    : `${goal.target_value}`;

  return (
    <div className={`rounded-lg border p-3 ${compact ? 'opacity-70' : ''} ${statusConfig.color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <DirIcon className="h-4 w-4 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {goal.direction === 'maintain_range' ? 'Maintain' : goal.direction === 'decrease' ? 'Reduce' : 'Increase'}{' '}
              {METRIC_LABELS[goal.metric_type] || goal.metric_type} → {targetLabel}
            </p>
            {!compact && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {goal.created_by_type === 'agent' ? '🤖 AI-generated' : '👤 Coach-set'} · 
                {goal.status === 'active' ? ` ${daysLeft}d left` : ` ${statusConfig.label}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">{goal.progress_pct}%</span>
        </div>
      </div>

      {!compact && (
        <div className="mt-2.5">
          <Progress value={goal.progress_pct} className="h-1.5" />
          <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
            <span>Baseline: {Number(goal.baseline_value).toFixed(1)}</span>
            <span>Current: {goal.current_value !== null ? Number(goal.current_value).toFixed(1) : '—'}</span>
            <span>Target: {targetLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
