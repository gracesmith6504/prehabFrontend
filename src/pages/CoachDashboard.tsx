import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import RiskBadge from '@/components/RiskBadge';
import { Shield, Users, AlertTriangle, Activity, TrendingDown, TrendingUp, Bell, CalendarCheck, StickyNote, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface AthleteInfo {
  user_id: string;
  email: string;
  full_name: string | null;
  latestReport: {
    risk_score: number;
    risk_level: string;
    escalation_status: string;
    explanation: string | null;
    phase: string | null;
    acute_chronic_ratio?: number;
    soreness_contribution?: number;
  } | null;
}

// Mock soccer team data
const MOCK_ATHLETES: AthleteInfo[] = [
  {
    user_id: 'mock-1', email: 'sarah.jones@team.com', full_name: 'Sarah Jones',
    latestReport: { risk_score: 82, risk_level: 'High', escalation_status: 'escalated', explanation: 'High acute:chronic ratio (1.6) combined with ovulatory phase. Elevated hamstring soreness (7/10).', phase: 'ovulatory', acute_chronic_ratio: 1.6, soreness_contribution: 28 },
  },
  {
    user_id: 'mock-2', email: 'emma.chen@team.com', full_name: 'Emma Chen',
    latestReport: { risk_score: 45, risk_level: 'Medium', escalation_status: 'none', explanation: 'Moderate load increase this week. Follicular phase — recovery capacity is good.', phase: 'follicular', acute_chronic_ratio: 1.1, soreness_contribution: 12 },
  },
  {
    user_id: 'mock-3', email: 'lisa.martinez@team.com', full_name: 'Lisa Martinez',
    latestReport: { risk_score: 28, risk_level: 'Low', escalation_status: 'none', explanation: 'Balanced training load. No soreness concerns. Follicular phase supports intensity.', phase: 'follicular', acute_chronic_ratio: 0.9, soreness_contribution: 5 },
  },
  {
    user_id: 'mock-4', email: 'kate.williams@team.com', full_name: 'Kate Williams',
    latestReport: { risk_score: 71, risk_level: 'High', escalation_status: 'escalated', explanation: 'Luteal phase with groin soreness (6/10). Acute:chronic ratio elevated at 1.4.', phase: 'luteal', acute_chronic_ratio: 1.4, soreness_contribution: 22 },
  },
  {
    user_id: 'mock-5', email: 'mia.johnson@team.com', full_name: 'Mia Johnson',
    latestReport: { risk_score: 55, risk_level: 'Medium', escalation_status: 'none', explanation: 'Menstruation phase — fatigue expected. Moderate calf tightness reported.', phase: 'menstruation', acute_chronic_ratio: 1.0, soreness_contribution: 15 },
  },
  {
    user_id: 'mock-6', email: 'ava.brown@team.com', full_name: 'Ava Brown',
    latestReport: { risk_score: 18, risk_level: 'Low', escalation_status: 'none', explanation: 'Low training volume this week. All soreness markers clear. Follicular phase.', phase: 'follicular', acute_chronic_ratio: 0.7, soreness_contribution: 2 },
  },
  {
    user_id: 'mock-7', email: 'zoe.davis@team.com', full_name: 'Zoe Davis',
    latestReport: { risk_score: 63, risk_level: 'Medium', escalation_status: 'none', explanation: 'Ovulatory phase with slightly elevated load. Knee soreness (5/10) flagged.', phase: 'ovulatory', acute_chronic_ratio: 1.2, soreness_contribution: 18 },
  },
  {
    user_id: 'mock-8', email: 'chloe.wilson@team.com', full_name: 'Chloe Wilson',
    latestReport: { risk_score: 90, risk_level: 'High', escalation_status: 'escalated', explanation: 'Critical: ACR at 1.8, luteal phase, hamstring (8/10) and groin (7/10) soreness.', phase: 'luteal', acute_chronic_ratio: 1.8, soreness_contribution: 35 },
  },
];

// Mock historical risk trend data (last 8 weeks)
const MOCK_TREND_DATA = [
  { week: 'W1', avg: 38, high: 62, low: 15 },
  { week: 'W2', avg: 42, high: 68, low: 18 },
  { week: 'W3', avg: 35, high: 55, low: 12 },
  { week: 'W4', avg: 48, high: 74, low: 22 },
  { week: 'W5', avg: 52, high: 80, low: 25 },
  { week: 'W6', avg: 45, high: 72, low: 20 },
  { week: 'W7', avg: 55, high: 85, low: 28 },
  { week: 'W8', avg: 57, high: 90, low: 18 },
];

const chartConfig = {
  avg: { label: 'Squad Average', color: 'hsl(var(--primary))' },
  high: { label: 'Highest Risk', color: 'hsl(var(--destructive))' },
  low: { label: 'Lowest Risk', color: 'hsl(142 76% 36%)' },
};

function getTrainingSuggestion(report: AthleteInfo['latestReport']): { text: string; icon: typeof Activity } {
  if (!report) return { text: 'No data — request athlete to log sessions.', icon: Activity };
  if (report.risk_score >= 75) {
    return {
      text: 'Reduce volume 40%. Replace plyometrics with pool recovery. Limit to low-intensity technical drills only.',
      icon: TrendingDown,
    };
  }
  if (report.risk_score >= 50) {
    return {
      text: 'Reduce sprint distance by 20%. Cap session RPE at 6. Add extra warm-up and cool-down time.',
      icon: Activity,
    };
  }
  return {
    text: 'Clear for full training. Can increase intensity if progressive overload targets allow.',
    icon: TrendingUp,
  };
}

function getSorenessLabel(contribution: number): { text: string; color: string } {
  if (contribution >= 25) return { text: 'Severe', color: 'text-destructive' };
  if (contribution >= 15) return { text: 'Moderate', color: 'text-warning' };
  return { text: 'Low', color: 'text-primary' };
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<AthleteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteInfo | null>(null);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<AthleteInfo | null>(null);
  const [noteText, setNoteText] = useState('');
  const [coachNotes, setCoachNotes] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: profiles } = await supabase
        .from('athlete_profiles')
        .select('user_id')
        .eq('coach_id', user.id);

      const realAthleteIds = profiles?.map(p => p.user_id) ?? [];
      const realInfos: AthleteInfo[] = [];

      if (realAthleteIds.length) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', realAthleteIds);

        for (const up of userProfiles || []) {
          const { data: report } = await supabase
            .from('risk_reports')
            .select('risk_score, risk_level, escalation_status, explanation, phase, acute_chronic_ratio, soreness_contribution')
            .eq('athlete_id', up.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          realInfos.push({
            user_id: up.user_id,
            email: up.email || '',
            full_name: up.full_name,
            latestReport: report,
          });
        }
      }

      setAthletes([...realInfos, ...MOCK_ATHLETES]);
      setLoading(false);
    };

    load();
  }, [user]);

  const highRiskCount = athletes.filter(a => a.latestReport && a.latestReport.risk_score >= 75).length;
  const mediumRiskCount = athletes.filter(a => a.latestReport && a.latestReport.risk_score >= 50 && a.latestReport.risk_score < 75).length;
  const avgScore = athletes.length
    ? Math.round(athletes.reduce((sum, a) => sum + (a.latestReport?.risk_score ?? 0), 0) / athletes.length)
    : 0;

  const escalationQueue = athletes
    .filter(a => a.latestReport && a.latestReport.risk_score > 80)
    .sort((a, b) => (b.latestReport?.risk_score ?? 0) - (a.latestReport?.risk_score ?? 0));

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            COACH DASHBOARD
          </h1>
          <p className="text-muted-foreground mt-1">Women's Soccer — Squad Risk Overview</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Squad</p>
            <p className="text-3xl font-heading font-bold text-primary">{athletes.length}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Risk</p>
            <p className="text-3xl font-heading font-bold">{avgScore}</p>
          </div>
          <div className="glass-card p-4 text-center border-destructive/30">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">High Risk</p>
            <p className="text-3xl font-heading font-bold text-destructive">{highRiskCount}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Moderate</p>
            <p className="text-3xl font-heading font-bold text-warning">{mediumRiskCount}</p>
          </div>
        </div>

        {/* Risk Trends Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-heading flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Squad Risk Trends (8 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={MOCK_TREND_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="week" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 100]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2.5} dot={{ r: 4 }} name="Squad Average" />
                <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Highest Risk" />
                <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Lowest Risk" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Escalation Queue */}
        {escalationQueue.length > 0 && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2 text-destructive">
                <Flame className="h-5 w-5" />
                Escalation Queue — Immediate Attention ({escalationQueue.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {escalationQueue.map((a, i) => {
                const report = a.latestReport!;
                const soreness = getSorenessLabel(report.soreness_contribution ?? 0);
                return (
                  <motion.div
                    key={a.user_id}
                    className="rounded-lg border border-destructive/30 bg-background p-4 space-y-3"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <div>
                          <p className="font-bold">{a.full_name || a.email}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-heading font-bold text-destructive">{report.risk_score}</span>
                        <RiskBadge level={report.risk_level} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs block">Phase</span>
                        <span className="font-medium capitalize">{report.phase || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">ACR</span>
                        <span className="font-medium">{report.acute_chronic_ratio?.toFixed(2) ?? 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">Soreness</span>
                        <span className={`font-medium ${soreness.color}`}>{soreness.text}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs block">Status</span>
                        <span className="font-medium text-destructive">Escalated</span>
                      </div>
                    </div>

                    {report.explanation && (
                      <p className="text-sm text-muted-foreground">{report.explanation}</p>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5"
                        onClick={() => toast.success(`Physio notified for ${a.full_name || a.email}`)}
                      >
                        <Bell className="h-3.5 w-3.5" />
                        Notify Physio
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => toast.success(`Check-in scheduled for ${a.full_name || a.email}`)}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" />
                        Schedule Check-In
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5"
                        onClick={() => {
                          setNoteTarget(a);
                          setNoteText('');
                          setNoteDialogOpen(true);
                        }}
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                        Add Coach Note
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Full Squad List */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : athletes.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No athletes assigned</p>
            <p className="text-sm text-muted-foreground">Athletes will appear here once they add you as their coach.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-heading font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Full Squad ({athletes.length})
            </h2>
            {athletes
              .sort((a, b) => (b.latestReport?.risk_score ?? 0) - (a.latestReport?.risk_score ?? 0))
              .map((a, i) => {
                const suggestion = getTrainingSuggestion(a.latestReport);
                const SugIcon = suggestion.icon;
                return (
                  <motion.div
                    key={a.user_id}
                    className={`glass-card p-5 cursor-pointer transition-all hover:bg-secondary/30 ${
                      a.latestReport?.escalation_status === 'escalated' ? 'border-destructive/30' : ''
                    }`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedAthlete(selectedAthlete?.user_id === a.user_id ? null : a)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {a.latestReport?.escalation_status === 'escalated' && (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        )}
                        <div>
                          <p className="font-bold">{a.full_name || a.email}</p>
                          <p className="text-xs text-muted-foreground">{a.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.latestReport && (
                          <>
                            <span className="text-lg font-heading font-bold">{a.latestReport.risk_score}</span>
                            <RiskBadge level={a.latestReport.risk_level} />
                          </>
                        )}
                      </div>
                    </div>

                    {selectedAthlete?.user_id === a.user_id && a.latestReport && (
                      <motion.div
                        className="mt-4 pt-4 border-t border-border space-y-3"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Phase:</span>{' '}
                            <span className="font-medium capitalize">{a.latestReport.phase || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>{' '}
                            <span className={`font-medium ${a.latestReport.escalation_status === 'escalated' ? 'text-destructive' : 'text-primary'}`}>
                              {a.latestReport.escalation_status === 'escalated' ? 'Escalated' : 'Normal'}
                            </span>
                          </div>
                        </div>
                        {a.latestReport.explanation && (
                          <p className="text-sm text-muted-foreground">{a.latestReport.explanation}</p>
                        )}
                        <div className="bg-secondary/50 rounded-lg p-3 flex items-start gap-3">
                          <SugIcon className={`h-5 w-5 mt-0.5 shrink-0 ${
                            a.latestReport.risk_score >= 75 ? 'text-destructive' :
                            a.latestReport.risk_score >= 50 ? 'text-warning' : 'text-primary'
                          }`} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Training Suggestion</p>
                            <p className="text-sm">{suggestion.text}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
          </div>
        )}
      </div>

      {/* Coach Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Coach Note — {noteTarget?.full_name || noteTarget?.email}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Write your note here..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            className="min-h-[120px]"
          />
          {coachNotes[noteTarget?.user_id || '']?.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground font-bold uppercase">Previous Notes</p>
              {coachNotes[noteTarget?.user_id || ''].map((n, i) => (
                <p key={i} className="text-sm bg-secondary/50 rounded p-2">{n}</p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!noteText.trim() || !noteTarget) return;
              setCoachNotes(prev => ({
                ...prev,
                [noteTarget.user_id]: [...(prev[noteTarget.user_id] || []), noteText.trim()],
              }));
              toast.success(`Note saved for ${noteTarget.full_name || noteTarget.email}`);
              setNoteDialogOpen(false);
              setNoteText('');
            }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
