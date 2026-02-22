import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert raw agent trigger_reason strings to human-readable text
export function formatTriggerReason(raw: string): string {
  if (!raw) return 'Injury risk threshold exceeded';

  // autonomy_level=escalate (score: 75, level: High)
  const autoMatch = raw.match(/autonomy_level=escalate.*score:\s*(\d+)/i);
  if (autoMatch) return `High injury risk detected — risk score ${autoMatch[1]}`;

  // risk_level=High (score: 75)
  const levelMatch = raw.match(/risk_level=(\w+)\s*\(score:\s*(\d+)\)/i);
  if (levelMatch) return `${levelMatch[1]} injury risk detected — score ${levelMatch[2]}`;

  // risk_prob=0.85 > 0.8
  const probMatch = raw.match(/risk_prob=([\d.]+)/i);
  if (probMatch) return `Injury probability ${Math.round(Number(probMatch[1]) * 100)}% — above safety threshold`;

  // "Score jumped +15 since last prediction" — already readable
  if (raw.toLowerCase().includes('score jumped')) return raw;

  return raw;
}

// Rewrite Gemini athlete-facing text for coach context (you/your → they/their)
export function rewriteForCoach(text: string): string {
  return text
    .replace(/\byou're\b/gi, m => m[0] === 'Y' ? "They're" : "they're")
    .replace(/\byou've\b/gi, m => m[0] === 'Y' ? "They've" : "they've")
    .replace(/\byou'll\b/gi, m => m[0] === 'Y' ? "They'll" : "they'll")
    .replace(/\byourself\b/gi, m => m[0] === 'Y' ? "Themselves" : "themselves")
    .replace(/\byour\b/gi, m => m[0] === 'Y' ? "Their" : "their")
    .replace(/\byou\b/gi, m => m[0] === 'Y' ? "They" : "they");
}
