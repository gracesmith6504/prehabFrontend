import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const EVIDENCE_API = 'https://prehab-257842861798.europe-west1.run.app';

interface Citation {
  authors: string;
  title: string;
  journal: string;
  year: number;
  url: string;
}

interface StatMultiplier {
  type: string;
  value: number;
  condition: string;
}

interface RiskFactor {
  factor_name: string;
  description: string;
  statistical_multiplier: StatMultiplier;
  citation: Citation;
  self_reportable: boolean;
}

interface EvidenceData {
  risk_factors: RiskFactor[];
  base_injury_rate: {
    value: number;
    unit: string;
    citation: Citation;
  };
}

function CitationLine({ c }: { c: Citation }) {
  const year = c.year > 0 ? ` (${c.year})` : '';
  return (
    <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic leading-tight">
      {c.authors}{year}. <span className="not-italic">{c.journal}</span>
    </p>
  );
}

export default function EvidencePanel() {
  const [data, setData] = useState<EvidenceData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${EVIDENCE_API}/evidence`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch { /* silently skip */ }
    })();
  }, []);

  if (!data) return null;

  const bir = data.base_injury_rate;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold uppercase tracking-wider font-heading">Research Basis</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Base injury rate&nbsp;
            <span className="font-semibold text-foreground">{bir.value} {bir.unit}</span>
            {bir.citation.year > 0 && (
              <span> · {bir.citation.authors} ({bir.citation.year})</span>
            )}
          </p>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Expanded factor list */}
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {data.risk_factors.map((f) => {
            const hasMultiplier = f.statistical_multiplier.value > 0;
            return (
              <div key={f.factor_name} className="px-5 py-3 space-y-0.5">
                <div className="flex items-start gap-2">
                  <p className="text-sm font-semibold flex-1">{f.factor_name}</p>
                  {hasMultiplier && (
                    <span className="text-[11px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                      {f.statistical_multiplier.type}&nbsp;{f.statistical_multiplier.value}×
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{f.description}</p>
                {hasMultiplier && f.statistical_multiplier.condition && (
                  <p className="text-[11px] text-muted-foreground/70 italic">{f.statistical_multiplier.condition}</p>
                )}
                <CitationLine c={f.citation} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
