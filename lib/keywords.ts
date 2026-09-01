import { db } from "./db";
import type { Keyword } from "./types";

// East-coast state codes — leads from these states get a score boost
export const EAST_COAST_STATES = new Set([
  "ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA",
  "DE", "MD", "DC", "VA", "WV", "NC", "SC", "GA", "FL",
]);

export const STATE_NAMES_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "washington dc": "DC", "washington d.c.": "DC",
};

/**
 * Keywords are now HYPER-FOCUSED on junk removal + real estate.
 * Generic marketing keywords are gone — they produced too much noise.
 */
export const FALLBACK_KEYWORDS: Pick<Keyword, "phrase" | "category" | "weight">[] = [
  // ── JUNK REMOVAL: identity ──────────────────────────────────────────
  { phrase: "junk removal", category: "vertical_junk", weight: 10 },
  { phrase: "junk hauling", category: "vertical_junk", weight: 10 },
  { phrase: "hauling business", category: "vertical_junk", weight: 9 },
  { phrase: "estate cleanout", category: "vertical_junk", weight: 9 },
  { phrase: "property cleanout", category: "vertical_junk", weight: 9 },
  { phrase: "debris removal", category: "vertical_junk", weight: 8 },
  { phrase: "dumpster rental", category: "vertical_junk", weight: 8 },
  { phrase: "furniture removal", category: "vertical_junk", weight: 8 },

  // ── JUNK REMOVAL: pain ──────────────────────────────────────────────
  { phrase: "angi leads", category: "pain_junk", weight: 10 },
  { phrase: "angies list leads", category: "pain_junk", weight: 10 },
  { phrase: "thumbtack leads", category: "pain_junk", weight: 10 },
  { phrase: "cost per lead too high", category: "pain_junk", weight: 9 },
  { phrase: "1-800-got-junk", category: "pain_junk", weight: 9 },
  { phrase: "competing with got junk", category: "pain_junk", weight: 10 },
  { phrase: "missed calls losing jobs", category: "pain_junk", weight: 9 },
  { phrase: "slow season junk removal", category: "pain_junk", weight: 8 },

  // ── REAL ESTATE: identity ───────────────────────────────────────────
  { phrase: "real estate agent", category: "vertical_re", weight: 9 },
  { phrase: "realtor", category: "vertical_re", weight: 9 },
  { phrase: "real estate team", category: "vertical_re", weight: 10 },
  { phrase: "real estate brokerage", category: "vertical_re", weight: 10 },
  { phrase: "property management", category: "vertical_re", weight: 9 },
  { phrase: "real estate investor", category: "vertical_re", weight: 8 },
  { phrase: "listing agent", category: "vertical_re", weight: 8 },

  // ── REAL ESTATE: pain ───────────────────────────────────────────────
  { phrase: "zillow leads", category: "pain_re", weight: 10 },
  { phrase: "zillow premier agent", category: "pain_re", weight: 10 },
  { phrase: "realtor.com leads", category: "pain_re", weight: 10 },
  { phrase: "lead response time", category: "pain_re", weight: 9 },
  { phrase: "leads falling through", category: "pain_re", weight: 9 },
  { phrase: "need a better crm", category: "pain_re", weight: 10 },
  { phrase: "idx website", category: "pain_re", weight: 8 },
  { phrase: "seller leads", category: "pain_re", weight: 9 },
  { phrase: "motivated seller leads", category: "pain_re", weight: 9 },
  { phrase: "follow up sequence", category: "pain_re", weight: 8 },
  { phrase: "sphere of influence", category: "pain_re", weight: 7 },

  // ── SHARED: buying intent (only counted when a vertical also matches) ─
  { phrase: "looking for a marketing agency", category: "intent", weight: 9 },
  { phrase: "need help with marketing", category: "intent", weight: 8 },
  { phrase: "need more leads", category: "intent", weight: 9 },
  { phrase: "not getting leads", category: "intent", weight: 9 },
  { phrase: "fired our agency", category: "complaint", weight: 10 },
  { phrase: "fired our marketing agency", category: "complaint", weight: 10 },
  { phrase: "looking to replace our agency", category: "complaint", weight: 10 },
  { phrase: "white label crm", category: "service", weight: 10 },
  { phrase: "white label software", category: "service", weight: 9 },
  { phrase: "ai phone answering", category: "service", weight: 9 },
  { phrase: "ai receptionist", category: "service", weight: 9 },
  { phrase: "google local services ads", category: "service", weight: 9 },
  { phrase: "local seo", category: "service", weight: 8 },
  { phrase: "google business profile", category: "service", weight: 7 },
  { phrase: "need more reviews", category: "service", weight: 7 },
  { phrase: "just started my business", category: "launch", weight: 7 },
  { phrase: "just launched", category: "launch", weight: 5 },
];

let cached: { at: number; data: Pick<Keyword, "phrase" | "category" | "weight">[] } | null = null;

export async function loadKeywords(): Promise<Pick<Keyword, "phrase" | "category" | "weight">[]> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.data;
  try {
    const sql = db();
    const data = (await sql`
      SELECT phrase, category, weight FROM keywords WHERE enabled = true
    `) as Array<Pick<Keyword, "phrase" | "category" | "weight">>;
    const list = data.length > 0 ? data : FALLBACK_KEYWORDS;
    cached = { at: Date.now(), data: list };
    return list;
  } catch {
    return FALLBACK_KEYWORDS;
  }
}

export interface KeywordMatch {
  phrase: string;
  category: string;
  weight: number;
  snippet: string;
}

export function matchKeywords(
  text: string,
  keywords: Pick<Keyword, "phrase" | "category" | "weight">[]
): KeywordMatch[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const out: KeywordMatch[] = [];
  for (const k of keywords) {
    const i = lower.indexOf(k.phrase.toLowerCase());
    if (i >= 0) {
      const start = Math.max(0, i - 60);
      const end = Math.min(text.length, i + k.phrase.length + 60);
      out.push({
        phrase: k.phrase,
        category: k.category,
        weight: k.weight,
        snippet: text.slice(start, end).trim(),
      });
    }
  }
  return out;
}

/**
 * True only if at least one match identifies the lead as junk-removal or
 * real-estate. Generic "need marketing help" alone is no longer enough —
 * we require vertical relevance.
 */
export function hasVerticalMatch(matches: KeywordMatch[]): boolean {
  return matches.some((m) => m.category.startsWith("vertical_") || m.category.startsWith("pain_"));
}

export function detectState(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES_TO_CODE)) {
    if (lower.includes(name)) return code;
  }
  const m = text.match(/,\s*([A-Z]{2})\b/);
  if (m && Object.values(STATE_NAMES_TO_CODE).includes(m[1])) return m[1];
  return null;
}

export function isEastCoast(state: string | null): boolean {
  return !!state && EAST_COAST_STATES.has(state);
}
