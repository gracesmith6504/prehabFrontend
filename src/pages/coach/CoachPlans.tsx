import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import RiskBadge from '@/components/RiskBadge';
import CoachAthleteDetail from '@/components/coach/CoachAthleteDetail';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { format, startOfWeek, addDays } from 'date-fns';
import {
  ClipboardList, Plus, Copy, Trash2, Edit3, Save, X, CalendarIcon,
  Users, User, Send, Eye, Loader2,
} from 'lucide-react';

// Types
interface PlanSession {
  day: string;
  type: string;
  intensity: string;
  duration: number;
  notes: string;
}

interface Template {
  id: string;
  coach_id: string;
  name: string;
  sessions: PlanSession[];
  created_at: string;
  updated_at: string;
}

interface AthleteWithPlan {
  athlete_id: string;
  full_name: string;
  plan_owner_type: string | null;
  risk_level: string;
  risk_score: number;
  last_agent_run: string | null;
  weekly_plan_id: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SESSION_TYPES = ['Strength', 'Sprint', 'Recovery', 'Plyometrics', 'Match', 'Rest'];
const INTENSITIES = ['Low', 'Medium', 'High'];

function emptySession(day: string): PlanSession {
  return { day, type: 'Rest', intensity: 'Low', duration: 0, notes: '' };
}

function defaultSessions(): PlanSession[] {
  return DAYS.map(d => emptySession(d));
}

export default function CoachPlans() {
  const { user } = useAuth();
  const [tab, setTab] = useState('templates');

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Builder state
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [builderName, setBuilderName] = useState('');
  const [builderSessions, setBuilderSessions] = useState<PlanSession[]>(defaultSessions());
  const [savingBuilder, setSavingBuilder] = useState(false);

  // Assign state
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignWholeSquad, setAssignWholeSquad] = useState(true);
  const [assignAthleteId, setAssignAthleteId] = useState('');
  const [assignDate, setAssignDate] = useState<Date | undefined>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [assigning, setAssigning] = useState(false);

  // Athletes state (shared by Assign + Applied)
  const [athletes, setAthletes] = useState<AthleteWithPlan[]>([]);
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  // Athlete detail
  const [selectedAthlete, setSelectedAthlete] = useState<{ id: string; name: string } | null>(null);

  // ─── DATA LOADING ───

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('coach_plan_templates')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false });
    setTemplates((data as unknown as Template[]) || []);
    setLoadingTemplates(false);
  }, [user]);

  const loadAthletes = useCallback(async () => {
    if (!user) return;
    setLoadingAthletes(true);

    // Get athlete IDs assigned to this coach
    const { data: profiles } = await supabase
      .from('athlete_profiles')
      .select('user_id')
      .eq('coach_id', user.id);

    if (!profiles?.length) {
      setAthletes([]);
      setLoadingAthletes(false);
      return;
    }

    const ids = profiles.map(p => p.user_id);

    // Fetch names, latest plans, risk reports, agent actions in parallel
    const [namesRes, plansRes, reportsRes, actionsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', ids),
      supabase.from('weekly_plans').select('athlete_id, id, plan_owner_type, risk_level, risk_score, created_at').in('athlete_id', ids).order('created_at', { ascending: false }),
      supabase.from('risk_reports').select('athlete_id, risk_level, risk_score, created_at').in('athlete_id', ids).order('created_at', { ascending: false }),
      supabase.from('agent_actions').select('athlete_id, created_at').in('athlete_id', ids).order('created_at', { ascending: false }),
    ]);

    const nameMap = new Map((namesRes.data || []).map(n => [n.user_id, n.full_name || 'Unknown']));

    // Latest per athlete
    const latestPlan = new Map<string, any>();
    (plansRes.data || []).forEach(p => { if (!latestPlan.has(p.athlete_id)) latestPlan.set(p.athlete_id, p); });

    const latestReport = new Map<string, any>();
    (reportsRes.data || []).forEach(r => { if (!latestReport.has(r.athlete_id)) latestReport.set(r.athlete_id, r); });

    const latestAction = new Map<string, string>();
    (actionsRes.data || []).forEach(a => { if (!latestAction.has(a.athlete_id)) latestAction.set(a.athlete_id, a.created_at); });

    const result: AthleteWithPlan[] = ids.map(id => {
      const plan = latestPlan.get(id);
      const report = latestReport.get(id);
      return {
        athlete_id: id,
        full_name: nameMap.get(id) || 'Unknown',
        plan_owner_type: plan?.plan_owner_type || null,
        risk_level: report?.risk_level || plan?.risk_level || 'Low',
        risk_score: report?.risk_score ?? plan?.risk_score ?? 0,
        last_agent_run: latestAction.get(id) || null,
        weekly_plan_id: plan?.id || null,
      };
    });

    setAthletes(result.sort((a, b) => b.risk_score - a.risk_score));
    setLoadingAthletes(false);
  }, [user]);

  useEffect(() => {
    loadTemplates();
    loadAthletes();
  }, [loadTemplates, loadAthletes]);

  // ─── TEMPLATE CRUD ───

  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setBuilderName('');
    setBuilderSessions(defaultSessions());
    setTab('builder');
  };

  const handleEditTemplate = (t: Template) => {
    setEditingTemplate(t);
    setBuilderName(t.name);
    // Ensure all 7 days exist
    const sessionMap = new Map(t.sessions.map(s => [s.day, s]));
    setBuilderSessions(DAYS.map(d => sessionMap.get(d) || emptySession(d)));
    setTab('builder');
  };

  const handleDuplicateTemplate = async (t: Template) => {
    if (!user) return;
    const { error } = await supabase.from('coach_plan_templates').insert({
      coach_id: user.id,
      name: `${t.name} (copy)`,
      sessions: t.sessions as unknown as any,
    } as any);
    if (error) { toast.error('Failed to duplicate'); return; }
    toast.success('Template duplicated');
    loadTemplates();
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('coach_plan_templates').delete().eq('id', deleteTarget.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Template deleted');
    setDeleteTarget(null);
    loadTemplates();
  };

  const handleSaveBuilder = async () => {
    if (!user || !builderName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    setSavingBuilder(true);
    if (editingTemplate) {
      const { error } = await supabase.from('coach_plan_templates')
        .update({ name: builderName, sessions: builderSessions as unknown as any, updated_at: new Date().toISOString() } as any)
        .eq('id', editingTemplate.id);
      if (error) { toast.error('Failed to save'); setSavingBuilder(false); return; }
      toast.success('Template updated');
    } else {
      const { error } = await supabase.from('coach_plan_templates').insert({
        coach_id: user.id,
        name: builderName,
        sessions: builderSessions as unknown as any,
      } as any);
      if (error) { toast.error('Failed to create'); setSavingBuilder(false); return; }
      toast.success('Template created');
    }
    setSavingBuilder(false);
    loadTemplates();
    setTab('templates');
  };

  const updateSession = (day: string, field: keyof PlanSession, value: any) => {
    setBuilderSessions(prev => prev.map(s => s.day === day ? { ...s, [field]: value } : s));
  };

  // ─── ASSIGN ───

  const handleAssign = async () => {
    if (!user || !assignTemplateId || !assignDate) {
      toast.error('Please select a template and date');
      return;
    }
    const template = templates.find(t => t.id === assignTemplateId);
    if (!template) return;

    const targetIds = assignWholeSquad
      ? athletes.map(a => a.athlete_id)
      : [assignAthleteId].filter(Boolean);

    if (!targetIds.length) {
      toast.error('No athletes selected');
      return;
    }

    setAssigning(true);
    let successCount = 0;

    for (const athleteId of targetIds) {
      // Check if plan exists for this athlete
      const existing = athletes.find(a => a.athlete_id === athleteId);

      if (existing?.weekly_plan_id) {
        // Update existing plan
        const { error } = await supabase.from('weekly_plans').update({
          original_plan: template.sessions as unknown as any,
          adjusted_plan: template.sessions as unknown as any,
          plan_owner_type: 'coach',
          locked_by_coach: false,
          last_updated: new Date().toISOString(),
        } as any).eq('id', existing.weekly_plan_id);
        if (!error) successCount++;
      } else {
        // Insert new plan
        const { error } = await supabase.from('weekly_plans').insert({
          athlete_id: athleteId,
          original_plan: template.sessions as unknown as any,
          adjusted_plan: template.sessions as unknown as any,
          plan_owner_type: 'coach',
          locked_by_coach: false,
          risk_score: existing?.risk_score ?? 0,
          risk_level: existing?.risk_level ?? 'Low',
        } as any);
        if (!error) successCount++;
      }
    }

    setAssigning(false);
    toast.success(`Plan assigned to ${successCount} athlete${successCount !== 1 ? 's' : ''}`);
    loadAthletes();
  };

  // ─── ATHLETE DETAIL VIEW ───

  if (selectedAthlete) {
    return (
      <AppLayout>
        <CoachAthleteDetail
          athleteId={selectedAthlete.id}
          athleteName={selectedAthlete.name}
          onBack={() => { setSelectedAthlete(null); loadAthletes(); }}
        />
      </AppLayout>
    );
  }

  // ─── HELPERS ───

  const sessionSummary = (sessions: PlanSession[]) => {
    const active = sessions.filter(s => s.type !== 'Rest');
    return `${active.length} sessions, ${sessions.reduce((a, s) => a + s.duration, 0)}min total`;
  };

  const Spinner = () => (
    <div className="flex items-center justify-center h-32">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Plans</h1>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="assign">Assign</TabsTrigger>
            <TabsTrigger value="applied">Applied Plans</TabsTrigger>
          </TabsList>

          {/* ─── TAB 1: TEMPLATES ─── */}
          <TabsContent value="templates">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
              <Button size="sm" className="gap-1.5" onClick={handleCreateTemplate}>
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </div>

            {loadingTemplates ? <Spinner /> : templates.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No templates yet. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="glass-card hover:border-primary/30 transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-heading">{t.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-3">{sessionSummary(t.sessions)}</p>
                        <p className="text-xs text-muted-foreground mb-4">
                          Created {format(new Date(t.created_at), 'MMM d, yyyy')}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="gap-1 flex-1" onClick={() => handleEditTemplate(t)}>
                            <Edit3 className="h-3 w-3" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleDuplicateTemplate(t)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB 2: BUILDER ─── */}
          <TabsContent value="builder">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Template Name</Label>
                  <Input
                    value={builderName}
                    onChange={e => setBuilderName(e.target.value)}
                    placeholder="e.g. Pre-Season High Load"
                    className="mt-1"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Weekly Schedule</Label>
                  {builderSessions.map(session => (
                    <div key={session.day} className="grid grid-cols-2 sm:grid-cols-[80px_1fr_1fr_70px_1fr] gap-2 items-center bg-secondary/30 rounded-lg p-2">
                      <span className="text-sm font-medium">{session.day.slice(0, 3)}</span>
                      <Select value={session.type} onValueChange={v => updateSession(session.day, 'type', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={session.intensity} onValueChange={v => updateSession(session.day, 'intensity', v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {INTENSITIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="h-8 text-xs"
                        value={session.duration}
                        onChange={e => updateSession(session.day, 'duration', Number(e.target.value))}
                        placeholder="min"
                      />
                      <Input
                        className="h-8 text-xs"
                        value={session.notes}
                        onChange={e => updateSession(session.day, 'notes', e.target.value)}
                        placeholder="Notes"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="gap-1.5" onClick={handleSaveBuilder} disabled={savingBuilder}>
                    {savingBuilder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingTemplate ? 'Update' : 'Save'} Template
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => setTab('templates')}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 3: ASSIGN ─── */}
          <TabsContent value="assign">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Assign Plan to Athletes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Step 1: Template */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">1. Select Template</Label>
                  <Select value={assignTemplateId} onValueChange={setAssignTemplateId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a template..." /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {templates.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">No templates yet — create one in the Builder tab first.</p>
                  )}
                </div>

                {/* Step 2: Target */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">2. Assignment Target</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={assignWholeSquad} onCheckedChange={setAssignWholeSquad} />
                      <span className="text-sm flex items-center gap-1.5">
                        {assignWholeSquad ? <><Users className="h-4 w-4 text-primary" /> Entire Squad</> : <><User className="h-4 w-4" /> Single Athlete</>}
                      </span>
                    </div>
                  </div>
                  {!assignWholeSquad && (
                    <Select value={assignAthleteId} onValueChange={setAssignAthleteId}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="Select athlete..." /></SelectTrigger>
                      <SelectContent>
                        {athletes.map(a => (
                          <SelectItem key={a.athlete_id} value={a.athlete_id}>{a.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Step 3: Date */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">3. Week Start Date (Monday)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="mt-1 w-full justify-start text-left font-normal gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        {assignDate ? format(assignDate, 'MMM d, yyyy') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={assignDate}
                        onSelect={(d) => {
                          if (d) setAssignDate(startOfWeek(d, { weekStartsOn: 1 }));
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Assign button */}
                <Button className="gap-1.5 w-full" onClick={handleAssign} disabled={assigning || !assignTemplateId}>
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Assign Plan to {assignWholeSquad ? `${athletes.length} Athletes` : '1 Athlete'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── TAB 4: APPLIED PLANS ─── */}
          <TabsContent value="applied">
            {loadingAthletes ? <Spinner /> : athletes.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No athletes assigned to you yet.</p>
              </div>
            ) : (
              <Card className="glass-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Athlete</TableHead>
                      <TableHead>Plan Source</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Last Agent Run</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {athletes.map((a, i) => (
                      <motion.tr
                        key={a.athlete_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell className="font-medium">{a.full_name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                            a.plan_owner_type === 'coach'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-secondary text-muted-foreground'
                          }`}>
                            {a.plan_owner_type || 'athlete'}
                          </span>
                        </TableCell>
                        <TableCell><RiskBadge level={a.risk_level} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.last_agent_run ? format(new Date(a.last_agent_run), 'MMM d, HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => setSelectedAthlete({ id: a.athlete_id, name: a.full_name })}
                          >
                            <Eye className="h-3 w-3" /> View Diffs
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTemplate}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
