import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import AgentStatus from '@/components/AgentStatus';
import EscalationCard from '@/components/EscalationCard';
import SquadRiskSnapshot from '@/components/coach/SquadRiskSnapshot';

import AthleteTable, { type AthleteRow } from '@/components/coach/AthleteTable';
import SquadRiskTrendChart from '@/components/coach/SquadRiskTrendChart';
import CoachAthleteDetail from '@/components/coach/CoachAthleteDetail';
import { Shield, Play, Flame, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface EscalationRow {
  id: string;
  athlete_id: string;
  trigger_reason: string;
  status: string;
  created_at: string;
  notes: string | null;
  risk_prediction_id: string | null;
}

export default function CoachDashboard() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<EscalationRow[]>([]);
  const [runningAgent, setRunningAgent] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [prevAvgRisk, setPrevAvgRisk] = useState<number | null>(null);
  const escalationRef = useRef<HTMLDivElement>(null);

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

    // If no real athletes, use mock data
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

    // Get yesterday's avg for trend
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

    const { data: escData } = await supabase
      .from('escalations')
      .select('id, athlete_id, trigger_reason, status, created_at, notes, risk_prediction_id')
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false });

    setEscalations((escData || []) as EscalationRow[]);
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

  const highCount = athletes.filter(a => a.risk_score >= 75).length;
  const mediumCount = athletes.filter(a => a.risk_score >= 50 && a.risk_score < 75).length;
  const lowCount = athletes.filter(a => a.risk_score < 50).length;
  const avgScore = athletes.length ? Math.round(athletes.reduce((s, a) => s + a.risk_score, 0) / athletes.length) : 0;

  const enrichedEscalations = escalations.map(esc => {
    const athlete = athletes.find(a => a.user_id === esc.athlete_id);
    return { ...esc, athlete_name: athlete?.full_name || undefined, athlete_email: athlete?.email, risk_score: athlete?.risk_score };
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              COACH COMMAND CENTER
            </h1>
            <p className="text-muted-foreground mt-1">Women's Soccer — Real-time Squad Intelligence</p>
          </div>
          <Button onClick={handleRunAgent} disabled={runningAgent} className="gap-2 font-heading uppercase tracking-wider">
            <Play className="h-4 w-4" />
            {runningAgent ? 'Running...' : 'Run Agent'}
          </Button>
        </div>

        {/* Agent Status */}
        <AgentStatus />


        {/* 1. Squad Risk Snapshot */}
        <SquadRiskSnapshot
          avgRisk={avgScore}
          prevAvgRisk={prevAvgRisk}
          lowCount={lowCount}
          mediumCount={mediumCount}
          highCount={highCount}
          activeEscalations={enrichedEscalations.length}
          totalAthletes={athletes.length}
        />

        {/* 2. Escalation Queue */}
        <div ref={escalationRef}>
          {enrichedEscalations.length > 0 ? (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-heading flex items-center gap-2 text-destructive">
                  <Flame className="h-5 w-5" />
                  Escalation Queue ({enrichedEscalations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enrichedEscalations.map(esc => (
                  <EscalationCard key={esc.id} escalation={esc} onUpdate={loadData} />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/20">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">No active escalations — squad looking good ✓</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 3. Squad Risk Trend Chart */}
        <SquadRiskTrendChart athleteIds={athletes.map(a => a.user_id)} />

        {/* 4. Athlete Table */}
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
              Squad Roster ({athletes.length})
            </h2>
            <AthleteTable athletes={athletes} onSelectAthlete={setSelectedAthleteId} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
