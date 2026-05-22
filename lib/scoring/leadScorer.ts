import type { RawSignal } from "../types";
import { isEastCoast } from "../keywords";

/**
 * Pre-research scoring — runs INSTANTLY on every raw signal so we can
 * decide whether to spend Claude tokens researching it.
 *
 * Returns 0-100. Anything above 25 enters the research queue.
 * Anything above 70 (after research) triggers a notification.
 */
export function preScore(signal: RawSignal, state: string | null): number {
  let score = 0;
  const text = (signal.source_post_content ?? "").toLowerCase();

  // Keyword weight (capped at 40)
  const keywordCount = signal.matched_keywords?.length ?? 0;
  score += Math.min(40, keywordCount * 8);

  // Category bonus
  const catBonus: Record<string, number> = {
    complaint: 20, // fired their agency — very high intent
    intent: 15,
    hiring: 15,
    pain: 12,
    shopping: 10,
    launching: 7,
  };
  score += catBonus[signal.intent_category ?? "intent"] ?? 5;

  // East-coast bonus
  if (isEastCoast(state)) score += 15;
  else if (state) score += 5;

  // Length / detail of post (longer posts = more genuine intent, capped)
  const len = (signal.source_post_content ?? "").length;
  if (len > 400) score += 8;
  else if (len > 150) score += 4;

  // Spam / low-signal penalties
  const spamSignals = ["dm me", "telegram", "whatsapp +", "crypto", "make $$$"];
  if (spamSignals.some((s) => text.includes(s))) score -= 20;

  // Source quality bias
  const sourceBoost: Record<string, number> = {
    reddit: 8,
    hackernews: 8,
    twitter: 6,
    indeed: 12,
    producthunt: 5,
    businessregistry: 7,
    google: 6,
    indiehackers: 7,
  };
  score += sourceBoost[signal.source] ?? 0;

  return Math.max(0, Math.min(100, score));
}
