import type { MenstrualPhase } from '@/lib/riskEngine';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Heart, Shield, Moon, Battery, Dumbbell, Brain,
  Flame, Droplets, TrendingUp, TrendingDown, AlertTriangle, ChevronDown
} from 'lucide-react';

interface PhaseData {
  label: string;
  days: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  tagline: string;
  insight: string;
  whatHappens: string;
  performance: { label: string; level: 'high' | 'medium' | 'low'; icon: React.ReactNode }[];
  trainingTips: string[];
  nutritionTip: string;
  recoveryTip: string;
  injuryNote: string;
}

const PHASE_DATA: Record<Exclude<MenstrualPhase, 'unknown'>, PhaseData> = {
  menstruation: {
    label: 'Menstruation',
    days: 'Days 1–5',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20',
    icon: <Droplets className="h-5 w-5" />,
    tagline: 'Rest & Reset',
    insight: "Your body is shedding the uterine lining. Hormone levels (estrogen & progesterone) are at their lowest. Many athletes feel fatigued, but some actually feel relief.",
    whatHappens: "Iron levels can drop, energy may dip, and inflammation markers are slightly elevated. Your body is prioritising recovery and renewal.",
    performance: [
      { label: 'Strength', level: 'low', icon: <Dumbbell className="h-3.5 w-3.5" /> },
      { label: 'Endurance', level: 'medium', icon: <Flame className="h-3.5 w-3.5" /> },
      { label: 'Power', level: 'low', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Recovery need', level: 'high', icon: <Heart className="h-3.5 w-3.5" /> },
    ],
    trainingTips: [
      'Focus on low-impact movement and mobility',
      'Light technique drills at reduced loads',
      'Yoga and gentle stretching are ideal',
      'Listen to your body — rest if you need to',
    ],
    nutritionTip: 'Increase iron-rich foods (leafy greens, red meat, lentils) and vitamin C to support absorption. Stay well hydrated.',
    recoveryTip: 'Prioritise sleep quality. Heat packs can help with cramps. Gentle walking promotes blood flow without overloading.',
    injuryNote: 'Lower injury risk during this phase, but reduced coordination and reaction time mean warm-ups are essential.',
  },
  follicular: {
    label: 'Follicular',
    days: 'Days 6–13',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/20',
    icon: <TrendingUp className="h-5 w-5" />,
    tagline: 'Build & Push',
    insight: "Estrogen is rising rapidly, boosting muscle repair, energy, and mood. Your body is primed for growth and adaptation. This is your window to push.",
    whatHappens: "Rising estrogen increases collagen synthesis, supports muscle recovery, and improves insulin sensitivity. You may feel stronger and more motivated.",
    performance: [
      { label: 'Strength', level: 'high', icon: <Dumbbell className="h-3.5 w-3.5" /> },
      { label: 'Endurance', level: 'high', icon: <Flame className="h-3.5 w-3.5" /> },
      { label: 'Power', level: 'high', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Recovery need', level: 'low', icon: <Heart className="h-3.5 w-3.5" /> },
    ],
    trainingTips: [
      'Progressive overload — increase weights and intensity',
      'High-intensity interval training (HIIT)',
      'Introduce new skills or complex movements',
      'This is your best phase for strength PRs',
    ],
    nutritionTip: 'Carbohydrate tolerance is high — fuel your sessions with adequate carbs. Protein intake supports the muscle-building window.',
    recoveryTip: 'Recovery capacity is strong. You can handle higher training volumes with less rest between sessions.',
    injuryNote: 'Moderate risk. Rising estrogen supports tissue repair, but be mindful as you increase intensity — proper warm-ups prevent overuse injuries.',
  },
  ovulatory: {
    label: 'Ovulatory',
    days: 'Days 14–16',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/20',
    icon: <Zap className="h-5 w-5" />,
    tagline: 'Peak Power, Stay Alert',
    insight: "Estrogen peaks and a surge of luteinising hormone (LH) triggers ovulation. You're at peak strength and coordination — but ligament laxity is at its highest.",
    whatHappens: "Peak estrogen increases joint laxity (especially in the knee). ACL injury risk is 2-6× higher in this phase. Neuromuscular control and reaction time are excellent.",
    performance: [
      { label: 'Strength', level: 'high', icon: <Dumbbell className="h-3.5 w-3.5" /> },
      { label: 'Endurance', level: 'high', icon: <Flame className="h-3.5 w-3.5" /> },
      { label: 'Power', level: 'high', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Recovery need', level: 'low', icon: <Heart className="h-3.5 w-3.5" /> },
    ],
    trainingTips: [
      'Capitalise on peak power for explosive movements',
      'Extra focus on landing mechanics and knee control',
      'Extended warm-ups with neuromuscular activation',
      'Controlled plyometrics with emphasis on form',
    ],
    nutritionTip: 'Maintain balanced nutrition. Anti-inflammatory foods (omega-3, turmeric) can support joint health during this high-laxity phase.',
    recoveryTip: 'Recovery capacity remains strong, but pay extra attention to joint-protective strategies like foam rolling and activation exercises.',
    injuryNote: '⚠️ Highest ACL injury risk window. Estrogen-driven ligament laxity means landing mechanics and knee alignment are critical. Never skip warm-ups.',
  },
  luteal: {
    label: 'Luteal',
    days: 'Days 17–28',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-border',
    icon: <Moon className="h-5 w-5" />,
    tagline: 'Maintain & Adapt',
    insight: "Progesterone rises while estrogen drops. Your body temperature increases, metabolism speeds up, but you may feel slower, more fatigued, and experience PMS symptoms.",
    whatHappens: "Higher core body temperature makes endurance harder. Progesterone is catabolic (breaks down muscle) and can reduce reaction time. Mood and motivation may fluctuate.",
    performance: [
      { label: 'Strength', level: 'medium', icon: <Dumbbell className="h-3.5 w-3.5" /> },
      { label: 'Endurance', level: 'low', icon: <Flame className="h-3.5 w-3.5" /> },
      { label: 'Power', level: 'medium', icon: <Zap className="h-3.5 w-3.5" /> },
      { label: 'Recovery need', level: 'high', icon: <Heart className="h-3.5 w-3.5" /> },
    ],
    trainingTips: [
      'Favour steady-state cardio over sprints',
      'Strength maintenance — avoid maximal lifts',
      'Reduce plyometric volume and intensity',
      'Mindfulness and controlled breathing exercises',
    ],
    nutritionTip: 'Your metabolism is 5-10% higher — you need more calories. Increase complex carbs and magnesium-rich foods. Cravings are normal and physiological.',
    recoveryTip: 'Sleep quality may suffer. Prioritise a cool bedroom, consistent sleep schedule, and avoid caffeine after noon.',
    injuryNote: 'Moderate injury risk. Reduced reaction time and coordination mean you should focus on controlled, technical training rather than maximal-effort work.',
  },
};

const LEVEL_STYLES = {
  high: 'bg-destructive/20 text-destructive',
  medium: 'bg-warning/20 text-warning',
  low: 'bg-primary/20 text-primary',
};

function PerformanceMeter({ label, level, icon }: { label: string; level: 'high' | 'medium' | 'low'; icon: React.ReactNode }) {
  const bars = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs font-medium w-20">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`h-2 w-5 rounded-sm ${i <= bars
              ? level === 'high' ? 'bg-destructive' : level === 'medium' ? 'bg-warning' : 'bg-primary'
              : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  phase: MenstrualPhase;
  showAllPhases?: boolean;
}

export default function PhaseEducation({ phase, showAllPhases = false }: Props) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(phase === 'unknown' ? null : phase);
  const [showAll, setShowAll] = useState(showAllPhases);

  if (phase === 'unknown') {
    return (
      <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
        Set your cycle start date to unlock personalised phase insights and training recommendations.
      </p>
    );
  }

  const phasesToShow = showAll
    ? (Object.keys(PHASE_DATA) as Exclude<MenstrualPhase, 'unknown'>[])
    : [phase];

  return (
    <div className="w-full space-y-3">
      {phasesToShow.map(p => {
        const data = PHASE_DATA[p];
        const isExpanded = expandedPhase === p;
        const isCurrent = p === phase;

        return (
          <motion.div
            key={p}
            layout
            className={`rounded-xl border ${isCurrent ? data.bgColor : 'bg-card/50 border-border'} overflow-hidden`}
          >
            {/* Phase header — always visible */}
            <button
              onClick={() => setExpandedPhase(isExpanded ? null : p)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <span className={isCurrent ? data.color : 'text-muted-foreground'}>{data.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-heading font-bold text-sm ${isCurrent ? '' : 'text-muted-foreground'}`}>
                    {data.label}
                  </span>
                  {isCurrent && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${data.bgColor} ${data.color}`}>
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{data.days} · {data.tagline}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
                    {/* What's happening */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" /> What's happening
                      </h4>
                      <p className="text-sm leading-relaxed">{data.insight}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.whatHappens}</p>
                    </div>

                    {/* Performance meters */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Battery className="h-3.5 w-3.5" /> Performance profile
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {data.performance.map(p => (
                          <PerformanceMeter key={p.label} {...p} />
                        ))}
                      </div>
                    </div>

                    {/* Training tips */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                        <Dumbbell className="h-3.5 w-3.5" /> Training tips
                      </h4>
                      <ul className="space-y-1">
                        {data.trainingTips.map((tip, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Nutrition & Recovery */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">🥗 Nutrition</h5>
                        <p className="text-xs leading-relaxed">{data.nutritionTip}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-3">
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">😴 Recovery</h5>
                        <p className="text-xs leading-relaxed">{data.recoveryTip}</p>
                      </div>
                    </div>

                    {/* Injury note */}
                    <div className={`rounded-lg p-3 flex items-start gap-2 ${
                      p === 'ovulatory' ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'
                    }`}>
                      <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                        p === 'ovulatory' ? 'text-destructive' : 'text-muted-foreground'
                      }`} />
                      <div>
                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Injury awareness</h5>
                        <p className="text-xs leading-relaxed">{data.injuryNote}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Show all phases toggle */}
      {!showAllPhases && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors py-2 font-medium"
        >
          {showAll ? 'Show current phase only' : 'Learn about all phases →'}
        </button>
      )}
    </div>
  );
}
