import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { getCurrentPhase, type MenstrualPhase } from '@/lib/riskEngine';
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import CycleRing from '@/components/CycleRing';
import PhaseInsight from '@/components/PhaseInsight';
import WearableCycleSync from '@/components/WearableCycleSync';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';

export default function CycleSetup() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [cycleLength, setCycleLength] = useState(28);
  const [menstruationLength, setMenstruationLength] = useState(5);
  const [contraceptive, setContraceptive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  const currentPhase = useMemo<MenstrualPhase>(() => {
    if (!startDate) return 'unknown';
    return getCurrentPhase(startDate, cycleLength, menstruationLength);
  }, [startDate, cycleLength, menstruationLength]);

  const cycleDay = useMemo(() => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
  }, [startDate, cycleLength]);

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

  const handleWearableSync = async (data: { lastPeriodStart: string; cycleLength: number; menstruationLength: number }) => {
    setStartDate(data.lastPeriodStart);
    setCycleLength(data.cycleLength);
    setMenstruationLength(data.menstruationLength);
    if (!user) return;
    setSaving(true);
    await supabase.from('athlete_profiles').update({
      cycle_start_date: data.startDate,
      cycle_length: data.cycleLength,
      menstruation_length: data.menstruationLength,
    }).eq('user_id', user.id);
    toast({ title: 'Cycle synced from Samsung Health' });
    setSaving(false);
  };

  const handlePeriodToday = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setStartDate(today);
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('athlete_profiles')
      .update({ cycle_start_date: today })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Cycle start updated to today' });
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-heading font-extrabold tracking-tight">Your Cycle</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance awareness through every phase</p>
        </div>

        {/* Samsung Health sync */}
        {user && (
          <WearableCycleSync
            athleteId={user.id}
            onSync={handleWearableSync}
          />
        )}

        {/* Visualization card */}
        <div className="glass-card p-8 flex flex-col items-center gap-6">
          {startDate ? (
            <>
              <CycleRing
                currentPhase={currentPhase}
                cycleDay={cycleDay}
                cycleLength={cycleLength}
                menstruationLength={menstruationLength}
              />
              <PhaseInsight phase={currentPhase} />
            </>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Calendar className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Set your cycle start date below to see your personalised phase ring.
              </p>
            </div>
          )}

          {/* Period Started Today */}
          <button
            onClick={handlePeriodToday}
            disabled={saving}
            className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl uppercase tracking-wider text-sm hover:brightness-110 transition-all disabled:opacity-50"
          >
            Period Started Today
          </button>
        </div>

        {/* Cycle Details — collapsible secondary card */}
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="w-full flex items-center justify-between px-6 py-4 text-left"
          >
            <span className="font-heading font-bold text-sm uppercase tracking-wider text-muted-foreground">
              Cycle Details
            </span>
            {detailsOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {detailsOpen && (
            <div className="px-6 pb-6 space-y-5 border-t border-border pt-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Last cycle start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Average cycle length (days)
                </label>
                <input
                  type="number"
                  min={20}
                  max={45}
                  value={cycleLength}
                  onChange={e => setCycleLength(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Average menstruation length (days)
                </label>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={menstruationLength}
                  onChange={e => setMenstruationLength(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Hormonal contraceptive use
                </label>
                <Switch checked={contraceptive} onCheckedChange={setContraceptive} />
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-secondary text-foreground font-bold rounded-lg text-sm uppercase tracking-wider hover:bg-secondary/80 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
