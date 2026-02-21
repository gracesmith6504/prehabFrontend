import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Clock } from 'lucide-react';

export default function LastEvaluatedLine() {
  const [lastTime, setLastTime] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('agent_runs')
        .select('completed_at')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.completed_at) {
        setLastTime(formatDistanceToNow(new Date(data.completed_at), { addSuffix: true }));
      }
    };
    load();
  }, []);

  if (!lastTime) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>Last evaluated {lastTime}</span>
    </div>
  );
}
