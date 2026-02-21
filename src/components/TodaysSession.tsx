import { useState } from 'react';
import { type PlanSession } from '@/lib/riskEngine';
import SessionLogDialog from '@/components/SessionLogDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, CheckCircle2, Coffee } from 'lucide-react';

interface SessionLog {
  id: string;
  duration: number;
  rpe: number;
}

interface Props {
  session: PlanSession | null;
  athleteId: string;
  existingLog: SessionLog | null;
  onLogged: () => void;
}

export default function TodaysSession({ session, athleteId, existingLog, onLogged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!session) {
    return (
      <div className="glass-card p-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Coffee className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading font-bold text-lg">Recovery / Rest Day</h2>
          <p className="text-sm text-muted-foreground">No session scheduled. Listen to your body.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          Log Activity
        </Button>
        <SessionLogDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          session={{ day: new Date().toLocaleDateString('en-US', { weekday: 'long' }), type: 'Optional Activity', intensity: 'Low', duration: 30 }}
          date={new Date()}
          athleteId={athleteId}
          existingLog={null}
          onLogged={onLogged}
        />
      </div>
    );
  }

  const isCompleted = !!existingLog;

  const intensityVariant = session.intensity === 'High' ? 'destructive' : session.intensity === 'Medium' ? 'secondary' : 'outline';

  return (
    <>
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg uppercase tracking-wider">Today's Session</h2>
          <Badge variant={isCompleted ? 'default' : 'secondary'} className="gap-1">
            {isCompleted ? <><CheckCircle2 className="h-3 w-3" /> Completed</> : <><PlayCircle className="h-3 w-3" /> Upcoming</>}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-5">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
            <p className="font-heading font-bold text-base sm:text-lg mt-1">{session.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Intensity</p>
            <Badge variant={intensityVariant} className="mt-1">{session.intensity}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
            <p className="font-heading font-bold text-base sm:text-lg mt-1">{session.duration}<span className="text-sm font-normal text-muted-foreground"> min</span></p>
          </div>
        </div>

        {isCompleted ? (
          <div className="flex items-center flex-wrap gap-3 sm:gap-4 text-sm text-muted-foreground">
            <span>RPE: <strong className="text-foreground">{existingLog.rpe}/10</strong></span>
            <span>Actual: <strong className="text-foreground">{existingLog.duration} min</strong></span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDialogOpen(true)}>
              Edit Log
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setDialogOpen(true)}>
            Log Session
          </Button>
        )}
      </div>

      <SessionLogDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        session={session}
        date={new Date()}
        athleteId={athleteId}
        existingLog={existingLog}
        onLogged={onLogged}
      />
    </>
  );
}
