import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { format } from 'date-fns';

interface Session {
  id: string;
  date: string;
  sport: string;
  session_type: string;
  duration: number;
  intensity: string;
  rpe: number;
}

export default function TrainingHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('training_sessions')
      .select('id, date, sport, session_type, duration, intensity, rpe')
      .eq('athlete_id', user.id)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setSessions(data ?? []);
        setLoading(false);
      });
  }, [user]);

  const intensityColor = (i: string) => {
    if (i === 'High') return 'text-destructive';
    if (i === 'Medium') return 'text-warning';
    return 'text-primary';
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-heading font-bold mb-6">TRAINING HISTORY</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">
            No training sessions logged yet.
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Intensity</TableHead>
                  <TableHead>RPE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{format(new Date(s.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{s.sport}</TableCell>
                    <TableCell>{s.session_type}</TableCell>
                    <TableCell>{s.duration} min</TableCell>
                    <TableCell className={intensityColor(s.intensity)}>{s.intensity}</TableCell>
                    <TableCell>{s.rpe}/10</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
