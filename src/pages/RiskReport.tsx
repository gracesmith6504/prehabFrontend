import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import TopDrivers from '@/components/TopDrivers';
import FeedbackButtons from '@/components/FeedbackButtons';
import AgentStatus from '@/components/AgentStatus';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentPhase, calculateAcuteChronicRatio, calculateSorenessContribution,
  calculateRiskScore, getLoadRiskMultiplier, PHASE_MULTIPLIERS,
  generateExplanation, adjustPlan, generateDefaultPlan,
  type MenstrualPhase,
} from '@/lib/riskEngine';
import { BarChart3, TrendingUp, TrendingDown, Minus, ShieldCheck, Clock, AlertTriangle, Bot, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

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
  model_version: string | null;
  predictor_type: string;
  top_drivers: any;
  agent_run_id: string | null;
}

export default function RiskReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [acRatio, setAcRatio] = useState(0);
  const [sorenessContrib, setSorenessContrib] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [escalation, setEscalation] = useState<EscalationInfo | null>(null);
  const [prediction, setPrediction] = useState<PredictionInfo | null>(null);
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const compute = async () => {
      // Fetch athlete profile, risk prediction, escalation, and weekly plan in parallel
      const [apRes, predRes, escRes, planRes] = await Promise.all([
        supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('risk_predictions').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('escalations').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('weekly_plans').select('id').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (predRes.data) setPrediction(predRes.data as unknown as PredictionInfo);
      if (escRes.data) setEscalation(escRes.data as unknown as EscalationInfo);
      if (planRes.data) setWeeklyPlanId(planRes.data.id);

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

      // Use prediction data if available, otherwise compute locally
      if (predRes.data) {
        setRiskScore(Number(predRes.data.risk_score));
        setRiskLevel(predRes.data.risk_level);
      } else {
        const risk = calculateRiskScore(currentPhase, ratio, sc);
        setRiskScore(risk.score);
        setRiskLevel(risk.level);
      }

      const plan = generateDefaultPlan();
      const { changes } = adjustPlan(plan, predRes.data ? Number(predRes.data.risk_score) : calculateRiskScore(currentPhase, ratio, sc).score);
      setExplanation(generateExplanation(currentPhase, predRes.data ? Number(predRes.data.risk_score) : calculateRiskScore(currentPhase, ratio, sc).score, ratio, sc, changes));

      // Previous score
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

  const breakdown = [
    { label: 'Current Phase', value: phase, detail: `×${PHASE_MULTIPLIERS[phase].toFixed(1)} multiplier`, weight: '30%' },
    { label: 'Acute:Chronic Ratio', value: acRatio.toFixed(2), detail: `Load multiplier: ×${getLoadRiskMultiplier(acRatio).toFixed(1)}`, weight: '40%' },
    { label: 'Soreness Contribution', value: `${sorenessContrib.toFixed(0)}/100`, detail: sorenessContrib > 50 ? 'Significantly elevated' : 'Within range', weight: '30%' },
  ];

  const escalationStatusColor = (s: string) => {
    if (s === 'resolved') return 'text-primary';
    if (s === 'acknowledged') return 'text-warning';
    return 'text-destructive';
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            RISK REPORT
          </h1>
          <p className="text-muted-foreground mt-1">Detailed breakdown of your injury risk assessment.</p>
        </div>

        {/* Agent Status */}
        <AgentStatus athleteId={user?.id} />

        {/* Score + Risk Probability */}
        <div className="glass-card p-8 flex flex-col items-center">
          <RiskGauge score={riskScore} />
          <div className="mt-4"><RiskBadge level={riskLevel} /></div>
          <p className="text-lg font-heading font-bold mt-3">Final Injury Risk Score: {riskScore}/100</p>
          {prediction && (
            <p className="text-sm text-muted-foreground mt-1">
              Risk Probability: <span className="font-bold text-foreground">{(prediction.risk_prob * 100).toFixed(1)}%</span>
            </p>
          )}
          {previousScore !== null && (
            <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${
              riskScore > previousScore ? 'text-destructive' : riskScore < previousScore ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {riskScore > previousScore ? (
                <><TrendingUp className="h-4 w-4" /> ↑ +{riskScore - previousScore} from previous</>
              ) : riskScore < previousScore ? (
                <><TrendingDown className="h-4 w-4" /> ↓ {riskScore - previousScore} from previous</>
              ) : (
                <><Minus className="h-4 w-4" /> No change from previous</>
              )}
            </div>
          )}
        </div>

        {/* Model Info */}
        {prediction && (
          <div className="glass-card p-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Predictor:</span>
              <span className="font-bold uppercase">{prediction.predictor_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Model:</span>
              <span className="font-medium">{prediction.model_version || 'N/A'}</span>
            </div>
          </div>
        )}

        {/* Top Drivers */}
        {user && <TopDrivers athleteId={user.id} drivers={prediction?.top_drivers} />}

        {/* Breakdown */}
        <div className="space-y-3">
          <h2 className="font-heading text-lg font-bold uppercase">Score Breakdown</h2>
          {breakdown.map((b, i) => (
            <motion.div
              key={b.label}
              className="glass-card p-5 flex items-center justify-between"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div>
                <p className="text-sm font-medium">{b.label}</p>
                <p className="text-xs text-muted-foreground">{b.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-heading font-bold capitalize">{b.value}</p>
                <p className="text-xs text-muted-foreground">Weight: {b.weight}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Explanation */}
        <div className="glass-card p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Analysis</p>
          <p className="text-sm leading-relaxed">{explanation}</p>
        </div>

        {/* Auto-Escalation Status */}
        {escalation && (
          <div className={`glass-card p-6 ${escalation.status === 'open' ? 'border-destructive/30' : escalation.status === 'acknowledged' ? 'border-warning/30' : 'border-primary/30'}`}>
            <div className="flex items-center gap-3 mb-3">
              {escalation.status === 'resolved' ? (
                <ShieldCheck className="h-6 w-6 text-primary" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
              <p className={`font-bold ${escalationStatusColor(escalation.status)}`}>
                Escalation: {escalation.status.charAt(0).toUpperCase() + escalation.status.slice(1)}
              </p>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{escalation.trigger_reason}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> Created {formatDistanceToNow(new Date(escalation.created_at))} ago
              </span>
              {escalation.acknowledged_at && (
                <span>Acknowledged {formatDistanceToNow(new Date(escalation.acknowledged_at))} ago</span>
              )}
              {escalation.resolved_at && (
                <span>Resolved {formatDistanceToNow(new Date(escalation.resolved_at))} ago</span>
              )}
            </div>
          </div>
        )}

        {/* Feedback */}
        {user && (
          <FeedbackButtons
            athleteId={user.id}
            weeklyPlanId={weeklyPlanId || undefined}
            riskPredictionId={prediction?.id}
            agentRunId={prediction?.agent_run_id || undefined}
          />
        )}
      </div>
    </AppLayout>
  );
}
