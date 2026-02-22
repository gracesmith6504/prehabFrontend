import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Target, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

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
  deadline: string;
}

const METRIC_LABELS: Record<string, string> = {
  risk_score: 'Injury Risk',
  acr: 'Training Load Ratio',
  weekly_load: 'Weekly Volume',
};

const DIRECTION_ICONS: Record<string, typeof TrendingDown> = {
  decrease: TrendingDown,
  increase: TrendingUp,
  maintain_range: ArrowLeftRight,
};

export default function GoalTracker({ athleteId }: { athleteId: string }) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!athleteId) return;
    supabase
      .from('athlete_goals')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setGoal((data as unknown as Goal[])?.[0] || null);
        setLoading(false);
      });
  }, [athleteId]);

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="h-12 bg-secondary animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!goal) return null;

  const DirIcon = DIRECTION_ICONS[goal.direction] || TrendingDown;
  const metricLabel = METRIC_LABELS[goal.metric_type] || goal.metric_type;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000));

  const targetLabel = goal.direction === 'maintain_range'
    ? `${goal.target_range_min ?? '?'}–${goal.target_range_max ?? '?'}`
    : String(goal.target_value);

  const verb = goal.direction === 'maintain_range' ? 'Maintain' : goal.direction === 'decrease' ? 'Reduce' : 'Increase';

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">
            {verb} {metricLabel} to {targetLabel}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{daysLeft}d left</span>
      </div>
      <Progress value={goal.progress_pct} className="h-1.5" />
      <p className="text-xs text-muted-foreground mt-1.5">{goal.progress_pct}% complete</p>
    </div>
  );
}
