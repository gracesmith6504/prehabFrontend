import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import FeedbackButtons from '@/components/FeedbackButtons';
import SessionLogDialog from '@/components/SessionLogDialog';
import {
  generateDefaultPlan, adjustPlan, generateExplanation,
  getCurrentPhase, calculateAcuteChronicRatio, calculateSorenessContribution,
  calculateRiskScore, type PlanSession, type MenstrualPhase,
} from '@/lib/riskEngine';
import { ClipboardList, ChevronLeft, ChevronRight, Bot, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, startOfWeek, addWeeks, format, isSameDay } from 'date-fns';

interface AgentRunMeta {
  started_at: string;
  model_version: string | null;
  trigger_type: string;
}

interface SessionLog {
  id: string;
  date: string;
  duration: number;
  rpe: number;
  session_type: string;
  intensity: string;
}

function getWeekDates(weekStart: Date) {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return { day, date: d };
  });
}

function getMondayOfWeek(d: Date) {
  const date = new Date(d);
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function PlanView() {
  const { user } = useAuth();
  const [adjusted, setAdjusted] = useState<PlanSession[]>([]);
  const [original, setOriginal] = useState<PlanSession[]>([]);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);
  const [weeklyPlanId, setWeeklyPlanId] = useState<string | null>(null);
  const [agentRun, setAgentRun] = useState<AgentRunMeta | null>(null);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [riskPredictionId, setRiskPredictionId] = useState<string | null>(null);
  const [planOwnerType, setPlanOwnerType] = useState<string>('athlete');

  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0);
  const currentMonday = getMondayOfWeek(new Date());
  const viewingMonday = addWeeks(currentMonday, weekOffset);
  const weekDates = getWeekDates(viewingMonday);
  const isCurrentWeek = weekOffset === 0;
  const isPastWeek = weekOffset < 0;

  // Session logs for the viewed week
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLog, setSelectedLog] = useState<SessionLog | null>(null);

  const fetchSessionLogs = useCallback(async () => {
    if (!user) return;
    const weekStart = format(viewingMonday, 'yyyy-MM-dd');
    const weekEnd = format(addWeeks(viewingMonday, 1), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('training_sessions')
      .select('id, date, duration, rpe, session_type, intensity')
      .eq('athlete_id', user.id)
      .gte('date', weekStart)
      .lt('date', weekEnd);
    setSessionLogs(data || []);
  }, [user, viewingMonday]);

  useEffect(() => {
    fetchSessionLogs();
  }, [fetchSessionLogs]);

  useEffect(() => {
    if (!user) return;
    const compute = async () => {
      const { data: ap } = await supabase.from('athlete_profiles').select('*').eq('user_id', user.id).maybeSingle();
      const phase = ap?.cycle_start_date
        ? getCurrentPhase(ap.cycle_start_date, ap.cycle_length || 28, ap.menstruation_length || 5)
        : 'unknown' as MenstrualPhase;

      const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: sessions } = await supabase.from('training_sessions').select('date, duration, rpe, intensity').eq('athlete_id', user.id).gte('date', since);
      const ratio = calculateAcuteChronicRatio(sessions || []);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: soreness } = await supabase.from('soreness_logs').select('knee, hamstring, groin, calf, other_value').eq('athlete_id', user.id).gte('date', threeDaysAgo).order('date', { ascending: false });
      const sorenessContrib = calculateSorenessContribution(soreness || []);

      const risk = calculateRiskScore(phase, ratio, sorenessContrib);
      setRiskLevel(risk.level);

      const { data: savedPlan } = await supabase.from('weekly_plans').select('*').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (savedPlan) {
        setWeeklyPlanId(savedPlan.id);
        setAgentRunId(savedPlan.agent_run_id);
        setPlanOwnerType(savedPlan.plan_owner_type || 'athlete');
        if (savedPlan.agent_run_id) {
          const { data: run } = await supabase.from('agent_runs').select('started_at, model_version, trigger_type').eq('id', savedPlan.agent_run_id).maybeSingle();
          if (run) setAgentRun(run);
        }
      }

      const { data: pred } = await supabase.from('risk_predictions').select('id, risk_prob').eq('athlete_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (pred) setRiskPredictionId(pred.id);

      const isCoachPlan = (savedPlan?.plan_owner_type || 'athlete') === 'coach';
      const basePlan = savedPlan?.original_plan
        ? (savedPlan.original_plan as unknown as PlanSession[])
        : generateDefaultPlan();
      setOriginal(basePlan);

      if (isCoachPlan && savedPlan?.adjusted_plan) {
        setAdjusted(savedPlan.adjusted_plan as unknown as PlanSession[]);
        setExplanation(savedPlan.explanation || 'This plan was assigned by your coach.');
      } else {
        const result = adjustPlan(basePlan, risk.score);
        setAdjusted(result.adjusted);
        setExplanation(generateExplanation(phase, risk.score, ratio, sorenessContrib, result.changes));
      }

      if (!savedPlan) {
        const result = adjustPlan(basePlan, risk.score);
        const { data: newPlan } = await supabase.from('weekly_plans').insert({
          athlete_id: user.id,
          original_plan: basePlan as any,
          adjusted_plan: result.adjusted as any,
          risk_score: risk.score,
          risk_level: risk.level,
          explanation: generateExplanation(phase, risk.score, ratio, sorenessContrib, result.changes),
        }).select('id').maybeSingle();
        if (newPlan) setWeeklyPlanId(newPlan.id);
      }

      setLoading(false);
    };
    compute();
  }, [user]);

  const getLogForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return sessionLogs.find(l => l.date === dateStr) || null;
  };

  const handleSessionClick = (session: PlanSession, date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFuture = date > today;
    if (isFuture) return; // Can't log future sessions

    const log = getLogForDate(date);
    setSelectedSession(session);
    setSelectedDate(date);
    setSelectedLog(log);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const intensityColor = (intensity: string) => {
    if (intensity === 'High') return 'bg-destructive/20 text-destructive border-destructive/30';
    if (intensity === 'Medium') return 'bg-warning/20 text-warning border-warning/30';
    return 'bg-primary/20 text-primary border-primary/30';
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
              <ClipboardList className="h-8 w-8 text-primary" />
              TRAINING PLAN
              {planOwnerType === 'coach' && (
                <Badge variant="secondary" className="ml-2 gap-1 text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Coach Plan
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isPastWeek
                ? 'Viewing past week — tap a session to review your log.'
                : planOwnerType === 'coach'
                  ? 'Coach-assigned baseline with AI adjustments. Tap to log effort.'
                  : 'AI-adjusted plan. Tap a session to log your effort.'}
            </p>
          </div>
          <RiskBadge level={riskLevel} />
        </div>

        {/* Agent run info */}
        {agentRun && isCurrentWeek && (
          <div className="glass-card p-3 flex items-center gap-3 text-sm">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Updated {formatDistanceToNow(new Date(agentRun.started_at))} ago</span>
            {agentRun.model_version && (
              <span className="text-xs bg-secondary px-2 py-0.5 rounded-full font-mono">{agentRun.model_version}</span>
            )}
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-center">
            <p className="text-sm font-heading font-bold">
              {format(viewingMonday, 'MMM d')} — {format(addWeeks(viewingMonday, 1), 'MMM d, yyyy')}
            </p>
            {isCurrentWeek && <p className="text-xs text-primary font-medium">This Week</p>}
            {isPastWeek && <p className="text-xs text-muted-foreground">Past Week</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(o => o + 1)} disabled={weekOffset >= 0}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map(({ day, date }, idx) => {
            const session = adjusted.find(s => s.day === day);
            const orig = original.find(s => s.day === day);
            const isToday = isSameDay(date, new Date());
            const log = getLogForDate(date);
            const isFuture = date > today;
            const changed = orig && session && (orig.type !== session.type || orig.intensity !== session.intensity || orig.duration !== session.duration);

            return (
              <motion.div
                key={`${weekOffset}-${day}`}
                className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[160px] transition-colors ${
                  isToday ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-card'
                } ${!isFuture && session ? 'cursor-pointer hover:border-primary/50' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => session && handleSessionClick(session, date)}
              >
                <div className="text-center">
                  <p className={`text-xs font-bold uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {day.slice(0, 3)}
                  </p>
                  <p className={`text-lg font-heading font-bold ${isToday ? 'text-primary' : ''}`}>
                    {date.getDate()}
                  </p>
                </div>
                {session && (
                  <div className="flex-1 flex flex-col gap-1.5">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-center border ${intensityColor(session.intensity)}`}>
                      {session.intensity}
                    </span>
                    <p className={`text-xs font-medium text-center ${changed ? 'text-primary' : ''}`}>
                      {session.type}
                    </p>
                    <p className="text-xs text-muted-foreground text-center">{session.duration}min</p>
                    {changed && <p className="text-[10px] text-primary text-center font-medium">AI adjusted</p>}

                    {/* Logged indicator */}
                    {log && (
                      <div className="mt-auto flex items-center justify-center gap-1 text-[10px] text-primary font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        RPE {log.rpe} · {log.duration}m
                      </div>
                    )}
                    {!log && !isFuture && (
                      <p className="mt-auto text-[10px] text-muted-foreground text-center">Tap to log</p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Explanation */}
        {isCurrentWeek && explanation && (
          <div className="glass-card p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">AI Explanation</p>
            <p className="text-sm leading-relaxed">{explanation}</p>
          </div>
        )}

        {/* Feedback */}
        {user && isCurrentWeek && (
          <FeedbackButtons
            athleteId={user.id}
            weeklyPlanId={weeklyPlanId || undefined}
            riskPredictionId={riskPredictionId || undefined}
            agentRunId={agentRunId || undefined}
          />
        )}
      </div>

      {/* Session log dialog */}
      {selectedSession && user && (
        <SessionLogDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          session={selectedSession}
          date={selectedDate}
          athleteId={user.id}
          existingLog={selectedLog}
          onLogged={fetchSessionLogs}
        />
      )}
    </AppLayout>
  );
}
