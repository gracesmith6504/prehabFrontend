import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { rewriteForCoach } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
  AlertTriangle, CheckCircle2, Eye, StickyNote,
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

  // ── Filter & deduplicate (latest per athlete per status) ──────────────

  const deduplicateByAthlete = (list: EnrichedEscalation[]) => {
    const seen = new Set<string>();
    return list.filter(e => {
      if (seen.has(e.athlete_id)) return false;
      seen.add(e.athlete_id);
      return true;
    });
  };

  const allByStatus = (status: string) => escalations.filter(e => e.status === status);
  const filtered = deduplicateByAthlete(allByStatus(tab));
  const counts = {
    open: deduplicateByAthlete(allByStatus('open')).length,
    acknowledged: deduplicateByAthlete(allByStatus('acknowledged')).length,
    resolved: deduplicateByAthlete(allByStatus('resolved')).length,
  };
  // Count all escalations per athlete for badge
  const countByAthlete = (athleteId: string, status: string) =>
    escalations.filter(e => e.athlete_id === athleteId && e.status === status).length;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <h1 className="font-heading text-xl sm:text-2xl font-bold uppercase tracking-wider">Escalation Queue</h1>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
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
                      alertCount={countByAthlete(esc.athlete_id, tab)}
                      onViewDetails={() => openDrawer(esc)}
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
              <SheetHeader className="space-y-1">
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-heading uppercase tracking-wider">
                    {selected.athlete_name}
                  </SheetTitle>
                  <RiskBadge level={selected.risk_level} />
                  <span className="font-heading font-bold tabular-nums" style={{ color: riskColor(selected.risk_score) }}>
                    {selected.risk_score}
                  </span>
                </div>
                <SheetDescription className="text-sm text-foreground/80">
                  {selected.trigger_reason.replace(/risk_level=\w+\s*\(score:\s*\d+\)/gi, '').trim() || selected.trigger_reason}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Actions bar */}
                {selected.status !== 'resolved' && (
                  <section className="flex flex-wrap gap-2">
                    {selected.status === 'open' && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { handleAcknowledge(selected); setDrawerOpen(false); }}>
                        <Eye className="h-3.5 w-3.5" /> Acknowledge
                      </Button>
                    )}
                    <Button size="sm" variant="default" className="gap-1.5" onClick={() => { setResolveTarget(selected); setResolveNote(''); setDrawerOpen(false); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => { setNoteTarget(selected); setNoteText(''); setDrawerOpen(false); }}>
                      <StickyNote className="h-3.5 w-3.5" /> Add Note
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => { setPhysioTarget(selected); setPhysioDate(undefined); setPhysioTime('09:00'); setPhysioNote(''); setDrawerOpen(false); }}>
                      <Stethoscope className="h-3.5 w-3.5" /> Physio Review
                    </Button>
                  </section>
                )}

                {/* Compact metrics row */}
                <section>
                  <div className="grid grid-cols-4 gap-2">
                    <MetricCard label="Risk" value={selected.risk_score} />
                    <MetricCard label="Phase" value={selected.phase} />
                    <MetricCard label="ACR" value={selected.acr.toFixed(2)} />
                    <MetricCard label="Soreness" value={selected.soreness} />
                  </div>
                </section>

                {/* Top drivers — plain language */}
                {selected.top_drivers.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Key Drivers</h3>
                    <div className="space-y-1.5">
                      {selected.top_drivers.slice(0, 3).map((d, i) => (
                        <p key={i} className={`text-sm ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {i === 0 && <TrendingUp className="h-3.5 w-3.5 inline mr-1.5 text-primary" />}
                          {d.feature}: {typeof d.value === 'number' ? d.value.toFixed(1) : d.value}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                {/* Plan Adjustments Applied */}
                {selected.explanation && (
                  <section className="space-y-2">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Plan Adjustments Applied</h3>
                    <div className="text-sm text-foreground leading-relaxed rounded-lg border border-border bg-secondary/30 p-3">
                      {rewriteForCoach(selected.explanation)}
                    </div>
                  </section>
                )}

                {/* Notes */}
                {selected.notes && (
                  <section className="space-y-2">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Notes</h3>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border border-border p-3 font-body">{selected.notes}</pre>
                  </section>
                )}

                {/* Compact status summary */}
                <section className="space-y-2">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground">Status</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Created {format(new Date(selected.created_at), 'MMM d, HH:mm')}</span>
                    {selected.acknowledged_at && <span>· Acknowledged {format(new Date(selected.acknowledged_at), 'MMM d, HH:mm')}</span>}
                    {selected.resolved_at && <span>· Resolved {format(new Date(selected.resolved_at), 'MMM d, HH:mm')}</span>}
                  </div>
                </section>

                {/* Technical Details — collapsed accordion */}
                <Accordion type="single" collapsible>
                  <AccordionItem value="technical" className="border-border/50">
                    <AccordionTrigger className="text-xs text-muted-foreground font-heading uppercase tracking-wider hover:no-underline py-2">
                      Technical Details
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-1">
                        {drawerLoading ? (
                          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>
                        ) : drawerActions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No recent agent actions.</p>
                        ) : (
                          drawerActions.map(a => (
                            <div key={a.id} className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <ActionIcon type={a.action_type} />
                                <span className="capitalize">{a.action_type}</span>
                              </div>
                              <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EscalationItem({ esc, index, alertCount, onViewDetails }: {
  esc: EnrichedEscalation;
  index: number;
  alertCount: number;
  onViewDetails: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-4 space-y-2.5 hover:border-muted-foreground/20 transition-colors cursor-pointer"
      onClick={onViewDetails}
    >
      {/* Row 1: athlete name + risk badge + score + time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-heading font-bold text-foreground truncate">{esc.athlete_name}</span>
          {alertCount > 1 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{alertCount} alerts</Badge>
          )}
          <RiskBadge level={esc.risk_level} />
          <span className="font-heading font-bold tabular-nums" style={{ color: riskColor(esc.risk_score) }}>
            {esc.risk_score}
          </span>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(esc.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Row 2: compact metadata */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="capitalize">{esc.phase}</span>
        <span>ACR {esc.acr.toFixed(2)}</span>
        <span>Soreness {esc.soreness}</span>
      </div>

      {/* Row 3: primary driver */}
      {esc.top_drivers[0] && (
        <p className="text-sm text-foreground">
          <TrendingUp className="h-3.5 w-3.5 inline mr-1.5 text-muted-foreground" />
          {esc.top_drivers[0].feature}
          <span className="text-muted-foreground ml-1.5">({Math.round(esc.top_drivers[0].contribution * 100)}%)</span>
        </p>
      )}

      {/* Row 4: single action */}
      <div className="flex justify-end pt-1">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
          <Eye className="h-3.5 w-3.5" /> View Details
        </Button>
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
