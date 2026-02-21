import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SESSION_TYPES = ['Strength', 'Sprint', 'Recovery', 'Plyometrics', 'Match', 'Conditioning', 'Yoga', 'Other'];
const INTENSITIES = ['Low', 'Medium', 'High'];

interface ExtraSession {
  id: string;
  day: string;
  session_type: string;
  intensity: string;
  duration: number;
  notes: string | null;
  week_start: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  athleteId: string;
  weekStart: Date;
  day: string;
  existing?: ExtraSession | null;
  onSaved: () => void;
}

export default function ExtraSessionDialog({ open, onOpenChange, athleteId, weekStart, day, existing, onSaved }: Props) {
  const [sessionType, setSessionType] = useState(existing?.session_type || 'Strength');
  const [intensity, setIntensity] = useState(existing?.intensity || 'Medium');
  const [duration, setDuration] = useState(existing?.duration || 45);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');

    if (existing) {
      const { error } = await supabase.from('athlete_extra_sessions').update({
        session_type: sessionType,
        intensity,
        duration,
        notes: notes || null,
      }).eq('id', existing.id);
      if (error) { toast.error('Failed to update'); setSaving(false); return; }
      toast.success('Extra session updated');
    } else {
      const { error } = await supabase.from('athlete_extra_sessions').insert({
        athlete_id: athleteId,
        week_start: weekStartStr,
        day,
        session_type: sessionType,
        intensity,
        duration,
        notes: notes || null,
      });
      if (error) { toast.error('Failed to add session'); setSaving(false); return; }
      toast.success('Extra session added');
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!existing) return;
    const { error } = await supabase.from('athlete_extra_sessions').delete().eq('id', existing.id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Extra session removed');
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">{existing ? 'Edit' : 'Add'} Extra Session — {day}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Intensity</label>
            <Select value={intensity} onValueChange={setIntensity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTENSITIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration (min)</label>
            <Input type="number" min={5} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {existing && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>Delete</Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : existing ? 'Update' : 'Add Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
