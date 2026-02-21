import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import TodaysSession from '@/components/TodaysSession';
import AIUpdateCard from '@/components/AIUpdateCard';
import SimplifiedDrivers from '@/components/SimplifiedDrivers';
import PlanChanges from '@/components/PlanChanges';
import { motion } from 'framer-motion';
import {
  getCurrentPhase,
  calculateAcuteChronicRatio,
  calculateSorenessContribution,
  calculateRiskScore,
  PHASE_MULTIPLIERS,
  type MenstrualPhase,
  type PlanSession,
} from '@/lib/riskEngine';
import { Calendar, ClipboardList, BarChart3, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [acRatio, setAcRatio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previousScore, setPreviousScore] = useState<number | null>(null);

  // Today's session
  const [todaySession, setTodaySession] = useState<PlanSession | null>(null);
  const [todayLog, setTodayLog] = useState<{ id: string; duration: number; rpe: number } | null>(null);

  // AI update
  const [lastAgentUpdate, setLastAgentUpdate] = useState<string | null>(null);
  const [planAdjusted, setPlanAdjusted] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const fetchTodayLog = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('training_sessions')
      .select('id, duration, rpe')
      .eq('athlete_id', user.id)
      .eq('date', todayStr)
      .maybeSingle();
    setTodayLog(data || null);
  }, [user, todayStr]);

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

      // Get today's planned session from weekly plan
      const { data: plan } = await supabase
        .from('weekly_plans')
        .select('adjusted_plan, original_plan, agent_run_id')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (plan) {
        const adjustedPlan = (plan.adjusted_plan as unknown as PlanSession[]) || [];
        const originalPlan = (plan.original_plan as unknown as PlanSession[]) || [];
        const todaySess = adjustedPlan.find(s => s.day === todayDay) || null;
        setTodaySession(todaySess);

        // Check if plan was adjusted
        const hasChanges = adjustedPlan.some(adj => {
          const orig = originalPlan.find(o => o.day === adj.day);
          return orig && (orig.intensity !== adj.intensity || orig.duration !== adj.duration || orig.type !== adj.type);
        });
        setPlanAdjusted(hasChanges);

        // Get agent run time
        if (plan.agent_run_id) {
          const { data: run } = await supabase
            .from('agent_runs')
            .select('completed_at, started_at')
            .eq('id', plan.agent_run_id)
            .maybeSingle();
          if (run) setLastAgentUpdate(run.completed_at || run.started_at);
        }
      }

      // If no agent run from plan, get latest
      if (!lastAgentUpdate) {
        const { data: latestRun } = await supabase
          .from('agent_runs')
          .select('completed_at, started_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestRun) setLastAgentUpdate(latestRun.completed_at || latestRun.started_at);
      }

      setLoading(false);
    };

    compute();
    fetchTodayLog();
  }, [user]);

  const quickActions = [
    { path: '/plan', label: 'Training Plan', icon: ClipboardList, color: 'text-primary' },
    { path: '/cycle-setup', label: 'Update Cycle', icon: Calendar, color: 'text-primary' },
    { path: '/risk-report', label: 'Risk Report', icon: BarChart3, color: 'text-primary' },
  ];

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-heading font-bold">
            WELCOME{profile?.full_name ? `, ${profile.full_name.toUpperCase()}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1">Here's your training snapshot for today.</p>
        </div>

        {/* High risk alert */}
        {riskLevel === 'High' && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-destructive">HIGH INJURY RISK</p>
              <p className="text-sm text-muted-foreground">Consider reducing intensity today. Your body needs extra care.</p>
            </div>
            <Link to="/risk-report" className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-bold">
              Details
            </Link>
          </motion.div>
        )}

        {/* Today's Session — prominent at top */}
        {!loading && user && (
          <TodaysSession
            session={todaySession}
            athleteId={user.id}
            existingLog={todayLog}
            onLogged={fetchTodayLog}
          />
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-5 flex flex-col items-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Injury Risk</p>
            {loading ? (
              <div className="w-28 h-28 rounded-full bg-secondary animate-pulse" />
            ) : (
              <RiskGauge score={riskScore} />
            )}
            <div className="mt-2"><RiskBadge level={riskLevel} /></div>
            {previousScore !== null && (
              <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${
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

          <div className="glass-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Phase</p>
            <p className="text-2xl font-heading font-bold capitalize text-primary">{phase}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Risk factor: ×{PHASE_MULTIPLIERS[phase].toFixed(1)}
            </p>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Training Load</p>
            <p className={`text-2xl font-heading font-bold ${acRatio > 1.5 ? 'risk-high' : acRatio > 1.2 ? 'risk-medium' : 'risk-low'}`}>
              {acRatio.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {acRatio > 1.5 ? 'Spike detected — ease off' : acRatio > 1.2 ? 'Slightly elevated' : 'In the sweet spot'}
            </p>
          </div>
        </div>

        {/* AI Update + Risk Drivers */}
        {user && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AIUpdateCard lastUpdated={lastAgentUpdate} planAdjusted={planAdjusted} />
            <SimplifiedDrivers athleteId={user.id} />
          </div>
        )}

        {/* Plan Changes */}
        {user && <PlanChanges athleteId={user.id} />}

        {/* Quick Actions */}
        <div>
          <h2 className="font-heading text-lg font-bold uppercase mb-3">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map(a => (
              <Link key={a.path} to={a.path}
                className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-secondary/50 transition-colors group">
                <a.icon className={`h-6 w-6 ${a.color} group-hover:scale-110 transition-transform`} />
                <span className="text-xs font-medium text-center">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Cycle setup prompt */}
        {phase === 'unknown' && (
          <div className="glass-card p-6 border-primary/30">
            <p className="font-bold mb-1">Complete your cycle setup</p>
            <p className="text-sm text-muted-foreground mb-3">We need your cycle data to personalize your risk scores.</p>
            <Link to="/cycle-setup" className="text-primary text-sm font-bold hover:underline">Set up now →</Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
