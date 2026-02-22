import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Clock, Cpu, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function formatModelVersion(v: string | null | undefined): string {
  if (!v) return 'PREHAB Engine';
  if (v.includes('cloudrun')) return 'PREHAB AI · Cloud';
  if (v.includes('xgboost') || v.includes('gradient')) return 'PREHAB AI · ML';
  if (v.includes('rules')) return 'PREHAB · Rules Engine';
  return 'PREHAB Engine';
}

function formatPredictorType(t: string): string {
  const map: Record<string, string> = {
    xgboost: 'Gradient Boosting',
    gradient_boost: 'Gradient Boosting',
    logistic: 'Logistic Regression',
    rules: 'Rules Engine',
    ml: 'ML Model',
  };
  return map[t.toLowerCase()] ?? 'ML Model';
}

function formatTriggerType(t: string): string {
  const map: Record<string, string> = {
    manual: 'Manual trigger',
    scheduled: 'Scheduled',
    cron: 'Scheduled',
    webhook: 'Webhook',
  };
  return map[t.toLowerCase()] ?? t;
}

interface AgentRun {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  athletes_processed: number;
  model_version: string | null;
  trigger_type: string;
}

interface Props {
  athleteId?: string;
}

export default function AgentStatus({ athleteId }: Props) {
  const [lastRun, setLastRun] = useState<AgentRun | null>(null);
  const [prediction, setPrediction] = useState<{
    risk_prob: number;
    predictor_type: string;
    model_version: string | null;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      // Get latest agent run
      const { data: run } = await supabase
        .from('agent_runs')
        .select('id, status, started_at, completed_at, athletes_processed, model_version, trigger_type')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (run) setLastRun(run as AgentRun);

      // Get latest prediction for athlete
      if (athleteId) {
        const { data: pred } = await supabase
          .from('risk_predictions')
          .select('risk_prob, predictor_type, model_version')
          .eq('athlete_id', athleteId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pred) setPrediction(pred as any);
      }
    };
    load();
  }, [athleteId]);

  if (!lastRun) return null;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Agent Status</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Last Run</p>
            <p className="font-medium">
              {lastRun.completed_at
                ? formatDistanceToNow(new Date(lastRun.completed_at), { addSuffix: true })
                : lastRun.status === 'running' ? 'Running...' : 'N/A'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Model</p>
            <p className="font-medium">{formatModelVersion(prediction?.model_version || lastRun.model_version)}</p>
          </div>
        </div>
        {prediction && (
          <>
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Risk Probability</p>
                <p className="font-medium">{(prediction.risk_prob * 100).toFixed(0)}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Predictor</p>
                <p className="font-medium">{formatPredictorType(prediction.predictor_type)}</p>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`inline-block w-2 h-2 rounded-full ${
          lastRun.status === 'completed' ? 'bg-primary' : 
          lastRun.status === 'running' ? 'bg-warning animate-pulse' : 'bg-destructive'
        }`} />
        <span className="capitalize">{lastRun.status.replace(/_/g, ' ')}</span>
        <span>•</span>
        <span>{lastRun.athletes_processed} athletes processed</span>
        <span>•</span>
        <span>{formatTriggerType(lastRun.trigger_type)}</span>
      </div>
    </div>
  );
}
