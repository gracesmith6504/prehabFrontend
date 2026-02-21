import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { HeartPulse, Plus } from 'lucide-react';

const BODY_PARTS = ['knee', 'hamstring', 'groin', 'calf'] as const;

export default function SorenessLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, number>>({
    knee: 0, hamstring: 0, groin: 0, calf: 0,
  });
  const [otherLabel, setOtherLabel] = useState('');
  const [otherValue, setOtherValue] = useState(0);
  const [showOther, setShowOther] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('soreness_logs').insert({
      athlete_id: user.id,
      date: new Date().toISOString().split('T')[0],
      knee: values.knee,
      hamstring: values.hamstring,
      groin: values.groin,
      calf: values.calf,
      other_label: showOther ? otherLabel : null,
      other_value: showOther ? otherValue : 0,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Soreness logged!' });
    }
    setSaving(false);
  };

  const getColor = (v: number) => {
    if (v >= 7) return 'text-destructive';
    if (v >= 4) return 'text-warning';
    return 'text-primary';
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <HeartPulse className="h-8 w-8 text-primary" />
            LOG SORENESS
          </h1>
          <p className="text-muted-foreground mt-1">Rate your soreness for each body area (0–10).</p>
        </div>

        <div className="glass-card p-6 space-y-6">
          {BODY_PARTS.map(part => (
            <div key={part}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium capitalize">{part}</label>
                <span className={`text-2xl font-heading font-bold ${getColor(values[part])}`}>{values[part]}</span>
              </div>
              <input
                type="range" min={0} max={10} value={values[part]}
                onChange={e => setValues(v => ({ ...v, [part]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>No pain</span><span>Severe</span>
              </div>
            </div>
          ))}

          {showOther ? (
            <div className="space-y-3 border-t border-border pt-4">
              <input
                type="text" placeholder="Body part name" value={otherLabel}
                onChange={e => setOtherLabel(e.target.value)}
                className="w-full px-4 py-2 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium capitalize">{otherLabel || 'Other'}</span>
                <span className={`text-2xl font-heading font-bold ${getColor(otherValue)}`}>{otherValue}</span>
              </div>
              <input type="range" min={0} max={10} value={otherValue}
                onChange={e => setOtherValue(Number(e.target.value))} className="w-full accent-primary" />
            </div>
          ) : (
            <button onClick={() => setShowOther(true)}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <Plus className="h-4 w-4" /> Add another body part
            </button>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50">
            {saving ? 'Saving...' : 'Submit Soreness'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
