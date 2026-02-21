import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area, ComposedChart, Bar } from 'recharts';
import { TrendingUp, Activity, Heart, Loader2 } from 'lucide-react';

type Range = '7' | '14' | '30';

const INTENSITY_MAP: Record<string, number> = { Low: 1, Medium: 2, High: 3 };

function dateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function fmtLabel(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CoachAnalytics() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>('30');
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [riskData, setRiskData] = useState<any[]>([]);
  const [loadData, setLoadData] = useState<any[]>([]);
  const [sorenessData, setSorenessData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch athlete IDs for this coach
  useEffect(() => {
    if (!user) return;
    supabase
      .from('athlete_profiles')
      .select('user_id')
      .eq('coach_id', user.id)
      .then(({ data }) => {
        setAthleteIds(data?.map((r) => r.user_id) ?? []);
      });
  }, [user]);

  // Fetch all chart data when athleteIds or range changes
  useEffect(() => {
    if (!athleteIds.length) {
      setLoading(false);
      return;
    }

    const days = Number(range);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const dates = dateRange(days);

    const fetchAll = async () => {
      setLoading(true);

      const [riskRes, sessionRes, sorenessRes] = await Promise.all([
        supabase
          .from('risk_reports')
          .select('risk_score, created_at')
          .in('athlete_id', athleteIds)
          .gte('created_at', since)
          .order('created_at', { ascending: true }),
        supabase
          .from('training_sessions')
          .select('duration, rpe, intensity, date')
          .in('athlete_id', athleteIds)
          .gte('date', since.slice(0, 10))
          .order('date', { ascending: true }),
        supabase
          .from('soreness_logs')
          .select('hamstring, knee, calf, groin, other_value, date')
          .in('athlete_id', athleteIds)
          .gte('date', since.slice(0, 10))
          .order('date', { ascending: true }),
      ]);

      // --- Risk aggregation ---
      const riskByDay: Record<string, number[]> = {};
      for (const r of riskRes.data ?? []) {
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        if (!riskByDay[day]) riskByDay[day] = [];
        riskByDay[day].push(Number(r.risk_score));
      }
      setRiskData(
        dates.map((d) => ({
          date: fmtLabel(d),
          avg: riskByDay[d]
            ? Math.round(riskByDay[d].reduce((a, b) => a + b, 0) / riskByDay[d].length)
            : null,
          high: riskByDay[d] ? riskByDay[d].filter((s) => s >= 75).length : 0,
        }))
      );

      // --- Training load aggregation ---
      const loadByDay: Record<string, number> = {};
      for (const s of sessionRes.data ?? []) {
        const day = s.date;
        const mult = INTENSITY_MAP[s.intensity] ?? 2;
        const load = (s.duration * s.rpe * mult) / 10;
        loadByDay[day] = (loadByDay[day] ?? 0) + load;
      }
      setLoadData(
        dates.map((d) => ({
          date: fmtLabel(d),
          load: loadByDay[d] ? Math.round(loadByDay[d]) : null,
        }))
      );

      // --- Soreness aggregation ---
      const soreByDay: Record<string, number[]> = {};
      for (const s of sorenessRes.data ?? []) {
        const day = s.date;
        const max = Math.max(s.hamstring, s.knee, s.calf, s.groin, s.other_value ?? 0);
        if (!soreByDay[day]) soreByDay[day] = [];
        soreByDay[day].push(max);
      }
      setSorenessData(
        dates.map((d) => ({
          date: fmtLabel(d),
          avg: soreByDay[d]
            ? +(soreByDay[d].reduce((a, b) => a + b, 0) / soreByDay[d].length).toFixed(1)
            : null,
        }))
      );

      setLoading(false);
    };

    fetchAll();
  }, [athleteIds, range]);

  const riskChartConfig = {
    avg: { label: 'Avg Risk Score', color: 'hsl(var(--primary))' },
    high: { label: 'High-Risk Count', color: 'hsl(var(--destructive))' },
  };

  const loadChartConfig = {
    load: { label: 'Total Load', color: 'hsl(var(--primary))' },
  };

  const sorenessChartConfig = {
    avg: { label: 'Avg Max Soreness', color: 'hsl(var(--warning))' },
  };

  const tickStyle = { fill: 'hsl(var(--muted-foreground))', fontSize: 10 };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Analytics</h1>
          </div>
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as Range)} className="bg-muted rounded-lg p-1">
            <ToggleGroupItem value="7" className="text-xs px-3">7d</ToggleGroupItem>
            <ToggleGroupItem value="14" className="text-xs px-3">14d</ToggleGroupItem>
            <ToggleGroupItem value="30" className="text-xs px-3">30d</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !athleteIds.length ? (
          <p className="text-muted-foreground text-center py-20">No athletes assigned. Seed demo data first.</p>
        ) : (
          <div className="grid gap-6">
            {/* Squad Risk Trend */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Squad Risk Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={riskChartConfig} className="h-[280px] w-full">
                  <ComposedChart data={riskData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" domain={[0, 100]} tick={tickStyle} />
                    <YAxis yAxisId="right" orientation="right" tick={tickStyle} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line yAxisId="left" type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2.5} dot={false} connectNulls name="Avg Risk Score" />
                    <Bar yAxisId="right" dataKey="high" fill="var(--color-high)" opacity={0.4} name="High-Risk Count" />
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Training Load Trend */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Squad Training Load
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={loadChartConfig} className="h-[280px] w-full">
                  <AreaChart data={loadData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="loadGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" />
                    <YAxis tick={tickStyle} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="load" stroke="var(--color-load)" strokeWidth={2.5} fill="url(#loadGradient)" connectNulls name="Total Load" />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Soreness Trend */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <Heart className="h-5 w-5 text-warning" />
                  Squad Soreness Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={sorenessChartConfig} className="h-[280px] w-full">
                  <LineChart data={sorenessData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" />
                    <YAxis domain={[0, 10]} tick={tickStyle} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2.5} dot={false} connectNulls name="Avg Max Soreness" />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
