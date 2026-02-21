// Risk Calculation Engine

export type MenstrualPhase = 'menstruation' | 'follicular' | 'ovulatory' | 'luteal' | 'unknown';

export const PHASE_MULTIPLIERS: Record<MenstrualPhase, number> = {
  menstruation: 1.0,
  follicular: 1.1,
  ovulatory: 1.4,
  luteal: 1.2,
  unknown: 1.0,
};

export function getCurrentPhase(
  cycleStartDate: string | null,
  cycleLength: number,
  menstruationLength: number
): MenstrualPhase {
  if (!cycleStartDate) return 'unknown';
  
  const start = new Date(cycleStartDate);
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  
  if (dayInCycle < menstruationLength) return 'menstruation';
  if (dayInCycle < cycleLength * 0.4) return 'follicular';
  if (dayInCycle < cycleLength * 0.5) return 'ovulatory';
  return 'luteal';
}

export function calculateLoadScore(duration: number, rpe: number, intensity: string): number {
  const intensityMultiplier = intensity === 'High' ? 1.5 : intensity === 'Medium' ? 1.0 : 0.6;
  return duration * rpe * intensityMultiplier / 10;
}

export function calculateAcuteChronicRatio(sessions: Array<{ date: string; duration: number; rpe: number; intensity: string }>): number {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
  
  let acuteLoad = 0;
  let chronicLoad = 0;
  let chronicCount = 0;
  
  sessions.forEach(s => {
    const d = new Date(s.date);
    const load = calculateLoadScore(s.duration, s.rpe, s.intensity);
    if (d >= sevenDaysAgo) acuteLoad += load;
    if (d >= twentyEightDaysAgo) { chronicLoad += load; chronicCount++; }
  });
  
  const weeklyChronicAvg = chronicCount > 0 ? (chronicLoad / 4) : 0;
  if (weeklyChronicAvg === 0) return acuteLoad > 0 ? 2.0 : 0;
  return acuteLoad / weeklyChronicAvg;
}

export function getLoadRiskMultiplier(ratio: number): number {
  if (ratio > 1.5) return 1.5;
  if (ratio > 1.2) return 1.2;
  return 1.0;
}

export function calculateSorenessContribution(logs: Array<{ knee: number; hamstring: number; groin: number; calf: number; other_value?: number }>): number {
  if (logs.length === 0) return 0;
  
  const latest = logs[0];
  const maxSoreness = Math.max(latest.knee, latest.hamstring, latest.groin, latest.calf, latest.other_value || 0);
  
  // Rising trend over 3 days
  let risingTrend = false;
  if (logs.length >= 3) {
    const avg = (l: typeof latest) => (l.knee + l.hamstring + l.groin + l.calf) / 4;
    if (avg(logs[0]) > avg(logs[1]) && avg(logs[1]) > avg(logs[2])) {
      risingTrend = true;
    }
  }
  
  let contribution = maxSoreness * 10; // 0-100
  if (risingTrend) contribution += 15;
  return Math.min(contribution, 100);
}

export function calculateRiskScore(
  phase: MenstrualPhase,
  acuteChronicRatio: number,
  sorenessContribution: number
): { score: number; level: string } {
  const phaseMultiplier = PHASE_MULTIPLIERS[phase];
  const loadMultiplier = getLoadRiskMultiplier(acuteChronicRatio);
  
  const loadComponent = Math.min(acuteChronicRatio / 2.0 * 100, 100) * 0.4;
  const phaseComponent = (phaseMultiplier - 1.0) / 0.4 * 100 * 0.3;
  const sorenessComponent = sorenessContribution * 0.3;
  
  const rawScore = loadComponent + phaseComponent + sorenessComponent;
  const score = Math.min(Math.round(rawScore * loadMultiplier * phaseMultiplier / 1.5), 100);
  
  const level = score > 80 ? 'High' : score > 60 ? 'Medium' : 'Low';
  return { score, level };
}

export interface PlanSession {
  day: string;
  type: string;
  intensity: string;
  duration: number;
  notes?: string;
}

export function generateDefaultPlan(): PlanSession[] {
  return [
    { day: 'Monday', type: 'Strength', intensity: 'Medium', duration: 60 },
    { day: 'Tuesday', type: 'Sprint', intensity: 'High', duration: 45 },
    { day: 'Wednesday', type: 'Recovery', intensity: 'Low', duration: 30 },
    { day: 'Thursday', type: 'Plyometrics', intensity: 'High', duration: 50 },
    { day: 'Friday', type: 'Match', intensity: 'High', duration: 90 },
    { day: 'Saturday', type: 'Recovery', intensity: 'Low', duration: 30 },
    { day: 'Sunday', type: 'Rest', intensity: 'Low', duration: 0 },
  ];
}

export function adjustPlan(original: PlanSession[], riskScore: number): { adjusted: PlanSession[]; changes: string[] } {
  const adjusted = original.map(s => ({ ...s }));
  const changes: string[] = [];
  
  if (riskScore > 80) {
    adjusted.forEach(s => {
      if (s.type === 'Plyometrics' || s.type === 'Sprint') {
        changes.push(`Replaced ${s.type} (${s.day}) with Recovery session`);
        s.type = 'Recovery';
        s.intensity = 'Low';
        s.duration = 30;
        s.notes = 'Risk too high — session replaced';
      }
      if (s.type === 'Match') {
        changes.push(`Reduced Match intensity (${s.day}) to Medium`);
        s.intensity = 'Medium';
        s.notes = 'Risk too high — reduced intensity';
      }
    });
    if (changes.length === 0) changes.push('All high-intensity sessions already removed');
  } else if (riskScore > 60) {
    adjusted.forEach(s => {
      if (s.type === 'Plyometrics') {
        const newDur = Math.round(s.duration * 0.7);
        changes.push(`Reduced Plyometrics volume (${s.day}) from ${s.duration}min to ${newDur}min`);
        s.duration = newDur;
        s.notes = 'Reduced volume due to elevated risk';
      }
      if (s.type === 'Sprint' && s.intensity === 'High') {
        changes.push(`Lowered Sprint intensity (${s.day}) from High to Medium`);
        s.intensity = 'Medium';
        s.notes = 'Intensity lowered due to elevated risk';
      }
    });
    // Add stability session
    const restDay = adjusted.find(s => s.type === 'Rest' || (s.type === 'Recovery' && s.duration === 0));
    if (restDay) {
      changes.push(`Added Stability session on ${restDay.day}`);
      restDay.type = 'Strength';
      restDay.intensity = 'Low';
      restDay.duration = 40;
      restDay.notes = 'Added stability-focused strength work';
    }
  }
  
  return { adjusted, changes };
}

export function generateExplanation(
  phase: MenstrualPhase,
  riskScore: number,
  acuteChronicRatio: number,
  sorenessContribution: number,
  changes: string[]
): string {
  const parts: string[] = [];
  
  if (phase === 'ovulatory') {
    parts.push('You are in the ovulatory phase, which carries the highest ACL injury risk.');
  } else if (phase === 'luteal') {
    parts.push('You are in the luteal phase, with moderately elevated injury risk.');
  }
  
  if (acuteChronicRatio > 1.5) {
    parts.push(`Your acute:chronic load ratio (${acuteChronicRatio.toFixed(2)}) indicates a training spike.`);
  }
  
  if (sorenessContribution > 50) {
    parts.push('Your soreness levels are significantly elevated.');
  }
  
  if (changes.length > 0) {
    parts.push(`Plan adjustments: ${changes.join('; ')}.`);
  }
  
  if (riskScore > 80) {
    parts.push('⚠️ Risk is very high. Consider consulting your physio or coach.');
  }
  
  return parts.join(' ') || 'Your risk levels are within normal range. Keep training smart!';
}
