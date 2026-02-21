import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import AgentStatus from '@/components/AgentStatus';
import TopDrivers from '@/components/TopDrivers';
import { motion } from 'framer-motion';
import {
  getCurrentPhase,
  calculateAcuteChronicRatio,
  calculateSorenessContribution,
  calculateRiskScore,
  PHASE_MULTIPLIERS,
  type MenstrualPhase,
} from '@/lib/riskEngine';
import { Calendar, Dumbbell, HeartPulse, ClipboardList, BarChart3, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [acRatio, setAcRatio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [latestActions, setLatestActions] = useState<Array<{ action_type: string; details: any; created_at: string }>>([]);

  useEffect(() => {
    if (!user) return;
    
    const compute = async () => {
      const { data: ap } = await supabase
        .from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();

      const currentPhase = ap?.cycle_start_date
        ? getCurrentPhase(ap.cycle_start_date, ap.cycle_length || 28, ap.menstruation_length || 5)
        : 'unknown';
      setPhase(currentPhase);

      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('training_sessions').select('date, duration, rpe, intensity').eq('athlete_id', user.id).gte('date', since);
      const ratio = calculateAcuteChronicRatio(sessions || []);
      setAcRatio(ratio);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: soreness } = await supabase
        .from('soreness_logs').select('knee, hamstring, groin, calf, other_value').eq('athlete_id', user.id).gte('date', threeDaysAgo).order('date', { ascending: false });
      const sorenessContrib = calculateSorenessContribution(soreness || []);
      const risk = calculateRiskScore(currentPhase, ratio, sorenessContrib);
      setRiskScore(risk.score);
      setRiskLevel(risk.level);

      const { data: prevReports } = await supabase
        .from('risk_reports').select('risk_score').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (prevReports) setPreviousScore(prevReports.risk_score);

      // Fetch latest agent actions
      const { data: actions } = await supabase
        .from('agent_actions')
        .select('action_type, details, created_at')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (actions) setLatestActions(actions as any[]);

      setLoading(false);
    };
    compute();
  }, [user]);

  const quickActions = [
    { path: '/training-log', label: 'Log Training', icon: Dumbbell, color: 'text-primary' },
    { path: '/soreness-log', label: 'Log Soreness', icon: HeartPulse, color: 'text-primary' },
    { path: '/cycle-setup', label: 'Update Cycle', icon: Calendar, color: 'text-primary' },
    { path: '/plan', label: 'View Plan', icon: ClipboardList, color: 'text-primary' },
    { path: '/risk-report', label: 'Risk Report', icon: BarChart3, color: 'text-primary' },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold">
            WELCOME{profile?.full_name ? `, ${profile.full_name.toUpperCase()}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">Your training intelligence at a glance.</p>
        </div>

        {riskLevel === 'High' && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-destructive">HIGH INJURY RISK DETECTED</p>
              <p className="text-sm text-muted-foreground">Your risk score is critically elevated. Consider reducing training intensity.</p>
            </div>
            <Link to="/risk-report" className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-bold">
              View Report
            </Link>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Injury Risk</p>
            {loading ? (
              <div className="w-36 h-36 rounded-full bg-secondary animate-pulse" />
            ) : (
              <RiskGauge score={riskScore} />
            )}
            <div className="mt-3"><RiskBadge level={riskLevel} /></div>
            {previousScore !== null && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                riskScore > previousScore ? 'text-destructive' : riskScore < previousScore ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {riskScore > previousScore ? (
                  <><TrendingUp className="h-3.5 w-3.5" /> +{riskScore - previousScore} from last</>
                ) : riskScore < previousScore ? (
                  <><TrendingDown className="h-3.5 w-3.5" /> {riskScore - previousScore} from last</>
                ) : (
                  <><Minus className="h-3.5 w-3.5" /> No change</>
                )}
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Current Phase</p>
            <p className="text-2xl font-heading font-bold capitalize text-primary">{phase}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Risk multiplier: ×{PHASE_MULTIPLIERS[phase].toFixed(1)}
            </p>
          </div>

          <div className="glass-card p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Acute:Chronic Ratio</p>
            <p className={`text-2xl font-heading font-bold ${acRatio > 1.5 ? 'risk-high' : acRatio > 1.2 ? 'risk-medium' : 'risk-low'}`}>
              {acRatio.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {acRatio > 1.5 ? 'Spike detected' : acRatio > 1.2 ? 'Slightly elevated' : 'Sweet spot'}
            </p>
          </div>
        </div>

        {/* Agent Status + Top Drivers */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AgentStatus athleteId={user.id} />
            <TopDrivers athleteId={user.id} />
          </div>
        )}

        {/* Latest Agent Actions */}
        {latestActions.length > 0 && (
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Latest Agent Actions</h3>
            </div>
            <div className="space-y-2">
              {latestActions.map((a, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-xs font-bold uppercase">{a.action_type}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="font-heading text-lg font-bold uppercase mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {quickActions.map(a => (
              <Link key={a.path} to={a.path}
                className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors group">
                <a.icon className={`h-6 w-6 ${a.color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium text-center">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {phase === 'unknown' && (
          <div className="glass-card p-6 border-primary/30">
            <p className="font-bold mb-1">Complete your cycle setup</p>
            <p className="text-sm text-muted-foreground mb-3">We need your menstrual cycle data to calculate accurate risk scores.</p>
            <Link to="/cycle-setup" className="text-primary text-sm font-bold hover:underline">Set up now →</Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
