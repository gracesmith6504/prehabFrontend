import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Bar, ComposedChart } from 'recharts';
import { TrendingUp } from 'lucide-react';

const chartConfig = {
  avg: { label: 'Avg Risk', color: 'hsl(var(--primary))' },
  highCount: { label: 'High-Risk Athletes', color: 'hsl(var(--destructive))' },
};

interface Props {
  athleteIds: string[];
}

export default function SquadRiskTrendChart({ athleteIds }: Props) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!athleteIds.length) return;
    const load = async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: reports } = await supabase
        .from('risk_reports')
        .select('risk_score, risk_level, created_at')
        .in('athlete_id', athleteIds)
        .gte('created_at', since)
        .order('created_at', { ascending: true });

      if (!reports?.length) {
        // Generate mock data
        const mock = Array.from({ length: 30 }, (_, i) => {
          const d = new Date(Date.now() - (29 - i) * 86400000);
          return {
            date: `${d.getMonth() + 1}/${d.getDate()}`,
            avg: Math.round(35 + Math.random() * 30),
            highCount: Math.floor(Math.random() * 3),
          };
        });
        setData(mock);
        return;
      }

      // Group by day
      const byDay: Record<string, { scores: number[] }> = {};
      for (const r of reports) {
        const day = new Date(r.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        if (!byDay[day]) byDay[day] = { scores: [] };
        byDay[day].scores.push(Number(r.risk_score));
      }

      setData(Object.entries(byDay).map(([date, v]) => ({
        date,
        avg: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
        highCount: v.scores.filter(s => s >= 75).length,
      })));
    };
    load();
  }, [athleteIds]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Squad Risk Trend (30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] sm:h-[260px] w-full">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" domain={[0, 100]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2.5} dot={false} name="Avg Risk" />
            <Bar yAxisId="right" dataKey="highCount" fill="var(--color-highCount)" opacity={0.4} name="High-Risk Athletes" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
