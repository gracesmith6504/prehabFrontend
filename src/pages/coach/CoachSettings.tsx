import AppLayout from '@/components/AppLayout';
import { Settings } from 'lucide-react';

export default function CoachSettings() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Settings</h1>
        </div>
        <p className="text-muted-foreground">Coach preferences and configuration — coming soon.</p>
      </div>
    </AppLayout>
  );
}
