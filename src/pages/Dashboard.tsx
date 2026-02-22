import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskGauge from '@/components/RiskGauge';
import RiskBadge from '@/components/RiskBadge';
import TodaysSession from '@/components/TodaysSession';
import SimplifiedDrivers from '@/components/SimplifiedDrivers';
import GoalTracker from '@/components/GoalTracker';
import { motion } from 'framer-motion';
import {
  getCurrentPhase,
  type MenstrualPhase,
  type PlanSession,
} from '@/lib/riskEngine';
import { Calendar, ClipboardList, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [riskScore, setRiskScore] = useState(0);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [phase, setPhase] = useState<MenstrualPhase>('unknown');
  const [loading, setLoading] = useState(true);
  const [reEvaluating, setReEvaluating] = useState(false);

  // Today's session
  const [todaySession, setTodaySession] = useState<PlanSession | null>(null);
  const [todayLog, setTodayLog] = useState<{ id: string; duration: number; rpe: number } | null>(null);

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

      const { data: latestPrediction } = await supabase
        .from('risk_predictions')
        .select('risk_score, risk_level')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestPrediction) {
        setRiskScore(latestPrediction.risk_score);
        setRiskLevel(latestPrediction.risk_level);
      }

      const { data: plan } = await supabase
        .from('weekly_plans')
        .select('adjusted_plan')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (plan) {
        const adjustedPlan = (plan.adjusted_plan as unknown as PlanSession[]) || [];
        setTodaySession(adjustedPlan.find(s => s.day === todayDay) || null);
      }

      setLoading(false);
    };

    compute();
    fetchTodayLog();
  }, [user]);

  const quickActions = [
    { path: '/plan', label: 'Training Plan', icon: ClipboardList },
    { path: '/cycle-setup', label: 'Cycle Info', icon: Calendar },
    { path: '/risk-report', label: 'Full Report', icon: BarChart3 },
  ];

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">
              {profile?.full_name ? `Hi, ${profile.full_name}` : 'Welcome'}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Your training snapshot for today</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                disabled={reEvaluating}
                onClick={async () => {
                  setReEvaluating(true);
                  const { error } = await supabase.functions.invoke('agent-runner', {
                    body: { trigger_type: 'manual', athlete_id: user?.id },
                  });
                  if (error) toast.error('Re-evaluation failed');
                  else { toast.success('Risk re-evaluated'); window.location.reload(); }
                  setReEvaluating(false);
                }}
                className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${reEvaluating ? 'animate-spin' : ''}`} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Re-evaluate</TooltipContent>
          </Tooltip>
        </div>

        {/* Critical risk alert */}
        {(riskLevel === 'Critical' || riskLevel === 'High') && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          >
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-destructive text-sm">High injury risk detected</p>
              <p className="text-xs text-muted-foreground">Consider reducing intensity today.</p>
            </div>
            <Link to="/risk-report" className="px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-bold">
              Details
            </Link>
          </motion.div>
        )}

        {/* Risk + Phase — compact row */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              {loading ? (
                <div className="w-20 h-20 rounded-full bg-secondary animate-pulse" />
              ) : (
                <RiskGauge score={riskScore} />
              )}
              <div className="mt-1.5"><RiskBadge level={riskLevel} /></div>
            </div>
            <div className="flex-1 space-y-2">
              {user && <SimplifiedDrivers athleteId={user.id} />}
              {phase !== 'unknown' && (
                <p className="text-xs text-muted-foreground">
                  Cycle phase: <span className="capitalize text-foreground font-medium">{phase}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Today's Session */}
        {!loading && user && (
          <TodaysSession
            session={todaySession}
            athleteId={user.id}
            existingLog={todayLog}
            onLogged={fetchTodayLog}
          />
        )}

        {/* Goals */}
        {user && <GoalTracker athleteId={user.id} />}

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map(a => (
            <Link key={a.path} to={a.path}
              className="glass-card p-3 flex flex-col items-center gap-1.5 hover:bg-secondary/50 transition-colors group">
              <a.icon className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-center">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Cycle setup prompt */}
        {phase === 'unknown' && (
          <div className="glass-card p-5 border-primary/30">
            <p className="font-bold text-sm mb-1">Complete your cycle setup</p>
            <p className="text-xs text-muted-foreground mb-2">We need your cycle data to personalize risk scores.</p>
            <Link to="/cycle-setup" className="text-primary text-xs font-bold hover:underline">Set up now →</Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
