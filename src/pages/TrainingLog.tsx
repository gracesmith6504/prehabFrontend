import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useToast } from '@/hooks/use-toast';
import { Dumbbell, Plus } from 'lucide-react';

const DEFAULT_SESSION_TYPES = ['Strength', 'Plyometrics', 'Sprint', 'Match', 'Recovery'];
const INTENSITIES = ['Low', 'Medium', 'High'];

export default function TrainingLog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sport, setSport] = useState('Football');
  const [duration, setDuration] = useState(60);
  const [intensity, setIntensity] = useState('Medium');
  const [rpe, setRpe] = useState(5);
  const [sessionType, setSessionType] = useState('Strength');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');
  const [showAddType, setShowAddType] = useState(false);
  const [saving, setSaving] = useState(false);

  const allTypes = [...DEFAULT_SESSION_TYPES, ...customTypes];

  const addCustomType = () => {
    const label = newType.trim();
    if (!label) return;
    if (allTypes.some(t => t.toLowerCase() === label.toLowerCase())) {
      toast({ title: 'Already exists', variant: 'destructive' });
      return;
    }
    setCustomTypes(prev => [...prev, label]);
    setSessionType(label);
    setNewType('');
    setShowAddType(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('training_sessions').insert({
      athlete_id: user.id,
      date,
      sport,
      duration,
      intensity,
      rpe,
      session_type: sessionType,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Training session logged!' });
      setDuration(60);
      setRpe(5);
    }
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold flex items-center gap-3">
            <Dumbbell className="h-8 w-8 text-primary" />
            LOG TRAINING
          </h1>
          <p className="text-muted-foreground mt-1">Record your training session details.</p>
        </div>

        <div className="glass-card p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Sport</label>
            <input type="text" value={sport} onChange={e => setSport(e.target.value)}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Duration (minutes)</label>
            <input type="number" min={1} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))}
              className="w-full px-4 py-3 bg-secondary rounded-lg border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Intensity</label>
            <div className="grid grid-cols-3 gap-2">
              {INTENSITIES.map(i => (
                <button key={i} type="button" onClick={() => setIntensity(i)}
                  className={`py-2 rounded-lg text-sm font-bold uppercase ${
                    intensity === i ? 'bg-primary/20 text-primary neon-border' : 'bg-secondary text-muted-foreground'
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">RPE (1–10): {rpe}</label>
            <input type="range" min={1} max={10} value={rpe} onChange={e => setRpe(Number(e.target.value))}
              className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Easy</span><span>Max Effort</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Session Type</label>
            <div className="grid grid-cols-3 gap-2">
              {allTypes.map(t => (
                <button key={t} type="button" onClick={() => setSessionType(t)}
                  className={`py-2 rounded-lg text-xs font-bold uppercase ${
                    sessionType === t ? 'bg-primary/20 text-primary neon-border' : 'bg-secondary text-muted-foreground'
                  }`}>
                  {t}
                </button>
              ))}
              {showAddType ? (
                <div className="col-span-3 flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="New type name"
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomType()}
                    className="flex-1 px-3 py-2 bg-secondary rounded-lg border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                  />
                  <button onClick={addCustomType}
                    className="px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all">
                    Add
                  </button>
                  <button onClick={() => { setShowAddType(false); setNewType(''); }}
                    className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddType(true)}
                  className="py-2 rounded-lg text-xs font-bold uppercase bg-secondary/50 text-muted-foreground border border-dashed border-border hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-1">
                  <Plus className="h-3 w-3" /> New
                </button>
              )}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-lg uppercase tracking-wider hover:brightness-110 transition-all disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Session'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
