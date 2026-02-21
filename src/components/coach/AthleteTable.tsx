import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import RiskBadge from '@/components/RiskBadge';
import { formatDistanceToNow } from 'date-fns';

export interface AthleteRow {
  user_id: string;
  full_name: string | null;
  email: string;
  risk_score: number;
  risk_level: string;
  phase: string | null;
  acr: number | null;
  max_soreness: number;
  escalation_status: string;
  last_agent_run: string | null;
}

interface Props {
  athletes: AthleteRow[];
  onSelectAthlete: (userId: string) => void;
}

export default function AthleteTable({ athletes, onSelectAthlete }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="font-heading text-xs uppercase tracking-wider">Name</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center">Risk</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center">Level</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center hidden md:table-cell">Phase</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center hidden md:table-cell">ACR</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center hidden lg:table-cell">Soreness</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-center hidden lg:table-cell">Escalation</TableHead>
            <TableHead className="font-heading text-xs uppercase tracking-wider text-right hidden xl:table-cell">Last Run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {athletes.map(a => (
            <TableRow
              key={a.user_id}
              className="cursor-pointer hover:bg-secondary/40 transition-colors border-border"
              onClick={() => onSelectAthlete(a.user_id)}
            >
              <TableCell className="font-medium">{a.full_name || a.email}</TableCell>
              <TableCell className="text-center">
                <span className={`font-heading font-bold text-lg ${
                  a.risk_score >= 75 ? 'text-destructive' : a.risk_score >= 50 ? 'risk-medium' : 'text-primary'
                }`}>{a.risk_score}</span>
              </TableCell>
              <TableCell className="text-center"><RiskBadge level={a.risk_level} /></TableCell>
              <TableCell className="text-center capitalize hidden md:table-cell">{a.phase || '—'}</TableCell>
              <TableCell className="text-center hidden md:table-cell">
                <span className={a.acr && a.acr > 1.5 ? 'text-destructive font-bold' : ''}>{a.acr?.toFixed(2) ?? '—'}</span>
              </TableCell>
              <TableCell className="text-center hidden lg:table-cell">
                <SorenessIndicator value={a.max_soreness} />
              </TableCell>
              <TableCell className="text-center hidden lg:table-cell">
                <EscalationBadge status={a.escalation_status} />
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground hidden xl:table-cell">
                {a.last_agent_run ? formatDistanceToNow(new Date(a.last_agent_run), { addSuffix: true }) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}

function SorenessIndicator({ value }: { value: number }) {
  if (value >= 7) return <span className="text-destructive font-bold">{value}/10</span>;
  if (value >= 4) return <span className="risk-medium font-medium">{value}/10</span>;
  return <span className="text-primary">{value}/10</span>;
}

function EscalationBadge({ status }: { status: string }) {
  if (status === 'escalated' || status === 'open') return <span className="risk-badge-high text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Open</span>;
  if (status === 'acknowledged') return <span className="risk-badge-medium text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Ack</span>;
  if (status === 'resolved') return <span className="risk-badge-low text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Resolved</span>;
  return <span className="text-muted-foreground text-xs">—</span>;
}
