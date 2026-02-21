import AppLayout from '@/components/AppLayout';
import { TrendingUp } from 'lucide-react';

export default function CoachAnalytics() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Analytics</h1>
        </div>
        <p className="text-muted-foreground">Team trend analytics and insights — coming soon.</p>
      </div>
    </AppLayout>
  );
}
