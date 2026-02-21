import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import SimplifiedDrivers from '@/components/SimplifiedDrivers';
import PlanChanges from '@/components/PlanChanges';
import {
  getCurrentPhase, calculateAcuteChronicRatio, calculateSorenessContribution,
  calculateRiskScore, type MenstrualPhase,
} from '@/lib/riskEngine';
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
  acRatio: number,
  sorenessContrib: number,
): string {
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

  if (acRatio > 1.3) {
    parts.push("Your recent training load has increased quite a bit — consider easing off slightly.");
  } else if (acRatio < 0.8) {
    parts.push("Your training load has been lighter than usual recently.");
  }

  if (sorenessContrib > 50) {
    parts.push("You've reported elevated soreness — listen to your body and prioritise recovery.");
  } else if (sorenessContrib > 25) {
    parts.push("Mild soreness noted — nothing unusual, but worth monitoring.");
  }

  return parts.join(' ');
}

function buildInfluenceExplanation(
  phase: MenstrualPhase,
  acRatio: number,
  sorenessContrib: number,
): string[] {
  const items: string[] = [];

  // Phase
  if (phase === 'luteal') {
    items.push("Your luteal phase can increase fatigue and reduce recovery speed.");
  } else if (phase === 'menstruation') {
    items.push("During menstruation, energy levels and recovery may dip — this is completely normal.");
  } else if (phase === 'ovulatory') {
    items.push("You're in your ovulatory phase — energy is typically higher, which supports training.");
  } else if (phase === 'follicular') {
    items.push("The follicular phase is generally a great time for higher-intensity work.");
  }

  // Load
  if (acRatio > 1.5) {
    items.push("Your recent training load has spiked compared to your longer-term average. A sudden increase raises injury risk.");
  } else if (acRatio > 1.2) {
    items.push("Training load is creeping up — not alarming, but worth being mindful of.");
  } else if (acRatio < 0.8) {
    items.push("Training has been lighter than usual. A sudden return to high loads could increase risk.");
  } else {
    items.push("Your training load is well-balanced relative to your recent history.");
  }

  // Soreness
  if (sorenessContrib > 50) {
    items.push("Soreness is significantly elevated. Extra rest or lighter sessions could help your body recover.");
  } else if (sorenessContrib > 25) {
    items.push("You've noted some mild soreness — keep stretching and warming up properly.");
  } else {
    items.push("Soreness levels look manageable — your body seems to be recovering well.");
  }

  return items;
}

export default function RiskReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [acRatio, setAcRatio] = useState(0);
  const [sorenessContrib, setSorenessContrib] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [escalation, setEscalation] = useState<EscalationInfo | null>(null);
  const [prediction, setPrediction] = useState<PredictionInfo | null>(null);
  const [lastEvalTime, setLastEvalTime] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const compute = async () => {
      const [apRes, predRes, escRes] = await Promise.all([
        supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('risk_predictions').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('escalations').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (predRes.data) {
        setPrediction(predRes.data as unknown as PredictionInfo);
        setLastEvalTime(predRes.data.created_at);
      }
      if (escRes.data) setEscalation(escRes.data as unknown as EscalationInfo);

      const ap = apRes.data;
      const currentPhase = ap?.cycle_start_date
        ? getCurrentPhase(ap.cycle_start_date, ap.cycle_length || 28, ap.menstruation_length || 5)
        : 'unknown' as MenstrualPhase;
      setPhase(currentPhase);

      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: sessions } = await supabase.from('training_sessions').select('date, duration, rpe, intensity').eq('athlete_id', user.id).gte('date', since);
      const ratio = calculateAcuteChronicRatio(sessions || []);
      setAcRatio(ratio);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: soreness } = await supabase.from('soreness_logs').select('knee, hamstring, groin, calf, other_value').eq('athlete_id', user.id).gte('date', threeDaysAgo).order('date', { ascending: false });
      const sc = calculateSorenessContribution(soreness || []);
      setSorenessContrib(sc);

      if (predRes.data) {
        setRiskScore(Number(predRes.data.risk_score));
        setRiskLevel(predRes.data.risk_level);
      } else {
        const risk = calculateRiskScore(currentPhase, ratio, sc);
        setRiskScore(risk.score);
        setRiskLevel(risk.level);
      }

      const { data: recentReports } = await supabase
        .from('risk_reports')
        .select('risk_score')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentReports && recentReports.length > 1) {
        setPreviousScore(Number(recentReports[1].risk_score));
      }

      setLoading(false);
    };

    compute();
  }, [user]);

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  const summary = buildPlainSummary(phase, riskLevel, acRatio, sorenessContrib);
  const influences = buildInfluenceExplanation(phase, acRatio, sorenessContrib);
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

        {/* Plain-Language Summary */}
        <motion.div
          className="glass-card p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-sm leading-relaxed">{summary}</p>
        </motion.div>

        {/* Simplified Drivers (plain-language tags) */}
        {user && <SimplifiedDrivers athleteId={user.id} drivers={prediction?.top_drivers} />}

        {/* What Influenced Your Risk */}
        <motion.div
          className="glass-card p-6 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider">What Influenced Your Risk</h2>
          <ul className="space-y-2.5">
            {influences.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

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
            <p className="text-sm text-muted-foreground">{escalation.trigger_reason}</p>
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
