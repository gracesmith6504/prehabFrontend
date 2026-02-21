import AppLayout from '@/components/AppLayout';
import { ClipboardList } from 'lucide-react';

export default function CoachPlans() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Plans</h1>
        </div>
        <p className="text-muted-foreground">Coach plan builder and assigned plans — coming soon.</p>
      </div>
    </AppLayout>
  );
}
