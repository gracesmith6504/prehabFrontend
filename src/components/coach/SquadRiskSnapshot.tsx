import { TrendingUp, TrendingDown, Minus, AlertTriangle, Shield, Activity, Flame, Zap } from 'lucide-react';

interface Props {
  avgRisk: number;
  prevAvgRisk: number | null;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  activeEscalations: number;
}

export default function SquadRiskSnapshot({ avgRisk, prevAvgRisk, criticalCount, highCount, mediumCount, activeEscalations }: Props) {
  const delta = prevAvgRisk !== null ? avgRisk - prevAvgRisk : null;
  const TrendIcon = delta === null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta === null ? 'text-muted-foreground' : delta > 0 ? 'text-destructive' : delta < 0 ? 'text-primary' : 'text-muted-foreground';

  const cards = [
    {
      label: 'Avg Squad Risk',
      value: avgRisk,
      icon: Shield,
      accent: avgRisk >= 60 ? 'text-destructive' : 'text-foreground',
      extra: delta !== null ? (
        <span className={`text-xs font-medium ${trendColor} flex items-center gap-0.5`}>
          <TrendIcon className="h-3 w-3" />
          {delta > 0 ? '+' : ''}{delta} vs yesterday
        </span>
      ) : null,
    },
    {
      label: 'Critical Risk',
      value: criticalCount,
      icon: Zap,
      accent: criticalCount > 0 ? 'risk-critical' : 'text-muted-foreground',
    },
    {
      label: 'High Risk',
      value: highCount,
      icon: Flame,
      accent: highCount > 0 ? 'risk-high' : 'text-muted-foreground',
    },
    {
      label: 'Active Escalations',
      value: activeEscalations,
      icon: AlertTriangle,
      accent: activeEscalations > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
            </div>
            <span className={`text-3xl font-heading font-bold ${card.accent}`}>{card.value}</span>
            {card.extra && <div>{card.extra}</div>}
          </div>
        );
      })}
    </div>
  );
}
