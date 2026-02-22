import { motion } from 'framer-motion';

export default function RiskGauge({ score }: { score: number }) {
  const isCritical = score >= 75;
  const isHigh = score >= 55;
  const isMedium = score >= 35;
  const color = isCritical ? 'hsl(0, 72%, 51%)' : isHigh ? 'hsl(25, 90%, 50%)' : isMedium ? 'hsl(45, 93%, 47%)' : 'hsl(145, 65%, 42%)';
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const glowFilter = isCritical ? `drop-shadow(0 0 4px hsl(0 72% 51% / 0.35))` : 'none';

  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" className="stroke-border" strokeWidth="8" fill="none" />
        <motion.circle
          cx="60" cy="60" r="54"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: glowFilter }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-heading font-bold"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Risk</span>
      </div>
    </div>
  );
}
