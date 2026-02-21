import type { MenstrualPhase } from '@/lib/riskEngine';

const INSIGHTS: Record<MenstrualPhase, string> = {
  menstruation:
    "Your body is recovering. Focus on low-impact movement, mobility work, and rest. It's a great time for technique drills at lighter loads.",
  follicular:
    "Energy and strength are building. This is your window for progressive overload — push intensity and explore new training peaks.",
  ovulatory:
    "You're at peak power and coordination, but ligament laxity is higher. Prioritise warm-ups and controlled landings during explosive work.",
  luteal:
    "Endurance holds steady but reaction time may dip. Favour steady-state cardio and strength maintenance. Stay hydrated and fuel well.",
  unknown:
    "Set your cycle start date to unlock personalised phase insights and smarter training recommendations.",
};

export default function PhaseInsight({ phase }: { phase: MenstrualPhase }) {
  return (
    <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
      {INSIGHTS[phase]}
    </p>
  );
}
