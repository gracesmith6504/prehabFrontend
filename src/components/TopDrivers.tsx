import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Target } from 'lucide-react';

interface RiskDriver {
  feature: string;
  value: number | string;
  contribution: number;
}

interface Props {
  athleteId: string;
  drivers?: RiskDriver[]; // optionally pass drivers directly
}

const DRIVER_LABELS: Record<string, string> = {
  ac_ratio: 'Training Load Spike',
  acute_chronic_ratio: 'Training Load Spike',
  phase_multiplier: 'Cycle Phase Risk',
  soreness: 'Soreness Level',
  soreness_contribution: 'Soreness Level',
  rpe: 'Perceived Effort',
  session_rpe: 'Perceived Effort',
  duration: 'Session Length',
  menstrual_phase: 'Cycle Phase',
  weekly_load: 'Training Volume',
  risk_prob: 'Injury Probability',
  confidence: 'Model Confidence',
};
export default function TopDrivers({ athleteId, drivers: propDrivers }: Props) {
  const [drivers, setDrivers] = useState<RiskDriver[]>(propDrivers || []);

  useEffect(() => {
    if (propDrivers) { setDrivers(propDrivers); return; }

    const load = async () => {
      const { data } = await supabase
        .from('risk_predictions')
        .select('top_drivers')
        .eq('athlete_id', athleteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.top_drivers) {
        setDrivers(data.top_drivers as unknown as RiskDriver[]);
      }
    };
    load();
  }, [athleteId, propDrivers]);

  if (!drivers.length) return null;

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">Top Risk Drivers</h3>
      </div>
      <div className="space-y-2.5">
        {drivers.slice(0, 3).map((d, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{DRIVER_LABELS[d.feature] || d.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
              <span className="text-muted-foreground text-xs">
                {(d.contribution * 100).toFixed(0)}% impact
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(d.contribution * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
