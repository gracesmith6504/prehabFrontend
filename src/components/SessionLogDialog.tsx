import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PlanSession } from '@/lib/riskEngine';
import { CheckCircle2, Clock, Gauge, StickyNote, HeartPulse, Plus, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_MUSCLES = ['knee', 'hamstring', 'groin', 'calf'] as const;

interface SessionLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: PlanSession;
  date: Date;
  athleteId: string;
  existingLog?: {
    id: string;
    duration: number;
    rpe: number;
    notes?: string;
  } | null;
  onLogged: () => void;
}

export default function SessionLogDialog({
  open, onOpenChange, session, date, athleteId, existingLog, onLogged,
}: SessionLogDialogProps) {
  const { toast } = useToast();
  const [duration, setDuration] = useState(existingLog?.duration ?? session.duration);
  const [rpe, setRpe] = useState(existingLog?.rpe ?? 5);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  const [saving, setSaving] = useState(false);

  // Soreness state
  const [soreness, setSoreness] = useState<Record<string, number>>({
    knee: 0, hamstring: 0, groin: 0, calf: 0,
  });
  const [existingSorenessId, setExistingSorenessId] = useState<string | null>(null);

  // Custom body parts
  const [customParts, setCustomParts] = useState<string[]>([]);
  const [customSoreness, setCustomSoreness] = useState<Record<string, number>>({});
  const [newPartLabel, setNewPartLabel] = useState('');
  const [showAddPart, setShowAddPart] = useState(false);

  const dateStr = date.toISOString().split('T')[0];
  const isEditing = !!existingLog;

  // Load existing soreness + custom parts for this athlete
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      // Load default soreness for this date
      const { data } = await supabase
        .from('soreness_logs')
        .select('id, knee, hamstring, groin, calf, other_label, other_value')
        .eq('athlete_id', athleteId)
        .eq('date', dateStr);

      if (data && data.length > 0) {
        // First row has defaults
        const base = data[0];
        setSoreness({ knee: base.knee, hamstring: base.hamstring, groin: base.groin, calf: base.calf });
        setExistingSorenessId(base.id);

        // Gather custom parts from all rows with other_label
        const customs: Record<string, { value: number }> = {};
        data.forEach(row => {
          if (row.other_label) {
            customs[row.other_label] = { value: row.other_value || 0 };
          }
        });
        const customLabels = Object.keys(customs);
        setCustomParts(customLabels);
        const customVals: Record<string, number> = {};
        customLabels.forEach(l => { customVals[l] = customs[l].value; });
        setCustomSoreness(customVals);
      } else {
        setSoreness({ knee: 0, hamstring: 0, groin: 0, calf: 0 });
        setExistingSorenessId(null);
        // Still load known custom parts from past logs
        const { data: pastCustom } = await supabase
          .from('soreness_logs')
          .select('other_label')
          .eq('athlete_id', athleteId)
          .not('other_label', 'is', null);
        if (pastCustom) {
          const unique = [...new Set(pastCustom.map(r => r.other_label).filter(Boolean))] as string[];
          setCustomParts(unique);
          const vals: Record<string, number> = {};
          unique.forEach(l => { vals[l] = 0; });
          setCustomSoreness(vals);
        } else {
          setCustomParts([]);
          setCustomSoreness({});
        }
      }
    };
    load();
  }, [open, athleteId, dateStr]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDuration(existingLog?.duration ?? session.duration);
      setRpe(existingLog?.rpe ?? 5);
      setNotes(existingLog?.notes ?? '');
      setShowAddPart(false);
      setNewPartLabel('');
    }
  }, [open, existingLog, session]);

  const addCustomPart = () => {
    const label = newPartLabel.trim().toLowerCase();
    if (!label) return;
    const allParts = [...DEFAULT_MUSCLES as readonly string[], ...customParts];
    if (allParts.includes(label)) {
      toast({ title: 'Already exists', variant: 'destructive' });
      return;
    }
    setCustomParts(prev => [...prev, label]);
    setCustomSoreness(prev => ({ ...prev, [label]: 0 }));
    setNewPartLabel('');
    setShowAddPart(false);
  };

  const removeCustomPart = (part: string) => {
    setCustomParts(prev => prev.filter(p => p !== part));
    setCustomSoreness(prev => {
      const next = { ...prev };
      delete next[part];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save training session
      if (isEditing && existingLog) {
        await supabase.from('training_sessions').update({
          duration, rpe, intensity: session.intensity, session_type: session.type,
        }).eq('id', existingLog.id);
      } else {
        await supabase.from('training_sessions').insert({
          athlete_id: athleteId, date: dateStr, sport: 'Football',
          duration, rpe, intensity: session.intensity, session_type: session.type,
        });
      }

      // Delete existing soreness logs for this date to re-insert cleanly
      await supabase.from('soreness_logs').delete().eq('athlete_id', athleteId).eq('date', dateStr);

      // Insert base soreness row
      const hasSoreness = Object.values(soreness).some(v => v > 0) || Object.values(customSoreness).some(v => v > 0);
      if (hasSoreness || customParts.length > 0) {
        // Insert base row (with first custom part if any, otherwise no other_label)
        if (customParts.length === 0) {
          await supabase.from('soreness_logs').insert({
            athlete_id: athleteId, date: dateStr,
            knee: soreness.knee, hamstring: soreness.hamstring,
            groin: soreness.groin, calf: soreness.calf,
          });
        } else {
          // Insert one row per custom part (plus base defaults on first)
          for (let i = 0; i < customParts.length; i++) {
            const part = customParts[i];
            await supabase.from('soreness_logs').insert({
              athlete_id: athleteId, date: dateStr,
              knee: i === 0 ? soreness.knee : 0,
              hamstring: i === 0 ? soreness.hamstring : 0,
              groin: i === 0 ? soreness.groin : 0,
              calf: i === 0 ? soreness.calf : 0,
              other_label: part,
              other_value: customSoreness[part] || 0,
            });
          }
          // If no custom parts had the base values yet and we only have custom parts
          if (customParts.length === 0) {
            await supabase.from('soreness_logs').insert({
              athlete_id: athleteId, date: dateStr,
              knee: soreness.knee, hamstring: soreness.hamstring,
              groin: soreness.groin, calf: soreness.calf,
            });
          }
        }
      }

      toast({ title: isEditing ? 'Session updated' : 'Session logged', description: `${session.type} on ${session.day}` });
      onLogged();
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save session', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const rpeColor = rpe <= 3 ? 'text-primary' : rpe <= 6 ? 'text-warning' : 'text-destructive';
  const sorenessColor = (v: number) => v <= 3 ? 'text-primary' : v <= 6 ? 'text-warning' : 'text-destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] p-0">
        <ScrollArea className="max-h-[85vh] p-6">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {isEditing ? 'Edit Session Log' : 'Log Session'}
            </DialogTitle>
            <DialogDescription>
              {session.day} — {session.type} ({session.intensity})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-4">
            {/* Planned info */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary">{session.type}</Badge>
              <Badge variant="outline">{session.intensity}</Badge>
              <Badge variant="outline">{session.duration}min planned</Badge>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Actual Duration (min)
              </label>
              <Input
                type="number"
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                min={0}
                max={300}
              />
            </div>

            {/* RPE */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                RPE
                <span className={`ml-auto text-lg font-heading font-bold ${rpeColor}`}>{rpe}</span>
              </label>
              <Slider
                value={[rpe]}
                onValueChange={([v]) => setRpe(v)}
                min={1}
                max={10}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Easy</span><span>Moderate</span><span>Max effort</span>
              </div>
            </div>

            {/* Muscle Soreness */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-muted-foreground" />
                Muscle Soreness
              </label>
              <div className="space-y-3 rounded-lg border border-border p-3 bg-secondary/30">
                {/* Default muscles */}
                {DEFAULT_MUSCLES.map(muscle => (
                  <div key={muscle} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs capitalize text-muted-foreground">{muscle}</span>
                      <span className={`text-xs font-bold ${sorenessColor(soreness[muscle])}`}>
                        {soreness[muscle]}/10
                      </span>
                    </div>
                    <Slider
                      value={[soreness[muscle]]}
                      onValueChange={([v]) => setSoreness(s => ({ ...s, [muscle]: v }))}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                ))}

                {/* Custom body parts */}
                {customParts.map(part => (
                  <div key={part} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs capitalize text-muted-foreground">{part}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${sorenessColor(customSoreness[part] || 0)}`}>
                          {customSoreness[part] || 0}/10
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCustomPart(part); }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <Slider
                      value={[customSoreness[part] || 0]}
                      onValueChange={([v]) => setCustomSoreness(s => ({ ...s, [part]: v }))}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                ))}

                {/* Add custom part */}
                {showAddPart ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newPartLabel}
                      onChange={e => setNewPartLabel(e.target.value)}
                      placeholder="e.g. ankle, shoulder"
                      className="h-8 text-xs"
                      onKeyDown={e => e.key === 'Enter' && addCustomPart()}
                      autoFocus
                    />
                    <Button size="sm" variant="secondary" className="h-8 px-3 text-xs" onClick={addCustomPart}>
                      Add
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => { setShowAddPart(false); setNewPartLabel(''); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddPart(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors pt-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add body part
                  </button>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                Notes (optional)
              </label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="How did it feel? Any issues?"
                rows={2}
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : isEditing ? 'Update Log' : 'Log Session'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
