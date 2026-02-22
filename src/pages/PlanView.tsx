import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import FeedbackButtons from '@/components/FeedbackButtons';
import SessionLogDialog from '@/components/SessionLogDialog';
import ExtraSessionDialog from '@/components/ExtraSessionDialog';
import {
  generateDefaultPlan, adjustPlan, type PlanSession,
} from '@/lib/riskEngine';
import { ClipboardList, ChevronLeft, ChevronRight, Bot, ShieldCheck, CheckCircle2, Plus, User, Edit3, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, addWeeks, format, isSameDay } from 'date-fns';

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

interface ExtraSession {
  id: string;
  day: string;
  session_type: string;
  intensity: string;
  duration: number;
  notes: string | null;
  week_start: string;
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

  // Session logs
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);

  // Extra sessions
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [extraDialogDay, setExtraDialogDay] = useState('Monday');
  const [editingExtra, setEditingExtra] = useState<ExtraSession | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedLog, setSelectedLog] = useState<SessionLog | null>(null);

  // Add extra session day picker
  const [addExtraOpen, setAddExtraOpen] = useState(false);

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

  const fetchExtraSessions = useCallback(async () => {
    if (!user) return;
    const weekStartStr = format(viewingMonday, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('athlete_extra_sessions')
      .select('id, day, session_type, intensity, duration, notes, week_start')
      .eq('athlete_id', user.id)
      .eq('week_start', weekStartStr);
    setExtraSessions((data as ExtraSession[]) || []);
  }, [user, viewingMonday]);

  useEffect(() => {
    fetchSessionLogs();
    fetchExtraSessions();
  }, [fetchSessionLogs, fetchExtraSessions]);

  useEffect(() => {
    if (!user) return;
    const compute = async () => {
      // Fetch risk from DB (source of truth) instead of local calculations
      const { data: pred } = await supabase
        .from('risk_predictions')
        .select('id, risk_score, risk_level')
        .eq('athlete_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const dbRiskScore = pred ? Number(pred.risk_score) : 0;
      const dbRiskLevel = pred?.risk_level || 'Low';
      setRiskLevel(dbRiskLevel);
      if (pred) setRiskPredictionId(pred.id);

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

      const isCoachPlan = (savedPlan?.plan_owner_type || 'athlete') === 'coach';
      const basePlan = savedPlan?.original_plan
        ? (savedPlan.original_plan as unknown as PlanSession[])
        : generateDefaultPlan();
      setOriginal(basePlan);

      // Use saved adjusted plan and explanation from DB when available
      if (savedPlan?.adjusted_plan && Array.isArray(savedPlan.adjusted_plan) && (savedPlan.adjusted_plan as unknown[]).length > 0) {
        setAdjusted(savedPlan.adjusted_plan as unknown as PlanSession[]);
        setExplanation(savedPlan.explanation || (isCoachPlan ? 'This plan was assigned by your coach.' : 'AI-adjusted plan based on your risk profile.'));
      } else {
        // Fallback: generate locally using DB risk score
        const result = adjustPlan(basePlan, dbRiskScore);
        setAdjusted(result.adjusted);
        setExplanation(savedPlan?.explanation || 'Plan adjusted based on your current risk level.');
      }

      if (!savedPlan) {
        const result = adjustPlan(basePlan, dbRiskScore);
        const { data: newPlan } = await supabase.from('weekly_plans').insert({
          athlete_id: user.id,
          original_plan: basePlan as any,
          adjusted_plan: result.adjusted as any,
          risk_score: dbRiskScore,
          risk_level: dbRiskLevel,
          explanation: 'Plan adjusted based on your current risk level.',
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

  const getExtrasForDay = (day: string) => extraSessions.filter(s => s.day === day);

  const handleSessionClick = (session: PlanSession, date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFuture = date > today;
    if (isFuture) return;

    const log = getLogForDate(date);
    setSelectedSession(session);
    setSelectedDate(date);
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const handleAddExtra = (day: string) => {
    setExtraDialogDay(day);
    setEditingExtra(null);
    setExtraDialogOpen(true);
  };

  const handleEditExtra = (extra: ExtraSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setExtraDialogDay(extra.day);
    setEditingExtra(extra);
    setExtraDialogOpen(true);
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

  const isCoachPlan = planOwnerType === 'coach';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-bold flex items-center gap-2 sm:gap-3 flex-wrap">
              <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
              TRAINING PLAN
              {isCoachPlan && (
                <Badge variant="secondary" className="ml-2 gap-1 text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Coach Plan
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isPastWeek
                ? 'Viewing past week — tap a session to review your log.'
                : isCoachPlan
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
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {weekDates.map(({ day, date }, idx) => {
            const session = adjusted.find(s => s.day === day);
            const orig = original.find(s => s.day === day);
            const isToday = isSameDay(date, new Date());
            const log = getLogForDate(date);
            const isFuture = date > today;
            const changed = orig && session && (orig.type !== session.type || orig.intensity !== session.intensity || orig.duration !== session.duration);
            const extras = getExtrasForDay(day);

            return (
              <motion.div
                key={`${weekOffset}-${day}`}
                className={`rounded-xl border p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 min-h-[140px] sm:min-h-[160px] transition-colors ${
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

                {/* Athlete extra sessions */}
                {extras.map(extra => (
                  <div
                    key={extra.id}
                    className="relative bg-accent/30 border border-accent/50 rounded-lg p-1.5 text-center"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <User className="h-2.5 w-2.5 text-accent-foreground" />
                      <span className="text-[9px] font-bold uppercase text-accent-foreground tracking-wider">Added</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${intensityColor(extra.intensity)}`}>
                      {extra.intensity}
                    </span>
                    <p className="text-[10px] font-medium mt-0.5">{extra.session_type}</p>
                    <p className="text-[10px] text-muted-foreground">{extra.duration}m</p>
                    {isCurrentWeek && (
                      <button
                        onClick={e => handleEditExtra(extra, e)}
                        className="absolute top-1 right-1 p-0.5 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit3 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                ))}

                {/* Add extra button */}
                {isCurrentWeek && (
                  <button
                    onClick={e => { e.stopPropagation(); handleAddExtra(day); }}
                    className="mt-auto flex items-center justify-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
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

      {/* Extra session dialog */}
      {user && (
        <ExtraSessionDialog
          open={extraDialogOpen}
          onOpenChange={setExtraDialogOpen}
          athleteId={user.id}
          weekStart={viewingMonday}
          day={extraDialogDay}
          existing={editingExtra}
          onSaved={fetchExtraSessions}
        />
      )}
    </AppLayout>
  );
}
