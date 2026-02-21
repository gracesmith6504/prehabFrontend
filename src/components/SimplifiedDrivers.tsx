import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface RiskDriver {
  feature: string;
  label?: string;
  value: number | string;
  contribution: number;
}

const FALLBACK_LABEL_MAP: Record<string, string> = {
  'ac_ratio': 'Load spike',
  'acute_chronic_ratio': 'Load spike',
  'phase_multiplier': 'Cycle phase risk',
  'soreness': 'Soreness elevated',
  'soreness_contribution': 'Soreness elevated',
  'rpe': 'High effort',
  'session_rpe': 'High effort',
  'duration': 'Session length',
  'menstrual_phase': 'Cycle phase',
  'weekly_load': 'High training volume',
};

function toPlainLabel(driver: RiskDriver): string {
  // Prefer ML-provided label
  if (driver.label) return driver.label;
  // Fallback to mapping
  const lower = driver.feature.toLowerCase().replace(/\s+/g, '_');
  if (FALLBACK_LABEL_MAP[lower]) return FALLBACK_LABEL_MAP[lower];
  return driver.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  athleteId: string;
  drivers?: RiskDriver[];
}

export default function SimplifiedDrivers({ athleteId, drivers: propDrivers }: Props) {
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

  // Deduplicate labels
  const labels = [...new Set(drivers.slice(0, 4).map(d => toPlainLabel(d)))];

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">What's Driving Your Risk</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {labels.map(label => (
          <Badge key={label} variant="secondary" className="text-sm py-1 px-3">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
