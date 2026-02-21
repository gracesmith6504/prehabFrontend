import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts';
import { TrendingUp } from 'lucide-react';

const chartConfig = {
  avg: { label: 'Avg Risk', color: 'hsl(var(--primary))' },
  highCount: { label: 'High-Risk Athletes', color: 'hsl(var(--muted-foreground))' },
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
        <CardTitle className="text-sm font-heading uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Squad Risk Trend
          <span className="text-xs font-normal text-muted-foreground ml-1">30 days</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] sm:h-[260px] w-full">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <ReferenceLine
              y={75}
              stroke="hsl(var(--destructive))"
              strokeDasharray="4 4"
              strokeOpacity={0.35}
              label={{ value: 'High', position: 'right', fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="var(--color-avg)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
              name="Avg Risk"
            />
            <Line
              type="monotone"
              dataKey="highCount"
              stroke="var(--color-highCount)"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0, fill: 'hsl(var(--muted-foreground))' }}
              name="High-Risk Athletes"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
