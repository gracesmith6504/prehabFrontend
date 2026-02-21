export default function RiskBadge({ level }: { level: string }) {
  const cls =
    level === 'High' ? 'risk-badge-high' :
    level === 'Medium' ? 'risk-badge-medium' :
    'risk-badge-low';

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${cls}`}>
      {level} Risk
    </span>
  );
}
