import { BarChart3, AlertTriangle, FileText, UserPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  onViewAnalytics: () => void;
  onReviewEscalations: () => void;
}

export default function CoachQuickActions({ onViewAnalytics, onReviewEscalations }: Props) {
  const actions = [
  { label: 'Squad Analytics', icon: BarChart3, onClick: onViewAnalytics },
  { label: 'Review Escalations', icon: AlertTriangle, onClick: onReviewEscalations },
  { label: 'Weekly Briefing', icon: FileText, onClick: () => toast.info('Weekly briefing generation coming soon') },
  { label: 'Add Athlete', icon: UserPlus, onClick: () => toast.info('Share your coach ID with athletes to link them') },
  { label: 'Export Report', icon: Download, onClick: () => toast.info('Report export coming soon') }];


  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          className="flex flex-col items-center gap-2 h-auto py-4 font-heading text-xs uppercase tracking-wider"
          onClick={action.onClick}
        >
          <action.icon className="h-5 w-5 text-primary" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}