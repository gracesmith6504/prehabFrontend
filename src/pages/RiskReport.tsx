import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import { useToast } from '@/hooks/use-toast';
import {
  getCurrentPhase, calculateAcuteChronicRatio, calculateSorenessContribution,
  calculateRiskScore, getLoadRiskMultiplier, PHASE_MULTIPLIERS,
  generateExplanation, adjustPlan, generateDefaultPlan,
  type MenstrualPhase,
} from '@/lib/riskEngine';
import { BarChart3, AlertTriangle, Send, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RiskReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [acRatio, setAcRatio] = useState(0);
  const [sorenessContrib, setSorenessContrib] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [escalated, setEscalated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    const compute = async () => {
      const { data: ap } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
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

      const risk = calculateRiskScore(currentPhase, ratio, sc);
      setRiskScore(risk.score);
      setRiskLevel(risk.level);

      const plan = generateDefaultPlan();
      const { changes } = adjustPlan(plan, risk.score);
      setExplanation(generateExplanation(currentPhase, risk.score, ratio, sc, changes));

      // Check existing escalation & previous score
      const { data: recentReports } = await supabase
        .from('risk_reports')
        .select('risk_score, escalation_status, created_at')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (recentReports && recentReports.length > 0) {
        if (recentReports[0].escalation_status === 'escalated') setEscalated(true);
        if (recentReports.length > 1) {
          setPreviousScore(recentReports[1].risk_score);
        }
      }

      setLoading(false);
    };

    compute();
  }, [user]);

  const handleEscalate = async () => {
    if (!user) return;
    await supabase.from('risk_reports').insert({
      athlete_id: user.id,
      risk_score: riskScore,
      risk_level: riskLevel,
      phase,
      phase_multiplier: PHASE_MULTIPLIERS[phase],
      acute_chronic_ratio: acRatio,
      load_risk_multiplier: getLoadRiskMultiplier(acRatio),
      soreness_contribution: sorenessContrib,
      explanation,
      escalation_status: 'escalated',
    });
    setEscalated(true);
    toast({ title: 'Escalated to Coach', description: 'Your coach has been notified.' });
  };

  if (loading) {
    return <AppLayout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  }

  const breakdown = [
    { label: 'Current Phase', value: phase, detail: `×${PHASE_MULTIPLIERS[phase].toFixed(1)} multiplier`, weight: '30%' },
    { label: 'Acute:Chronic Ratio', value: acRatio.toFixed(2), detail: `Load multiplier: ×${getLoadRiskMultiplier(acRatio).toFixed(1)}`, weight: '40%' },
    { label: 'Soreness Contribution', value: `${sorenessContrib.toFixed(0)}/100`, detail: sorenessContrib > 50 ? 'Significantly elevated' : 'Within range', weight: '30%' },
  ];

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

        {/* Score */}
        <div className="glass-card p-8 flex flex-col items-center">
          <RiskGauge score={riskScore} />
          <div className="mt-4"><RiskBadge level={riskLevel} /></div>
          <p className="text-lg font-heading font-bold mt-3">Final Injury Risk Score: {riskScore}/100</p>
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

        {/* Escalation */}
        {riskScore > 80 && (
          <div className="glass-card p-6 border-destructive/30">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="font-bold text-destructive">Critical Risk Level</p>
            </div>
            {escalated ? (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Send className="h-4 w-4" /> Escalated to Coach
              </div>
            ) : (
              <button onClick={handleEscalate}
                className="px-6 py-3 bg-destructive text-destructive-foreground font-bold rounded-lg uppercase tracking-wider hover:brightness-110 transition-all">
                Escalate to Coach
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
