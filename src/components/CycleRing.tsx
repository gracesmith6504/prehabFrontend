import { useMemo } from 'react';
import type { MenstrualPhase } from '@/lib/riskEngine';

interface CycleRingProps {
  currentPhase: MenstrualPhase;
  cycleDay: number;
  cycleLength: number;
  menstruationLength: number;
}

const PHASE_CONFIG: Record<string, { label: string; color: string; activeColor: string }> = {
  menstruation: { label: 'Period', color: 'hsl(0 60% 85%)', activeColor: 'hsl(0 65% 55%)' },
  follicular: { label: 'Follicular', color: 'hsl(150 40% 85%)', activeColor: 'hsl(150 55% 45%)' },
  ovulatory: { label: 'Ovulatory', color: 'hsl(45 70% 85%)', activeColor: 'hsl(45 80% 50%)' },
  luteal: { label: 'Luteal', color: 'hsl(270 40% 85%)', activeColor: 'hsl(270 50% 55%)' },
};

export default function CycleRing({ currentPhase, cycleDay, cycleLength, menstruationLength }: CycleRingProps) {
  const segments = useMemo(() => {
    const follicularEnd = Math.round(cycleLength * 0.4);
    const ovulatoryEnd = Math.round(cycleLength * 0.5);

    return [
      { phase: 'menstruation', startDay: 0, days: menstruationLength },
      { phase: 'follicular', startDay: menstruationLength, days: follicularEnd - menstruationLength },
      { phase: 'ovulatory', startDay: follicularEnd, days: ovulatoryEnd - follicularEnd },
      { phase: 'luteal', startDay: ovulatoryEnd, days: cycleLength - ovulatoryEnd },
    ];
  }, [cycleLength, menstruationLength]);

  const size = 220;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    let accumulated = 0;
    return segments.map(seg => {
      const fraction = seg.days / cycleLength;
      const gap = 0.008; // small gap between segments
      const arcLen = Math.max(fraction - gap, 0.01) * circumference;
      const offset = accumulated * circumference;
      accumulated += fraction;
      const config = PHASE_CONFIG[seg.phase];
      const isActive = currentPhase === seg.phase;
      return { ...seg, arcLen, offset, config, isActive, fraction };
    });
  }, [segments, cycleLength, circumference, currentPhase]);

  // Day marker position
  const dayFraction = cycleDay / cycleLength;
  const dayAngle = dayFraction * 2 * Math.PI - Math.PI / 2;
  const markerR = radius;
  const markerX = cx + markerR * Math.cos(dayAngle);
  const markerY = cy + markerR * Math.sin(dayAngle);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {arcs.map((arc) => (
            <circle
              key={arc.phase}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={arc.isActive ? arc.config.activeColor : arc.config.color}
              strokeWidth={arc.isActive ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={`${arc.arcLen} ${circumference - arc.arcLen}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ opacity: arc.isActive ? 1 : 0.6 }}
            />
          ))}
          {/* Day marker dot */}
          <circle
            cx={markerX}
            cy={markerY}
            r={6}
            fill="hsl(var(--foreground))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-heading font-extrabold text-foreground">{cycleDay}</span>
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Day</span>
        </div>
      </div>

      {/* Phase labels */}
      <div className="flex flex-wrap justify-center gap-3">
        {arcs.map(arc => (
          <div
            key={arc.phase}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              arc.isActive
                ? 'bg-foreground/10 text-foreground font-bold'
                : 'text-muted-foreground'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: arc.isActive ? arc.config.activeColor : arc.config.color }}
            />
            {arc.config.label}
          </div>
        ))}
      </div>
    </div>
  );
}
