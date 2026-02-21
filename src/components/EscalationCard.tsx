import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface Escalation {
  id: string;
  athlete_id: string;
  trigger_reason: string;
  status: string;
  created_at: string;
  notes: string | null;
  athlete_name?: string;
  athlete_email?: string;
  risk_score?: number;
}

interface Props {
  escalation: Escalation;
  onUpdate?: () => void;
}

export default function EscalationCard({ escalation, onUpdate }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState(escalation.status);
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: string) => {
    if (!user) return;
    setLoading(true);
    const updates: any = { status: newStatus };
    if (newStatus === 'acknowledged') {
      updates.acknowledged_by = user.id;
      updates.acknowledged_at = new Date().toISOString();
    } else if (newStatus === 'resolved') {
      updates.resolved_by = user.id;
      updates.resolved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('escalations').update(updates).eq('id', escalation.id);
    if (error) {
      toast.error('Failed to update escalation');
    } else {
      setStatus(newStatus);
      toast.success(`Escalation ${newStatus}`);
      onUpdate?.();
    }
    setLoading(false);
  };

  const statusColor = status === 'open' ? 'text-destructive' : status === 'acknowledged' ? 'text-warning' : 'text-primary';

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${
      status === 'open' ? 'border-destructive/30 bg-destructive/5' :
      status === 'acknowledged' ? 'border-warning/30 bg-warning/5' :
      'border-primary/30 bg-primary/5'
    }`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${statusColor}`} />
          <span className="font-bold text-sm">{escalation.athlete_name || escalation.athlete_email || 'Unknown'}</span>
          {escalation.risk_score !== undefined && (
            <span className="text-sm font-heading font-bold text-destructive">{escalation.risk_score}</span>
          )}
        </div>
        <span className={`text-xs font-bold uppercase ${statusColor}`}>{status}</span>
      </div>

      <p className="text-sm text-muted-foreground">{escalation.trigger_reason}</p>

      {status !== 'resolved' && (
        <div className="flex gap-2">
          {status === 'open' && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateStatus('acknowledged')} disabled={loading}>
              <Eye className="h-3.5 w-3.5" /> Acknowledge
            </Button>
          )}
          <Button size="sm" variant="default" className="gap-1.5" onClick={() => updateStatus('resolved')} disabled={loading}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
          </Button>
        </div>
      )}
    </div>
  );
}
