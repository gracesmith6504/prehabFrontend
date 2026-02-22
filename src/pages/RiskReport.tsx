import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import SimplifiedDrivers from '@/components/SimplifiedDrivers';
import PlanChanges from '@/components/PlanChanges';
import { getCurrentPhase, type MenstrualPhase } from '@/lib/riskEngine';
import { formatTriggerReason } from '@/lib/utils';
import EvidencePanel from '@/components/EvidencePanel';
import { ShieldCheck, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface EscalationInfo {
  id: string;
  status: string;
  trigger_reason: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

interface PredictionInfo {
  id: string;
  risk_prob: number;
  risk_score: number;
  risk_level: string;
  top_drivers: any;
  agent_run_id: string | null;
}

function buildPlainSummary(
  phase: MenstrualPhase,
  riskLevel: string,
  explanation: string | null,
): string {
  if (explanation) return explanation;

  const parts: string[] = [];
  if (riskLevel === 'Low') {
    parts.push("You're in a good place right now.");
  } else if (riskLevel === 'Medium') {
    parts.push("There are a few things to keep an eye on.");
  } else {
    parts.push("Your body may need extra care right now.");
  }

  if (phase === 'luteal' || phase === 'menstruation') {
    parts.push(`You're in your ${phase} phase, which can affect recovery.`);
  } else if (phase !== 'unknown') {
    parts.push(`Your current cycle phase (${phase}) is generally supportive of training.`);
  }

  return parts.join(' ');
}

export default function RiskReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [escalation, setEscalation] = useState<EscalationInfo | null>(null);
  const [prediction, setPrediction] = useState<PredictionInfo | null>(null);
  const [lastEvalTime, setLastEvalTime] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Fetch all data in parallel
      const [apRes, predRes, prevPredRes, escRes, reportRes] = await Promise.all([
        supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('risk_predictions').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('risk_predictions').select('risk_score').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(2),
        supabase.from('escalations').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('risk_reports').select('explanation').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      // Risk prediction (source of truth)
      if (predRes.data) {
        const pred = predRes.data as unknown as PredictionInfo;
        setPrediction(pred);
        setRiskScore(Number(pred.risk_score));
        setRiskLevel(pred.risk_level);
        setLastEvalTime(predRes.data.created_at);
      }

      // Previous prediction for delta
      if (prevPredRes.data && prevPredRes.data.length > 1) {
        setPreviousScore(Number(prevPredRes.data[1].risk_score));
      }

      // ML explanation from risk_reports
      if (reportRes.data?.explanation) {
        setExplanation(reportRes.data.explanation);
      }

      if (escRes.data) setEscalation(escRes.data as unknown as EscalationInfo);

      // Phase (still derived from profile for display)
      const ap = apRes.data;
      const currentPhase = ap?.cycle_start_date
        ? getCurrentPhase(ap.cycle_start_date, ap.cycle_length || 28, ap.menstruation_length || 5)
        : 'unknown' as MenstrualPhase;
      setPhase(currentPhase);

      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  const summary = buildPlainSummary(phase, riskLevel, explanation);
  const delta = previousScore !== null ? riskScore - previousScore : null;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            Your Risk Report
          </h1>
          {lastEvalTime && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated {formatDistanceToNow(new Date(lastEvalTime), { addSuffix: true })}
            </p>
          )}
        </div>

        {/* Risk Score Hero */}
        <motion.div
          className="glass-card p-5 sm:p-8 flex flex-col items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <RiskGauge score={riskScore} />
          <div className="mt-4"><RiskBadge level={riskLevel} /></div>
          <p className="text-lg font-heading font-bold mt-3">{riskScore} / 100</p>

          {delta !== null && delta !== 0 && (
            <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${
              delta > 0 ? 'text-destructive' : 'text-primary'
            }`}>
              {delta > 0 ? (
                <><TrendingUp className="h-4 w-4" /> ↑ {delta} from last evaluation</>
              ) : (
                <><TrendingDown className="h-4 w-4" /> ↓ {Math.abs(delta)} from last evaluation</>
              )}
            </div>
          )}
          {delta === 0 && previousScore !== null && (
            <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <Minus className="h-4 w-4" /> No change from last evaluation
            </div>
          )}
        </motion.div>

        {/* Plain-Language Summary (from ML explanation) */}
        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm leading-relaxed">{summary}</p>
        </motion.div>

        {/* Simplified Drivers (from ML top_drivers) */}
        {user && <SimplifiedDrivers athleteId={user.id} drivers={prediction?.top_drivers} />}

        {/* Scientific evidence base */}
        <EvidencePanel />

        {/* Plan Changes */}
        {user && <PlanChanges athleteId={user.id} />}

        {/* View Plan Changes button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate('/plan')}
        >
          View Plan Changes <ArrowRight className="h-4 w-4" />
        </Button>

        {/* Escalation (simplified) */}
        {escalation && escalation.status !== 'resolved' && (
          <div className="glass-card p-5 border-destructive/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="font-bold text-sm text-destructive">Your coach has been notified</p>
            </div>
            <p className="text-sm text-muted-foreground">{formatTriggerReason(escalation.trigger_reason)}</p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(escalation.created_at), { addSuffix: true })}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
