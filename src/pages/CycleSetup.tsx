import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { getCurrentPhase, PHASE_MULTIPLIERS, type MenstrualPhase } from '@/lib/riskEngine';
import { Calendar } from 'lucide-react';

export default function CycleSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [menstruationLength, setMenstruationLength] = useState(5);
  const [contraceptive, setContraceptive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<MenstrualPhase>('unknown');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('athlete_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.cycle_start_date) setStartDate(data.cycle_start_date);
          if (data.cycle_length) setCycleLength(data.cycle_length);
          if (data.menstruation_length) setMenstruationLength(data.menstruation_length);
          if (data.contraceptive_use !== null) setContraceptive(data.contraceptive_use);
        }
      });
  }, [user]);

  useEffect(() => {
    if (startDate) {
      setCurrentPhase(getCurrentPhase(startDate, cycleLength, menstruationLength));
    }
  }, [startDate, cycleLength, menstruationLength]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('athlete_profiles')
      .update({
        cycle_start_date: startDate || null,
        cycle_length: cycleLength,
        menstruation_length: menstruationLength,
        contraceptive_use: contraceptive,
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cycle data saved' });
    }
    setSaving(false);
  };

  const phases: MenstrualPhase[] = ['menstruation', 'follicular', 'ovulatory', 'luteal'];

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            CYCLE SETUP
          </h1>
          <p className="text-muted-foreground mt-1">Track your menstrual cycle for accurate risk assessment.</p>
        </div>

        <div className="glass-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Last cycle start date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Average cycle length (days)</label>
            <input
              type="number"
              min={20}
              max={45}
              value={cycleLength}
              onChange={e => setCycleLength(Number(e.target.value))}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Average menstruation length (days)</label>
            <input
              type="number"
              min={2}
              max={10}
              value={menstruationLength}
              onChange={e => setMenstruationLength(Number(e.target.value))}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setContraceptive(!contraceptive)}
              className={`w-12 h-7 rounded-full transition-colors relative ${contraceptive ? 'bg-primary' : 'bg-secondary'}`}
            >
              <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-foreground transition-transform ${contraceptive ? 'left-5.5 translate-x-0' : 'left-0.5'}`} />
            </button>
            <label className="text-sm font-medium">Hormonal contraceptive use</label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Cycle Data'}
          </button>
        </div>

        {/* Phase display */}
        {currentPhase !== 'unknown' && (
          <div className="glass-card p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Current Calculated Phase</p>
            <div className="grid grid-cols-4 gap-2">
              {phases.map(p => (
                <div
                  key={p}
                  className={`text-center p-3 rounded-lg text-xs font-bold uppercase ${
                    currentPhase === p ? 'bg-primary/20 text-primary neon-border' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {p}
                  <div className="text-[10px] mt-1 font-normal">×{PHASE_MULTIPLIERS[p].toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
