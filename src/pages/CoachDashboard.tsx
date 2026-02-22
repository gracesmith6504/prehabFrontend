import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import LastEvaluatedLine from '@/components/coach/LastEvaluatedLine';
import SquadRiskSnapshot from '@/components/coach/SquadRiskSnapshot';
import AthleteTable, { type AthleteRow } from '@/components/coach/AthleteTable';
import SquadRiskTrendChart from '@/components/coach/SquadRiskTrendChart';
import CoachAthleteDetail from '@/components/coach/CoachAthleteDetail';
import { Shield, Play, Users, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EscalationRow {
  id: string;
  athlete_id: string;
  trigger_reason: string;
  status: string;
  created_at: string;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [runningAgent, setRunningAgent] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [prevAvgRisk, setPrevAvgRisk] = useState<number | null>(null);

  const loadData = async () => {
    if (!user) return;

    const { data: profiles } = await supabase
      .from('athlete_profiles')
      .select('user_id')
      .eq('coach_id', user.id);

    const athleteIds = profiles?.map(p => p.user_id) ?? [];
    const rows: AthleteRow[] = [];

    if (athleteIds.length) {
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('user_id, email, full_name')
        .in('user_id', athleteIds);

      for (const up of userProfiles || []) {
        const [reportRes, sorenessRes, agentRes] = await Promise.all([
          supabase.from('risk_reports').select('risk_score, risk_level, escalation_status, phase, acute_chronic_ratio, soreness_contribution').eq('athlete_id', up.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('soreness_logs').select('knee, hamstring, groin, calf, other_value').eq('athlete_id', up.user_id).order('date', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('agent_actions').select('created_at').eq('athlete_id', up.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        const s = sorenessRes.data;
        const maxSore = s ? Math.max(s.knee, s.hamstring, s.groin, s.calf, s.other_value || 0) : 0;

        rows.push({
          user_id: up.user_id,
          email: up.email || '',
          full_name: up.full_name,
          risk_score: Number(reportRes.data?.risk_score ?? 0),
          risk_level: reportRes.data?.risk_level || 'Low',
          phase: reportRes.data?.phase || null,
          acr: reportRes.data?.acute_chronic_ratio ? Number(reportRes.data.acute_chronic_ratio) : null,
          max_soreness: maxSore,
          escalation_status: reportRes.data?.escalation_status || 'none',
          last_agent_run: agentRes.data?.created_at || null,
        });
      }
    }

    // Mock data if no real athletes
    if (!rows.length) {
      rows.push(
        { user_id: 'mock-1', email: 'sarah.jones@team.com', full_name: 'Sarah Jones', risk_score: 82, risk_level: 'High', phase: 'ovulatory', acr: 1.6, max_soreness: 7, escalation_status: 'open', last_agent_run: new Date().toISOString() },
        { user_id: 'mock-2', email: 'emma.chen@team.com', full_name: 'Emma Chen', risk_score: 45, risk_level: 'Medium', phase: 'follicular', acr: 1.1, max_soreness: 4, escalation_status: 'none', last_agent_run: new Date().toISOString() },
        { user_id: 'mock-3', email: 'lisa.martinez@team.com', full_name: 'Lisa Martinez', risk_score: 28, risk_level: 'Low', phase: 'follicular', acr: 0.9, max_soreness: 2, escalation_status: 'none', last_agent_run: new Date().toISOString() },
        { user_id: 'mock-4', email: 'kate.williams@team.com', full_name: 'Kate Williams', risk_score: 71, risk_level: 'High', phase: 'luteal', acr: 1.4, max_soreness: 6, escalation_status: 'open', last_agent_run: new Date().toISOString() },
        { user_id: 'mock-5', email: 'mia.johnson@team.com', full_name: 'Mia Johnson', risk_score: 55, risk_level: 'Medium', phase: 'menstruation', acr: 1.0, max_soreness: 5, escalation_status: 'none', last_agent_run: new Date().toISOString() },
        { user_id: 'mock-6', email: 'ava.brown@team.com', full_name: 'Ava Brown', risk_score: 18, risk_level: 'Low', phase: 'follicular', acr: 0.7, max_soreness: 1, escalation_status: 'none', last_agent_run: new Date().toISOString() },
      );
    }

    // Yesterday's avg for trend
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    if (athleteIds.length) {
      const { data: prevReports } = await supabase
        .from('risk_reports')
        .select('risk_score')
        .in('athlete_id', athleteIds)
        .gte('created_at', twoDaysAgo)
        .lt('created_at', yesterday);
      if (prevReports?.length) {
        setPrevAvgRisk(Math.round(prevReports.reduce((s, r) => s + Number(r.risk_score), 0) / prevReports.length));
      }
    }

    // Deduplicate escalations by athlete_id (keep latest)
    const { data: escData } = await supabase
      .from('escalations')
      .select('id, athlete_id, trigger_reason, status, created_at')
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false });

    const seen = new Set<string>();
    const deduped: EscalationRow[] = [];
    for (const esc of (escData || []) as EscalationRow[]) {
      if (!seen.has(esc.athlete_id)) {
        seen.add(esc.athlete_id);
        deduped.push(esc);
      }
    }

    setEscalations(deduped);
    setAthletes(rows.sort((a, b) => b.risk_score - a.risk_score));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleRunAgent = async () => {
    setRunningAgent(true);
    try {
      const { data, error } = await supabase.functions.invoke('agent-runner', {
        body: { trigger_type: 'manual', coach_id: user?.id },
      });
      if (error) throw error;
      toast.success(`Agent completed — ${data?.athletes_processed || 0} athletes processed`);
      loadData();
    } catch (err: any) {
      toast.error(`Agent failed: ${err.message}`);
    } finally {
      setRunningAgent(false);
    }
  };

  const criticalCount = athletes.filter(a => a.risk_level === 'Critical').length;
  const highCount = athletes.filter(a => a.risk_level === 'High').length;
  const mediumCount = athletes.filter(a => a.risk_level === 'Medium').length;
  const avgScore = athletes.length ? Math.round(athletes.reduce((s, a) => s + a.risk_score, 0) / athletes.length) : 0;

  const enrichedEscalations = escalations.map(esc => {
    const athlete = athletes.find(a => a.user_id === esc.athlete_id);
    return { ...esc, athlete_name: athlete?.full_name || athlete?.email || 'Unknown', risk_score: athlete?.risk_score ?? 0 };
  });

  const selectedAthlete = selectedAthleteId ? athletes.find(a => a.user_id === selectedAthleteId) : null;

  if (selectedAthlete) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto">
          <CoachAthleteDetail
            athleteId={selectedAthlete.user_id}
            athleteName={selectedAthlete.full_name || selectedAthlete.email}
            onBack={() => setSelectedAthleteId(null)}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-3">
              <Shield className="h-7 w-7 text-primary" />
              Command Center
            </h1>
            <div className="mt-1.5">
              <LastEvaluatedLine />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunAgent}
            disabled={runningAgent}
            className="gap-1.5 text-xs font-medium shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {runningAgent ? 'Running…' : 'Run Agent'}
          </Button>
        </div>

        {/* Squad Snapshot — 4 stat cards */}
        <SquadRiskSnapshot
          avgRisk={avgScore}
          prevAvgRisk={prevAvgRisk}
          criticalCount={criticalCount}
          highCount={highCount}
          mediumCount={mediumCount}
          activeEscalations={enrichedEscalations.length}
        />

        {/* Escalation Queue — simplified */}
        {enrichedEscalations.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider text-destructive">
              Escalations ({enrichedEscalations.length})
            </h2>
            <div className="rounded-xl border border-destructive/20 bg-card divide-y divide-border">
              {enrichedEscalations.map(esc => (
                <div key={esc.id} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold text-destructive tabular-nums w-8">{esc.risk_score}</span>
                    <span className="text-sm font-medium truncate">{esc.athlete_name}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">{esc.trigger_reason}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs shrink-0"
                    onClick={() => setSelectedAthleteId(esc.athlete_id)}
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Squad Risk Trend — full width, prioritized */}
        <SquadRiskTrendChart athleteIds={athletes.map(a => a.user_id)} />

        {/* Squad Roster */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : athletes.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-heading font-bold uppercase tracking-wider flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Squad Roster ({athletes.length})
            </h2>
            <AthleteTable athletes={athletes} onSelectAthlete={setSelectedAthleteId} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No athletes assigned yet.</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
