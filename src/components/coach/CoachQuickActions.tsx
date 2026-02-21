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
    { label: 'Export Report', icon: Download, onClick: () => toast.info('Report export coming soon') },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(a => (
        <Button key={a.label} variant="outline" size="sm" className="gap-1.5 font-medium" onClick={a.onClick}>
          <a.icon className="h-3.5 w-3.5" />
          {a.label}
        </Button>
      ))}
    </div>
  );
}
