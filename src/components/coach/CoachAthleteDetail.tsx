import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { rewriteForCoach } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TopDrivers from '@/components/TopDrivers';
import FeedbackButtons from '@/components/FeedbackButtons';
import RiskBadge from '@/components/RiskBadge';
import { ArrowLeft, Lock, Unlock, RotateCcw, CheckCircle2, Edit3, X, User, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import GoalTracker from '@/components/GoalTracker';

interface Props {
  athleteId: string;
  athleteName: string;
  onBack: () => void;
}

interface PlanSession {
  day: string;
  type: string;
  intensity: string;
  duration: number;
  notes?: string;
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

export default function CoachAthleteDetail({ athleteId, athleteName, onBack }: Props) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<any>(null);
  const [originalSessions, setOriginalSessions] = useState<PlanSession[]>([]);
  const [adjustedSessions, setAdjustedSessions] = useState<PlanSession[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PlanSession>>({});
  const [report, setReport] = useState<any>(null);
  const [extraSessions, setExtraSessions] = useState<ExtraSession[]>([]);
  const [riskPredictionId, setRiskPredictionId] = useState<string | null>(null);
  const [rerunPending, setRerunPending] = useState(false);
  const [autonomyLevel, setAutonomyLevel] = useState<string>('auto_adjust');

  // Debounced agent re-trigger: waits 8s after last override before firing
  const rerunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDebouncedRerun = useCallback(() => {
    if (rerunTimerRef.current) clearTimeout(rerunTimerRef.current);
    setRerunPending(true);
    rerunTimerRef.current = setTimeout(async () => {
      try {
        await supabase.functions.invoke('agent-runner', {
          body: { trigger_type: 'coach_override', coach_id: user?.id, athlete_id: athleteId },
        });
        toast.info('Re-analysis triggered for updated plan');
      } catch {
        toast.error('Failed to trigger re-analysis');
      } finally {
        setRerunPending(false);
      }
    }, 8000);
  }, [user?.id, athleteId]);

  // Cleanup timer on unmount
  useEffect(() => () => { if (rerunTimerRef.current) clearTimeout(rerunTimerRef.current); }, []);

  // Log feedback event alongside override
  const logFeedback = async (feedbackType: string, reason?: string) => {
    if (!user || !plan) return;
    await supabase.from('feedback_events').insert({
      athlete_id: athleteId,
      agent_run_id: plan.agent_run_id || null,
      weekly_plan_id: plan.id,
      risk_prediction_id: riskPredictionId,
      feedback_type: feedbackType,
      reason: reason || null,
      given_by: user.id,
    });
  };

  const loadPlan = async () => {
    const [planRes, reportRes, predRes, profileRes] = await Promise.all([
      supabase.from('weekly_plans').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('risk_reports').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('risk_predictions').select('id').eq('athlete_id', athleteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('athlete_profiles').select('autonomy_level').eq('user_id', athleteId).maybeSingle(),
    ]);
    if (planRes.data) {
      setPlan(planRes.data);
      setOriginalSessions(planRes.data.original_plan as unknown as PlanSession[]);
      setAdjustedSessions(planRes.data.adjusted_plan as unknown as PlanSession[]);
      setIsLocked(planRes.data.locked_by_coach || false);
    }
    if (reportRes.data) setReport(reportRes.data);
    if (predRes.data) setRiskPredictionId(predRes.data.id);
    if (profileRes.data) setAutonomyLevel((profileRes.data as any).autonomy_level || 'auto_adjust');

    // Fetch athlete extra sessions
    const { data: extras } = await supabase
      .from('athlete_extra_sessions')
      .select('id, day, session_type, intensity, duration, notes, week_start')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false });
    setExtraSessions((extras as ExtraSession[]) || []);

    setLoading(false);
  };

  useEffect(() => { loadPlan(); }, [athleteId]);

  const logOverride = async (overrideType: string, sessionDay?: string, oldVals?: any, newVals?: any, reason?: string) => {
    if (!user || !plan) return;
    await supabase.from('coach_override_events').insert({
      coach_id: user.id,
      athlete_id: athleteId,
      weekly_plan_id: plan.id,
      override_type: overrideType,
      session_day: sessionDay || null,
      old_values: oldVals || {},
      new_values: newVals || {},
      reason: reason || null,
    });

    // Track coach override as autonomous agent interaction
    const eventMap: Record<string, string> = {
      accept_ai: 'coach_override_accepted',
      modify_session: 'coach_override_modified',
      revert_original: 'coach_override_rejected',
      lock_week: 'coach_override_modified',
    };
    const mappedEvent = eventMap[overrideType] || 'coach_override_modified';
    supabase.functions.invoke('paid-signal', {
      body: {
        event_name: mappedEvent,
        athlete_id: athleteId,
        details: {
          override_type: overrideType,
          session_day: sessionDay || null,
        },
      },
    }).catch(() => {});
  };

  const handleAcceptAI = async () => {
    if (!plan) return;
    await Promise.all([
      logOverride('accept_ai'),
      logFeedback('accepted'),
    ]);
    toast.success('AI plan accepted');
  };

  const handleRevert = async () => {
    if (!plan) return;
    const oldAdj = adjustedSessions;
    const { error } = await supabase.from('weekly_plans').update({ adjusted_plan: originalSessions as unknown as any }).eq('id', plan.id);
    if (error) { toast.error('Failed to revert'); return; }
    await Promise.all([
      logOverride('revert_original', undefined, { adjusted_plan: oldAdj }, { adjusted_plan: originalSessions }),
      logFeedback('rejected', 'Reverted to original plan'),
    ]);
    setAdjustedSessions([...originalSessions]);
    toast.success('Reverted to original plan');
    triggerDebouncedRerun();
  };

  const handleLockToggle = async () => {
    if (!plan || !user) return;
    const newLocked = !isLocked;
    const { error } = await supabase.from('weekly_plans').update({
      locked_by_coach: newLocked,
      locked_at: newLocked ? new Date().toISOString() : null,
      locked_by: newLocked ? user.id : null,
    }).eq('id', plan.id);
    if (error) { toast.error('Failed to update lock'); return; }
    await logOverride('lock_week', undefined, { locked: isLocked }, { locked: newLocked });
    setIsLocked(newLocked);
    toast.success(newLocked ? 'Week locked — agent will skip this plan' : 'Week unlocked');
  };

  const handleSaveSession = async (day: string) => {
    if (!plan) return;
    const idx = adjustedSessions.findIndex(s => s.day === day);
    if (idx === -1) return;
    const oldSession = { ...adjustedSessions[idx] };
    const newSessions = [...adjustedSessions];
    newSessions[idx] = { ...newSessions[idx], ...editValues };
    const { error } = await supabase.from('weekly_plans').update({ adjusted_plan: newSessions as unknown as any }).eq('id', plan.id);
    if (error) { toast.error('Failed to save'); return; }
    await Promise.all([
      logOverride('modify_session', day, oldSession, newSessions[idx]),
      logFeedback('modified', `Modified ${day}: ${JSON.stringify(editValues)}`),
    ]);
    setAdjustedSessions(newSessions);
    setEditingDay(null);
    toast.success(`${day} session updated`);
    triggerDebouncedRerun();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const handleAutonomyChange = async (newLevel: string) => {
    const { error } = await supabase
      .from('athlete_profiles')
      .update({ autonomy_level: newLevel } as any)
      .eq('user_id', athleteId);
    if (error) { toast.error('Failed to update autonomy level'); return; }
    setAutonomyLevel(newLevel);
    toast.success(`Autonomy level set to ${newLevel.replace('_', ' ')}`);
  };

  const autonomyBadgeColor = (level: string) => {
    if (level === 'suggest_only') return 'bg-muted text-muted-foreground';
    if (level === 'escalate') return 'bg-destructive/15 text-destructive';
    return 'bg-primary/15 text-primary';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h2 className="text-2xl font-heading font-bold">{athleteName}</h2>
          {report && <div className="flex items-center gap-2 mt-1"><RiskBadge level={report.risk_level} /><span className="text-sm text-muted-foreground">Score: {report.risk_score}</span></div>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Autonomy:</span>
          <Select value={autonomyLevel} onValueChange={handleAutonomyChange}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suggest_only">Suggest Only</SelectItem>
              <SelectItem value="auto_adjust">Auto-Adjust</SelectItem>
              <SelectItem value="escalate">Escalate All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Risk Summary */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Phase</p>
            <p className="font-heading font-bold capitalize text-lg">{report.phase || 'Unknown'}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Load Ratio</p>
            <p className={`font-heading font-bold text-lg ${report.acute_chronic_ratio > 1.5 ? 'text-destructive' : ''}`}>{report.acute_chronic_ratio?.toFixed(2) ?? '—'}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Soreness</p>
            <p className="font-heading font-bold text-lg">{report.soreness_contribution?.toFixed(0) ?? '—'}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Risk Score</p>
            <p className={`font-heading font-bold text-lg ${report.risk_score >= 75 ? 'risk-critical' : report.risk_score >= 55 ? 'risk-high' : report.risk_score >= 35 ? 'risk-medium' : 'text-primary'}`}>{report.risk_score}</p>
          </div>
        </div>
      )}

      <TopDrivers athleteId={athleteId} />

      {/* Plan Control */}
      {plan && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                {isLocked ? <Lock className="h-5 w-5 text-primary" /> : <Unlock className="h-5 w-5 text-muted-foreground" />}
                Weekly Plan Control
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAcceptAI}><CheckCircle2 className="h-3.5 w-3.5" /> Accept AI</Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleRevert}><RotateCcw className="h-3.5 w-3.5" /> Revert</Button>
                <Button size="sm" variant={isLocked ? 'default' : 'outline'} className="gap-1.5" onClick={handleLockToggle}>
                  {isLocked ? <><Lock className="h-3.5 w-3.5" /> Locked</> : <><Unlock className="h-3.5 w-3.5" /> Lock Week</>}
                </Button>
              </div>
            </div>
            {isLocked && <p className="text-xs text-primary mt-1">🔒 Locked — Agent Runner will not modify this plan</p>}
            {rerunPending && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Re-analysis queued — waiting for edits to settle…
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Original */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Original Plan</p>
                <div className="space-y-1.5">
                  {originalSessions.map(s => (
                    <div key={s.day} className="flex justify-between items-center bg-secondary/30 rounded-lg px-3 py-2 text-sm">
                      <span className="font-medium w-20">{s.day}</span>
                      <span>{s.type}</span>
                      <span className={s.intensity === 'High' ? 'text-destructive' : s.intensity === 'Medium' ? 'risk-medium' : 'text-primary'}>{s.intensity}</span>
                      <span className="text-muted-foreground">{s.duration}m</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI-Adjusted */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">AI-Adjusted Plan</p>
                <div className="space-y-1.5">
                  {adjustedSessions.map(s => {
                    const orig = originalSessions.find(o => o.day === s.day);
                    const changed = orig && (orig.type !== s.type || orig.intensity !== s.intensity || orig.duration !== s.duration);
                    return (
                      <div key={s.day} className={`flex justify-between items-center rounded-lg px-3 py-2 text-sm ${changed ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'}`}>
                        {editingDay === s.day ? (
                          <>
                            <span className="font-medium w-16">{s.day}</span>
                            <Select value={editValues.type || s.type} onValueChange={v => setEditValues(p => ({ ...p, type: v }))}>
                              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['Strength', 'Sprint', 'Recovery', 'Plyometrics', 'Match', 'Rest'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={editValues.intensity || s.intensity} onValueChange={v => setEditValues(p => ({ ...p, intensity: v }))}>
                              <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['Low', 'Medium', 'High'].map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="number" className="w-14 h-7 text-xs" value={editValues.duration ?? s.duration} onChange={e => setEditValues(p => ({ ...p, duration: Number(e.target.value) }))} />
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveSession(s.day)}><CheckCircle2 className="h-3 w-3 text-primary" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingDay(null)}><X className="h-3 w-3" /></Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-medium w-20">{s.day}</span>
                            <span>{s.type}</span>
                            <span className={s.intensity === 'High' ? 'text-destructive' : s.intensity === 'Medium' ? 'risk-medium' : 'text-primary'}>{s.intensity}</span>
                            <span className="text-muted-foreground">{s.duration}m</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingDay(s.day); setEditValues({ type: s.type, intensity: s.intensity, duration: s.duration }); }}>
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {plan.explanation && <p className="text-sm text-muted-foreground mt-4 bg-secondary/30 rounded-lg p-3">{rewriteForCoach(plan.explanation)}</p>}

            <div className="mt-4">
              <FeedbackButtons
                athleteId={athleteId}
                weeklyPlanId={plan.id}
                agentRunId={plan.agent_run_id}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Athlete Extra Sessions */}
      {extraSessions.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <User className="h-5 w-5 text-accent-foreground" />
              Athlete-Added Sessions
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Read-only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {extraSessions.map(extra => (
                <div key={extra.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3 bg-accent/20 border border-accent/30 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="font-medium w-20 sm:w-24">{extra.day}</span>
                    <span>{extra.session_type}</span>
                    <span className={extra.intensity === 'High' ? 'text-destructive' : extra.intensity === 'Medium' ? 'risk-medium' : 'text-primary'}>
                      {extra.intensity}
                    </span>
                    <span className="text-muted-foreground">{extra.duration}m</span>
                  </div>
                  {extra.notes && (
                    <span className="text-xs text-muted-foreground italic max-w-[200px] truncate">{extra.notes}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goals */}
      <GoalTracker athleteId={athleteId} />
    </div>
  );
}
