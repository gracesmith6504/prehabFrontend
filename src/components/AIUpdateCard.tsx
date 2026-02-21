import { Bot, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  lastUpdated: string | null;
  planAdjusted: boolean;
}

export default function AIUpdateCard({ lastUpdated, planAdjusted }: Props) {
  if (!lastUpdated) return null;

  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h3 className="font-heading font-bold text-sm uppercase tracking-wider">AI Update</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
        </p>
      </div>
      {planAdjusted && (
        <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Plan adjusted
        </div>
      )}
    </div>
  );
}
