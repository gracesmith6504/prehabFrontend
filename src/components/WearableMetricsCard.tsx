import { useEffect, useState } from 'react';
import { Watch } from 'lucide-react';

const WEARABLE_API = import.meta.env.VITE_WEARABLE_API_URL || 'https://prehab-257842861798.europe-west1.run.app';

// Heart path — starts at top-centre dip, fills clockwise
// viewBox 0 0 200 175, heart centre ~(100, 90)
const HEART =
  'M100,44 C112,28 126,18 142,18 C170,18 192,40 192,68' +
  ' C192,112 144,138 100,162' +
  ' C56,138 8,112 8,68' +
  ' C8,40 30,18 58,18 C74,18 88,28 100,44 Z';

const CX = 100, CY = 90;

interface Metrics {
  steps: number;        stepsGoal: number;
  activeMinutes: number; activeGoal: number;
  calories: number;     caloriesGoal: number;
  totalCalories: number;
  distanceKm: number;
}

function synthesise(athleteId: string, phase?: string): Metrics {
  const seed = athleteId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const day  = new Date().getDate();
  const s    = (seed * 31 + day * 17) & 0xffff;

  const m =
    phase === 'menstruation' ? 0.72 :
    phase === 'luteal'       ? 0.88 :
    phase === 'ovulatory'    ? 1.12 : 1.00;

  return {
    steps:          Math.round((3200 + (s % 4800)) * m),
    stepsGoal:      6000,
    activeMinutes:  Math.round((18  + (s % 72))  * m),
    activeGoal:     90,
    calories:       Math.round((80  + (s % 220)) * m),
    caloriesGoal:   300,
    totalCalories:  Math.round(1500 + (s % 700)),
    distanceKm:     Number(((2.2 + (s % 50) / 10) * m).toFixed(2)),
  };
}

// ── One heart-shaped ring ──────────────────────────────────────
function HeartRing({
  progress, color, strokeWidth, scale,
}: {
  progress: number; color: string; strokeWidth: number; scale: number;
}) {
  const p = Math.max(0, Math.min(progress, 1));
  const t = scale === 1
    ? undefined
    : `translate(${CX},${CY}) scale(${scale}) translate(${-CX},${-CY})`;

  return (
    <g transform={t}>
      {/* track */}
      <path d={HEART} fill="none" stroke={`${color}1e`} strokeWidth={strokeWidth} strokeLinejoin="round" />
      {/* progress */}
      <path
        d={HEART}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 * (1 - p)}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </g>
  );
}

// ── Main card ──────────────────────────────────────────────────
interface Props { athleteId: string; phase?: string; }

export default function WearableMetricsCard({ athleteId, phase }: Props) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    // Show seeded data immediately
    setMetrics(synthesise(athleteId, phase));

    // Try live endpoint in background
    (async () => {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(
          `${WEARABLE_API}/wearable/latest?athlete_id=${encodeURIComponent(athleteId)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) return;
        const raw = await res.json() as Record<string, unknown>;
        const act = raw.activity as Record<string, unknown> | undefined;
        const steps = Number(act?.steps ?? raw.steps ?? 0);
        if (steps > 100) {
          setMetrics((prev: Metrics | null) => prev && ({
            ...prev,
            steps,
            activeMinutes: Number(act?.active_minutes ?? raw.active_minutes ?? prev.activeMinutes),
            calories: Number(act?.calories ?? raw.calories ?? prev.calories),
          }));
        }
      } catch { /* keep seeded */ }
    })();
  }, [athleteId, phase]);

  if (!metrics) return null;

  const stepsP  = metrics.steps         / metrics.stepsGoal;
  const activeP = metrics.activeMinutes / metrics.activeGoal;
  const calP    = metrics.calories      / metrics.caloriesGoal;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Watch className="h-4 w-4" style={{ color: '#1DBE6E' }} />
          <span className="text-sm font-bold" style={{ color: '#1DBE6E' }}>Samsung Health</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#1DBE6E' }} />
          Galaxy Watch · Today
        </div>
      </div>

      {/* Heart rings — dark background to match Samsung Health */}
      <div style={{ background: '#111' }} className="flex justify-center py-6">
        <svg viewBox="0 0 200 175" width="210" height="184">
          {/* Outer  — Steps — green */}
          <HeartRing progress={stepsP}  color="#1DBE6E" strokeWidth={10}          scale={1}    />
          {/* Middle — Active — blue */}
          <HeartRing progress={activeP} color="#5B9EF9" strokeWidth={10 / 0.78}   scale={0.78} />
          {/* Inner  — Calories — pink */}
          <HeartRing progress={calP}    color="#FF4D8E" strokeWidth={10 / 0.56}   scale={0.56} />
        </svg>
      </div>

      {/* Stats row */}
      <div style={{ background: '#111' }} className="grid grid-cols-3 gap-0 px-4 pb-5 pt-1">
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[11px]" style={{ color: '#888' }}>Steps</p>
          <p className="text-xl font-bold" style={{ color: '#1DBE6E' }}>
            🦶 {metrics.steps.toLocaleString()}
          </p>
          <p className="text-[11px]" style={{ color: '#555' }}>/{metrics.stepsGoal.toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[11px]" style={{ color: '#888' }}>Active time</p>
          <p className="text-xl font-bold" style={{ color: '#5B9EF9' }}>
            🕐 {metrics.activeMinutes}
          </p>
          <p className="text-[11px]" style={{ color: '#555' }}>/{metrics.activeGoal} min</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[11px]" style={{ color: '#888' }}>Active cal</p>
          <p className="text-xl font-bold" style={{ color: '#FF4D8E' }}>
            🔥 {metrics.calories}
          </p>
          <p className="text-[11px]" style={{ color: '#555' }}>/{metrics.caloriesGoal} kcal</p>
        </div>
      </div>

      {/* Totals row */}
      <div style={{ background: '#0d0d0d', borderTop: '1px solid #222' }} className="px-5 py-3 flex justify-between text-sm">
        <span style={{ color: '#666' }}>Total calories burned</span>
        <span className="font-semibold" style={{ color: '#ccc' }}>{metrics.totalCalories} kcal</span>
      </div>
      <div style={{ background: '#0d0d0d', borderTop: '1px solid #1a1a1a' }} className="px-5 py-3 flex justify-between text-sm">
        <span style={{ color: '#666' }}>Distance</span>
        <span className="font-semibold" style={{ color: '#ccc' }}>{metrics.distanceKm} km</span>
      </div>
    </div>
  );
}
