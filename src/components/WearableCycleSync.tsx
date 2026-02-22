import { useState } from 'react';
import { RefreshCw, Watch, CheckCircle2, AlertCircle } from 'lucide-react';

const SAMSUNG_GREEN = '#1DBE6E';
const WEARABLE_API = 'https://prehab-257842861798.europe-west1.run.app';

interface CycleWearableData {
  lastPeriodStart: string;
  cycleLength: number;
  menstruationLength: number;
  currentPhase?: string;
  cycleDay?: number;
}

interface Props {
  athleteId: string;
  onSync: (data: CycleWearableData) => void;
}

function parseCycleResponse(raw: Record<string, unknown>): CycleWearableData | null {
  // Try various field name conventions the API might use
  const lastPeriodStart =
    (raw.last_period_start as string) ||
    (raw.last_period_date as string) ||
    (raw.cycle_start_date as string) ||
    (raw.period_start as string);

  const cycleLength =
    Number(raw.cycle_length_days ?? raw.cycle_length ?? raw.cycle_length_days ?? 28);

  const menstruationLength =
    Number(raw.menstruation_length_days ?? raw.menstruation_length ?? raw.period_length ?? 5);

  const currentPhase =
    (raw.current_phase as string) || (raw.phase as string) || undefined;

  const cycleDay = raw.cycle_day ? Number(raw.cycle_day) : undefined;

  // Validate we got something usable
  if (!lastPeriodStart || isNaN(cycleLength) || cycleLength < 20 || cycleLength > 45) {
    return null;
  }

  return {
    lastPeriodStart,
    cycleLength: Math.round(cycleLength),
    menstruationLength: Math.round(menstruationLength),
    currentPhase,
    cycleDay,
  };
}

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export default function WearableCycleSync({ athleteId, onSync }: Props) {
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncedData, setSyncedData] = useState<CycleWearableData | null>(null);

  const handleSync = async () => {
    setSyncState('syncing');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(
        `${WEARABLE_API}/wearable/cycle?athlete_id=${encodeURIComponent(athleteId)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();
      const parsed = parseCycleResponse(raw as Record<string, unknown>);

      if (!parsed) throw new Error('Unexpected response format');

      setSyncedData(parsed);
      setSyncState('success');
      onSync(parsed);
    } catch {
      setSyncState('error');
    }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: `${SAMSUNG_GREEN}40`, background: `${SAMSUNG_GREEN}08` }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: branding */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${SAMSUNG_GREEN}20` }}
          >
            <Watch className="h-5 w-5" style={{ color: SAMSUNG_GREEN }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold" style={{ color: SAMSUNG_GREEN }}>
                Samsung Health
              </p>
              {syncState === 'success' && (
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: SAMSUNG_GREEN }}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncState === 'success' && syncedData
                ? `Synced · Day ${syncedData.cycleDay ?? '—'} · ${syncedData.currentPhase ?? 'cycle tracked'}`
                : syncState === 'syncing'
                ? 'Syncing from Galaxy Watch...'
                : syncState === 'error'
                ? 'Could not reach device'
                : 'Galaxy Watch · cycle tracking'}
            </p>
          </div>
        </div>

        {/* Right: action */}
        {syncState === 'success' ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: SAMSUNG_GREEN }} />
        ) : syncState === 'error' ? (
          <button
            onClick={handleSync}
            className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:opacity-80 transition-opacity shrink-0"
          >
            <AlertCircle className="h-4 w-4" />
            Retry
          </button>
        ) : (
          <button
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 shrink-0"
            style={{
              background: `${SAMSUNG_GREEN}20`,
              color: SAMSUNG_GREEN,
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            {syncState === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
        )}
      </div>

      {/* Success detail row */}
      {syncState === 'success' && syncedData && (
        <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-muted-foreground"
          style={{ borderColor: `${SAMSUNG_GREEN}30` }}>
          <span>
            <span className="font-medium text-foreground">Last period</span>{' '}
            {syncedData.lastPeriodStart}
          </span>
          <span>
            <span className="font-medium text-foreground">Cycle</span>{' '}
            {syncedData.cycleLength}d
          </span>
          <span>
            <span className="font-medium text-foreground">Period</span>{' '}
            {syncedData.menstruationLength}d
          </span>
        </div>
      )}
    </div>
  );
}
