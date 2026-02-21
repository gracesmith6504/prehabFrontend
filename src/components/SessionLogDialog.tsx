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
import { CheckCircle2, Clock, Gauge, StickyNote, HeartPulse } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const MUSCLE_GROUPS = ['knee', 'hamstring', 'groin', 'calf'] as const;

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

  const dateStr = date.toISOString().split('T')[0];
  const isEditing = !!existingLog;

  // Load existing soreness for this date
  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const { data } = await supabase
        .from('soreness_logs')
        .select('id, knee, hamstring, groin, calf')
        .eq('athlete_id', athleteId)
        .eq('date', dateStr)
        .limit(1)
        .maybeSingle();
      if (data) {
        setSoreness({ knee: data.knee, hamstring: data.hamstring, groin: data.groin, calf: data.calf });
        setExistingSorenessId(data.id);
      } else {
        setSoreness({ knee: 0, hamstring: 0, groin: 0, calf: 0 });
        setExistingSorenessId(null);
      }
    };
    load();
  }, [open, athleteId, dateStr]);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setDuration(existingLog?.duration ?? session.duration);
      setRpe(existingLog?.rpe ?? 5);
      setNotes(existingLog?.notes ?? '');
    }
  }, [open, existingLog, session]);

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

      // Save soreness log
      const hasSoreness = Object.values(soreness).some(v => v > 0);
      if (hasSoreness) {
        if (existingSorenessId) {
          await supabase.from('soreness_logs').update({
            knee: soreness.knee, hamstring: soreness.hamstring,
            groin: soreness.groin, calf: soreness.calf,
          }).eq('id', existingSorenessId);
        } else {
          await supabase.from('soreness_logs').insert({
            athlete_id: athleteId, date: dateStr,
            knee: soreness.knee, hamstring: soreness.hamstring,
            groin: soreness.groin, calf: soreness.calf,
          });
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
                {MUSCLE_GROUPS.map(muscle => (
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
