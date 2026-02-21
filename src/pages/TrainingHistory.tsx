import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { format } from 'date-fns';
import { Search, CalendarIcon, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  const [sportFilter, setSportFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

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

  const sports = useMemo(() => [...new Set(sessions.map(s => s.sport))], [sessions]);
  const types = useMemo(() => [...new Set(sessions.map(s => s.session_type))], [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (sportFilter !== 'all' && s.sport !== sportFilter) return false;
      if (typeFilter !== 'all' && s.session_type !== typeFilter) return false;
      if (dateFrom && new Date(s.date) < dateFrom) return false;
      if (dateTo && new Date(s.date) > dateTo) return false;
      return true;
    });
  }, [sessions, sportFilter, typeFilter, dateFrom, dateTo]);

  const hasFilters = sportFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setSportFilter('all');
    setTypeFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const intensityColor = (i: string) => {
    if (i === 'High') return 'text-destructive';
    if (i === 'Medium') return 'text-warning';
    return 'text-primary';
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-heading font-bold mb-6">TRAINING HISTORY</h1>

        {/* Filters */}
        <div className="glass-card p-4 mb-4 flex flex-wrap items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />

          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-[140px] bg-secondary border-border">
              <SelectValue placeholder="Sport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              {sports.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px] bg-secondary border-border">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] justify-start text-left text-sm", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, 'dd MMM yy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] justify-start text-left text-sm", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, 'dd MMM yy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}

          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">
            {sessions.length === 0 ? 'No training sessions logged yet.' : 'No sessions match your filters.'}
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
                {filtered.map(s => (
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
