import { TrendingUp, TrendingDown, Minus, AlertTriangle, Users, Activity, Shield } from 'lucide-react';

interface Props {
  avgRisk: number;
  prevAvgRisk: number | null;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  activeEscalations: number;
  totalAthletes: number;
}

export default function SquadRiskSnapshot({ avgRisk, prevAvgRisk, lowCount, mediumCount, highCount, activeEscalations, totalAthletes }: Props) {
  const delta = prevAvgRisk !== null ? avgRisk - prevAvgRisk : null;
  const TrendIcon = delta === null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta === null ? 'text-muted-foreground' : delta > 0 ? 'text-destructive' : delta < 0 ? 'text-primary' : 'text-muted-foreground';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {/* Avg Risk */}
      <div className="glass-card p-5 col-span-2 lg:col-span-1 flex flex-col items-center justify-center gap-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Avg Squad Risk</p>
        <div className="flex items-center gap-2">
          <span className="text-4xl font-heading font-bold">{avgRisk}</span>
          {delta !== null && (
            <div className={`flex items-center gap-0.5 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              <span className="text-sm font-bold">{delta > 0 ? '+' : ''}{delta}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">vs yesterday</p>
      </div>

      {/* Distribution */}
      <div className="glass-card p-5 flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Low Risk</p>
        <span className="text-3xl font-heading font-bold text-primary">{lowCount}</span>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${totalAthletes ? (lowCount / totalAthletes) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="glass-card p-5 flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Medium</p>
        <span className="text-3xl font-heading font-bold" style={{ color: 'hsl(var(--warning))' }}>{mediumCount}</span>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${totalAthletes ? (mediumCount / totalAthletes) * 100 : 0}%`, background: 'hsl(var(--warning))' }} />
        </div>
      </div>

      <div className="glass-card p-5 flex flex-col items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">High Risk</p>
        <span className="text-3xl font-heading font-bold text-destructive">{highCount}</span>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div className="bg-destructive h-1.5 rounded-full transition-all" style={{ width: `${totalAthletes ? (highCount / totalAthletes) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Active Escalations */}
      <div className={`glass-card p-5 flex flex-col items-center justify-center gap-1 ${activeEscalations > 0 ? 'border-destructive/40 neon-border' : ''}`}
           style={activeEscalations > 0 ? { boxShadow: 'inset 0 0 0 1px hsl(0 72% 51% / 0.3), 0 0 20px hsl(0 72% 51% / 0.2)' } : {}}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Escalations</p>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-5 w-5 ${activeEscalations > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`text-3xl font-heading font-bold ${activeEscalations > 0 ? 'text-destructive' : ''}`}>{activeEscalations}</span>
        </div>
        <p className="text-xs text-muted-foreground">active</p>
      </div>
    </div>
  );
}
