import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
