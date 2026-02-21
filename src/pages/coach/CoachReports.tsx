import AppLayout from '@/components/AppLayout';
import { FileText } from 'lucide-react';

export default function CoachReports() {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold uppercase tracking-wider">Reports</h1>
        </div>
        <p className="text-muted-foreground">Export and summary reports — coming soon.</p>
      </div>
    </AppLayout>
  );
}
