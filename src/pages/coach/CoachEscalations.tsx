import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Eye, StickyNote, ExternalLink,
  Clock, Activity, Zap, TrendingUp, ShieldAlert, Loader2,
  CalendarIcon, Stethoscope,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────────────

interface TopDriver {
  feature: string;
  value: number | string;
  contribution: number;
}

interface EscalationRow {
  id: string;
  athlete_id: string;
  trigger_reason: string;
  status: string;
  created_at: string;
  notes: string | null;
  risk_prediction_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  agent_run_id: string | null;
}

interface EnrichedEscalation extends EscalationRow {
  athlete_name: string;
  athlete_email: string;
  risk_score: number;
  risk_level: string;
  phase: string;
  acr: number;
  soreness: number;
  top_drivers: TopDriver[];
  explanation: string;
}

interface AgentAction {
  id: string;
  action_type: string;
  created_at: string;
  details: Record<string, any> | null;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CoachEscalations() {
  const { user } = useAuth();
  const [escalations, setEscalations] = useState<EnrichedEscalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('open');

  // Detail drawer
  const [selected, setSelected] = useState<EnrichedEscalation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerActions, setDrawerActions] = useState<AgentAction[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Resolve dialog
  const [resolveTarget, setResolveTarget] = useState<EnrichedEscalation | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Add note dialog
  const [noteTarget, setNoteTarget] = useState<EnrichedEscalation | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Physio review dialog
  const [physioTarget, setPhysioTarget] = useState<EnrichedEscalation | null>(null);
  const [physioDate, setPhysioDate] = useState<Date | undefined>(undefined);
  const [physioTime, setPhysioTime] = useState('09:00');
  const [physioNote, setPhysioNote] = useState('');
  const [schedulingPhysio, setSchedulingPhysio] = useState(false);

  // ── Load escalations ────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: rows, error } = await supabase
      .from('escalations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !rows) {
      toast.error('Failed to load escalations');
      setLoading(false);
      return;
    }

    // Enrich each escalation with athlete profile + latest risk report
    const athleteIds = [...new Set(rows.map(r => r.athlete_id))];

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', athleteIds);

    // Fetch latest risk report per athlete
    const { data: reports } = await supabase
      .from('risk_reports')
      .select('athlete_id, risk_score, risk_level, phase, acute_chronic_ratio, soreness_contribution, explanation, created_at')
      .in('athlete_id', athleteIds)
      .order('created_at', { ascending: false });

    // Fetch latest risk predictions for top drivers
    const { data: predictions } = await supabase
      .from('risk_predictions')
      .select('athlete_id, top_drivers, risk_score, risk_level')
      .in('athlete_id', athleteIds)
      .order('created_at', { ascending: false });

    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);
    // Build maps for latest per athlete
    const reportMap = new Map<string, typeof reports extends (infer T)[] | null ? T : never>();
    reports?.forEach(r => { if (!reportMap.has(r.athlete_id)) reportMap.set(r.athlete_id, r); });

    const predMap = new Map<string, typeof predictions extends (infer T)[] | null ? T : never>();
    predictions?.forEach(p => { if (!predMap.has(p.athlete_id)) predMap.set(p.athlete_id, p); });

    const enriched: EnrichedEscalation[] = rows.map(row => {
      const prof = profileMap.get(row.athlete_id);
      const report = reportMap.get(row.athlete_id);
      const pred = predMap.get(row.athlete_id);
      return {
        ...row,
        athlete_name: prof?.full_name ?? 'Unknown',
        athlete_email: prof?.email ?? '',
        risk_score: report?.risk_score ?? pred?.risk_score ?? 0,
        risk_level: report?.risk_level ?? pred?.risk_level ?? 'Low',
        phase: report?.phase ?? 'unknown',
        acr: report?.acute_chronic_ratio ?? 0,
        soreness: report?.soreness_contribution ?? 0,
        top_drivers: (pred?.top_drivers as unknown as TopDriver[]) ?? [],
        explanation: report?.explanation ?? '',
      };
    });

    // Sort: highest risk first, then most recent
    enriched.sort((a, b) => b.risk_score - a.risk_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setEscalations(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleAcknowledge = async (esc: EnrichedEscalation) => {
    if (!user) return;
    const { error } = await supabase
      .from('escalations')
      .update({
        status: 'acknowledged',
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', esc.id);
    if (error) { toast.error('Update failed'); return; }
    toast.success('Escalation acknowledged');
    loadData();
  };

  const handleResolve = async () => {
    if (!user || !resolveTarget) return;
    if (!resolveNote.trim()) { toast.error('Resolution note is required'); return; }
    setResolving(true);
    const { error } = await supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        notes: resolveTarget.notes
          ? `${resolveTarget.notes}\n---\n[Resolved] ${resolveNote.trim()}`
          : `[Resolved] ${resolveNote.trim()}`,
      })
      .eq('id', resolveTarget.id);
    setResolving(false);
    if (error) { toast.error('Resolve failed'); return; }
    toast.success('Escalation resolved');
    setResolveTarget(null);
    setResolveNote('');
    loadData();
  };

  const handleAddNote = async () => {
    if (!user || !noteTarget) return;
    if (!noteText.trim()) { toast.error('Note cannot be empty'); return; }
    setSavingNote(true);
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
    const entry = `[${timestamp}] ${noteText.trim()}`;
    const { error } = await supabase
      .from('escalations')
      .update({
        notes: noteTarget.notes ? `${noteTarget.notes}\n${entry}` : entry,
      })
      .eq('id', noteTarget.id);
    setSavingNote(false);
    if (error) { toast.error('Failed to save note'); return; }
    toast.success('Note added');
    setNoteTarget(null);
    setNoteText('');
    loadData();
  };

  // ── Schedule Physio Review ──────────────────────────────────────────────

  const handleSchedulePhysio = async () => {
    if (!user || !physioTarget || !physioDate) return;
    setSchedulingPhysio(true);

    const [hours, minutes] = physioTime.split(':').map(Number);
    const followUpAt = new Date(physioDate);
    followUpAt.setHours(hours, minutes, 0, 0);

    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
    const noteEntry = `[${timestamp}] Physio review scheduled for ${format(followUpAt, 'MMM d, yyyy HH:mm')}${physioNote.trim() ? ': ' + physioNote.trim() : ''}`;

    const { error } = await supabase
      .from('escalations')
      .update({
        status: 'acknowledged',
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
        follow_up_at: followUpAt.toISOString(),
        notes: physioTarget.notes ? `${physioTarget.notes}\n${noteEntry}` : noteEntry,
      } as any)
      .eq('id', physioTarget.id);

    setSchedulingPhysio(false);
    if (error) { toast.error('Failed to schedule'); return; }
    toast.success(`Physio review scheduled for ${format(followUpAt, 'MMM d, HH:mm')}`);
    setPhysioTarget(null);
    setPhysioDate(undefined);
    setPhysioTime('09:00');
    setPhysioNote('');
    loadData();
  };

  // ── Detail drawer ─────────────────────────────────────────────────────

  const openDrawer = async (esc: EnrichedEscalation) => {
    setSelected(esc);
    setDrawerOpen(true);
    setDrawerLoading(true);

    // Load recent agent actions for this athlete
    const { data } = await supabase
      .from('agent_actions')
      .select('id, action_type, created_at, details')
      .eq('athlete_id', esc.athlete_id)
      .order('created_at', { ascending: false })
      .limit(10);

    setDrawerActions((data as AgentAction[]) ?? []);
    setDrawerLoading(false);
  };

  // ── Filter ────────────────────────────────────────────────────────────

  const filtered = escalations.filter(e => e.status === tab);
  const counts = {
    open: escalations.filter(e => e.status === 'open').length,
    acknowledged: escalations.filter(e => e.status === 'acknowledged').length,
    resolved: escalations.filter(e => e.status === 'resolved').length,
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Escalation Queue</h1>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="open" className="gap-2 data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> New {counts.open > 0 && <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">{counts.open}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="acknowledged" className="gap-2">
              <Eye className="h-3.5 w-3.5" /> Acknowledged {counts.acknowledged > 0 && <Badge className="ml-1 h-5 min-w-5 px-1 bg-warning/20 text-warning border-warning/30">{counts.acknowledged}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Resolved {counts.resolved > 0 && <Badge className="ml-1 h-5 min-w-5 px-1 bg-primary/20 text-primary border-primary/30">{counts.resolved}</Badge>}
            </TabsTrigger>
          </TabsList>

          {['open', 'acknowledged', 'resolved'].map(status => (
            <TabsContent key={status} value={status} className="mt-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState status={status} />
              ) : (
                <div className="space-y-3">
                  {filtered.map((esc, i) => (
                    <EscalationItem
                      key={esc.id}
                      esc={esc}
                      index={i}
                      onAcknowledge={() => handleAcknowledge(esc)}
                      onResolve={() => { setResolveTarget(esc); setResolveNote(''); }}
                      onAddNote={() => { setNoteTarget(esc); setNoteText(''); }}
                      onViewDetails={() => openDrawer(esc)}
                      onSchedulePhysio={() => { setPhysioTarget(esc); setPhysioDate(undefined); setPhysioTime('09:00'); setPhysioNote(''); }}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* ── Resolve Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!resolveTarget} onOpenChange={open => { if (!open) setResolveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider">Resolve Escalation</DialogTitle>
            <DialogDescription>Provide a resolution note for {resolveTarget?.athlete_name}.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe resolution actions taken..."
            value={resolveNote}
            onChange={e => setResolveNote(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)}>Cancel</Button>
            <Button onClick={handleResolve} disabled={resolving || !resolveNote.trim()} className="gap-2">
              {resolving && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" /> Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Note Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!noteTarget} onOpenChange={open => { if (!open) setNoteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider">Add Note</DialogTitle>
            <DialogDescription>Add a note to {noteTarget?.athlete_name}'s escalation.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter note..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button onClick={handleAddNote} disabled={savingNote || !noteText.trim()} className="gap-2">
              {savingNote && <Loader2 className="h-4 w-4 animate-spin" />}
              <StickyNote className="h-4 w-4" /> Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Physio Dialog ──────────────────────────────────────── */}
      <Dialog open={!!physioTarget} onOpenChange={open => { if (!open) setPhysioTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              Schedule Physio Review
            </DialogTitle>
            <DialogDescription>Schedule a physio review for {physioTarget?.athlete_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !physioDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {physioDate ? format(physioDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={physioDate}
                    onSelect={setPhysioDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input type="time" value={physioTime} onChange={e => setPhysioTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="e.g. Focus on knee assessment, check hamstring flexibility..."
                value={physioNote}
                onChange={e => setPhysioNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPhysioTarget(null)}>Cancel</Button>
            <Button onClick={handleSchedulePhysio} disabled={schedulingPhysio || !physioDate} className="gap-2">
              {schedulingPhysio && <Loader2 className="h-4 w-4 animate-spin" />}
              <Stethoscope className="h-4 w-4" /> Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-heading uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  {selected.athlete_name}
                </SheetTitle>
                <SheetDescription>{selected.trigger_reason}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Risk breakdown */}
                <section className="space-y-3">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Risk Breakdown</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Risk Score" value={selected.risk_score} />
                    <MetricCard label="Phase" value={selected.phase} />
                    <MetricCard label="AC Ratio" value={selected.acr.toFixed(2)} />
                    <MetricCard label="Soreness" value={selected.soreness} />
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskBadge level={selected.risk_level} />
                  </div>
                </section>

                {/* Top drivers */}
                {selected.top_drivers.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Drivers</h3>
                    <div className="space-y-2">
                      {selected.top_drivers.slice(0, 3).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{d.feature}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{typeof d.value === 'number' ? d.value.toFixed(1) : d.value}</span>
                            <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(d.contribution * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{Math.round(d.contribution * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Explanation */}
                {selected.explanation && (
                  <section className="space-y-2">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Agent Explanation</h3>
                    <p className="text-sm text-foreground leading-relaxed glass-card p-3">{selected.explanation}</p>
                  </section>
                )}

                {/* Notes */}
                {selected.notes && (
                  <section className="space-y-2">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h3>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap glass-card p-3 font-body">{selected.notes}</pre>
                  </section>
                )}

                {/* Recent agent actions */}
                <section className="space-y-3">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Agent Actions</h3>
                  {drawerLoading ? (
                    <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
                  ) : drawerActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent agent actions.</p>
                  ) : (
                    <div className="space-y-2">
                      {drawerActions.map(a => (
                        <div key={a.id} className="flex items-start gap-3 text-sm glass-card p-3">
                          <ActionIcon type={a.action_type} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold capitalize text-foreground">{a.action_type}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                            </div>
                            {a.details && a.action_type === 'act' && a.details.changes && (
                              <ul className="mt-1 text-xs text-muted-foreground list-disc list-inside">
                                {(a.details.changes as string[]).slice(0, 3).map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Timeline */}
                <section className="space-y-2">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <TimelineEntry icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />} label="Created" time={selected.created_at} />
                    {selected.acknowledged_at && <TimelineEntry icon={<Eye className="h-3.5 w-3.5 text-warning" />} label="Acknowledged" time={selected.acknowledged_at} />}
                    {selected.resolved_at && <TimelineEntry icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />} label="Resolved" time={selected.resolved_at} />}
                  </div>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EscalationItem({ esc, index, onAcknowledge, onResolve, onAddNote, onViewDetails, onSchedulePhysio }: {
  esc: EnrichedEscalation;
  index: number;
  onAcknowledge: () => void;
  onResolve: () => void;
  onAddNote: () => void;
  onViewDetails: () => void;
  onSchedulePhysio: () => void;
}) {
  const borderClass =
    esc.status === 'open' ? 'border-destructive/30' :
    esc.status === 'acknowledged' ? 'border-warning/30' :
    'border-primary/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-card p-4 space-y-3 border ${borderClass}`}
    >
      {/* Row 1: athlete + risk badge + time */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="font-heading font-bold text-foreground">{esc.athlete_name}</span>
          <RiskBadge level={esc.risk_level} />
          <span className="font-heading font-bold text-lg" style={{ color: riskColor(esc.risk_score) }}>
            {esc.risk_score}
          </span>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(esc.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Row 2: metrics */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>Phase: <strong className="text-foreground capitalize">{esc.phase}</strong></span>
        <span>ACR: <strong className="text-foreground">{esc.acr.toFixed(2)}</strong></span>
        <span>Soreness: <strong className="text-foreground">{esc.soreness}</strong></span>
        {esc.top_drivers[0] && (
          <span>Top Driver: <strong className="text-foreground">{esc.top_drivers[0].feature} ({Math.round(esc.top_drivers[0].contribution * 100)}%)</strong></span>
        )}
      </div>

      {/* Row 3: trigger reason */}
      <p className="text-sm text-muted-foreground">{esc.trigger_reason}</p>

      {/* Row 4: actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onViewDetails}>
          <ExternalLink className="h-3.5 w-3.5" /> Details
        </Button>
        {esc.status === 'open' && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onAcknowledge}>
            <Eye className="h-3.5 w-3.5" /> Acknowledge
          </Button>
        )}
        {esc.status !== 'resolved' && (
          <Button size="sm" variant="default" className="gap-1.5" onClick={onResolve}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={onAddNote}>
          <StickyNote className="h-3.5 w-3.5" /> Note
        </Button>
        {esc.status !== 'resolved' && (
          <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={onSchedulePhysio}>
            <Stethoscope className="h-3.5 w-3.5" /> Physio Review
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ status }: { status: string }) {
  const label = status === 'open' ? 'No new escalations' : status === 'acknowledged' ? 'No acknowledged escalations' : 'No resolved escalations';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
        {status === 'open' ? <ShieldAlert className="h-8 w-8 text-muted-foreground" /> :
         status === 'acknowledged' ? <Eye className="h-8 w-8 text-muted-foreground" /> :
         <CheckCircle2 className="h-8 w-8 text-muted-foreground" />}
      </div>
      <p className="text-muted-foreground font-medium">{label}</p>
      <p className="text-sm text-muted-foreground mt-1">
        {status === 'open' ? 'All athletes are within safe risk thresholds.' : 'Items will appear here when escalations are processed.'}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-heading font-bold text-foreground capitalize">{value}</p>
    </div>
  );
}

function TimelineEntry({ icon, label, time }: { icon: React.ReactNode; label: string; time: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-foreground font-medium">{label}</span>
      <span className="text-muted-foreground ml-auto">{format(new Date(time), 'MMM d, HH:mm')}</span>
    </div>
  );
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'observe': return <Eye className="h-4 w-4 text-muted-foreground mt-0.5" />;
    case 'predict': return <TrendingUp className="h-4 w-4 text-primary mt-0.5" />;
    case 'act': return <Zap className="h-4 w-4 text-warning mt-0.5" />;
    case 'justify': return <Activity className="h-4 w-4 text-foreground mt-0.5" />;
    default: return <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />;
  }
}

function riskColor(score: number): string {
  if (score > 80) return 'hsl(0, 72%, 51%)';
  if (score > 60) return 'hsl(45, 93%, 47%)';
  return 'hsl(110, 100%, 55%)';
}
