import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  athleteId: string;
  weeklyPlanId?: string;
  riskPredictionId?: string;
  agentRunId?: string;
  onFeedbackGiven?: () => void;
}

export default function FeedbackButtons({ athleteId, weeklyPlanId, riskPredictionId, agentRunId, onFeedbackGiven }: Props) {
  const { user, profile } = useAuth();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [reason, setReason] = useState('');

  const submitFeedback = async (type: string, reasonText?: string) => {
    if (!user) return;
    const { error } = await supabase.from('feedback_events').insert({
      athlete_id: athleteId,
      agent_run_id: agentRunId || null,
      weekly_plan_id: weeklyPlanId || null,
      risk_prediction_id: riskPredictionId || null,
      feedback_type: type,
      reason: reasonText || null,
      given_by: user.id,
    });
    if (error) {
      toast.error('Failed to submit feedback');
      return;
    }
    setSubmitted(type);
    toast.success(`Feedback recorded: ${type}`);
    onFeedbackGiven?.();
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary">
        <Check className="h-4 w-4" />
        <span>Feedback: <span className="font-bold capitalize">{submitted}</span></span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => submitFeedback('accepted')}>
          <ThumbsUp className="h-3.5 w-3.5" /> Accept Plan
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => submitFeedback('rejected')}>
          <ThumbsDown className="h-3.5 w-3.5" /> Reject Plan
        </Button>
        {profile?.role === 'coach' && (
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setModifyOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Modify
          </Button>
        )}
      </div>

      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Plan</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Describe your modifications or reasons..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setModifyOpen(false)}>Cancel</Button>
            <Button onClick={() => { submitFeedback('modified', reason); setModifyOpen(false); }}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
