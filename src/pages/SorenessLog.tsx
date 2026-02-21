import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { HeartPulse, Plus, Trash2 } from 'lucide-react';

const DEFAULT_PARTS = ['knee', 'hamstring', 'groin', 'calf'] as const;

export default function SorenessLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, number>>({
    knee: 0, hamstring: 0, groin: 0, calf: 0,
  });
  const [customParts, setCustomParts] = useState<string[]>([]);
  const [newPartLabel, setNewPartLabel] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('soreness_logs')
      .select('other_label')
      .eq('athlete_id', user.id)
      .not('other_label', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(d => d.other_label).filter(Boolean))] as string[];
          setCustomParts(unique);
          const init: Record<string, number> = {};
          unique.forEach(p => { init[p] = 0; });
          setValues(v => ({ ...v, ...init }));
        }
      });
  }, [user]);

  const addCustomPart = () => {
    const label = newPartLabel.trim().toLowerCase();
    if (!label) return;
    if ([...DEFAULT_PARTS, ...customParts].includes(label)) {
      toast({ title: 'Already exists', variant: 'destructive' });
      return;
    }
    setCustomParts(prev => [...prev, label]);
    setValues(v => ({ ...v, [label]: 0 }));
    setNewPartLabel('');
    setShowAddNew(false);
  };

  const removeCustomPart = async (part: string) => {
    if (!user) return;
    // Remove from DB
    await supabase
      .from('soreness_logs')
      .delete()
      .eq('athlete_id', user.id)
      .eq('other_label', part);
    // Remove from state
    setCustomParts(prev => prev.filter(p => p !== part));
    setValues(v => {
      const next = { ...v };
      delete next[part];
      return next;
    });
    toast({ title: `Removed "${part}"` });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const baseLog = {
      athlete_id: user.id,
      date: new Date().toISOString().split('T')[0],
      knee: values.knee,
      hamstring: values.hamstring,
      groin: values.groin,
      calf: values.calf,
      other_label: null as string | null,
      other_value: 0,
    };

    if (customParts.length === 0) {
      const { error } = await supabase.from('soreness_logs').insert(baseLog);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    } else {
      const rows = customParts.map(part => ({
        ...baseLog,
        other_label: part,
        other_value: values[part] ?? 0,
      }));
      const { error } = await supabase.from('soreness_logs').insert(rows);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    }

    toast({ title: 'Soreness logged!' });
    setSaving(false);
  };

  const getColor = (v: number) => {
    if (v >= 7) return 'text-destructive';
    if (v >= 4) return 'text-warning';
    return 'text-primary';
  };

  const allParts = [...DEFAULT_PARTS, ...customParts];

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
          {allParts.map(part => (
            <div key={part}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium capitalize">{part}</label>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-heading font-bold ${getColor(values[part] ?? 0)}`}>{values[part] ?? 0}</span>
                  {!DEFAULT_PARTS.includes(part as any) && (
                    <button
                      onClick={() => removeCustomPart(part)}
                      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      title={`Remove ${part}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range" min={0} max={10} value={values[part] ?? 0}
                onChange={e => setValues(v => ({ ...v, [part]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>No pain</span><span>Severe</span>
              </div>
            </div>
          ))}

          {showAddNew ? (
            <div className="flex gap-2 border-t border-border pt-4">
              <input
                type="text"
                placeholder="Body part name"
                value={newPartLabel}
                onChange={e => setNewPartLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomPart()}
                className="flex-1 px-4 py-2 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <button
                onClick={addCustomPart}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:brightness-110 transition-all"
              >
                Add
              </button>
              <button
                onClick={() => { setShowAddNew(false); setNewPartLabel(''); }}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAddNew(true)}
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
