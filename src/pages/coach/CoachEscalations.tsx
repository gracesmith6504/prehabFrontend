import AppLayout from '@/components/AppLayout';
import { AlertTriangle } from 'lucide-react';

export default function CoachEscalations() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Escalations</h1>
        </div>
        <p className="text-muted-foreground">Escalation queue and management — coming soon.</p>
      </div>
    </AppLayout>
  );
}
