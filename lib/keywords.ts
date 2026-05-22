import { db } from "./db";
import type { Keyword } from "./types";

// East-coast state codes — leads from these states get a +15 score boost
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

// Hard-coded fallback in case the DB keywords table hasn't loaded yet.
export const FALLBACK_KEYWORDS: Pick<Keyword, "phrase" | "category" | "weight">[] = [
  { phrase: "looking for a marketing agency", category: "intent", weight: 10 },
  { phrase: "need help with marketing", category: "intent", weight: 9 },
  { phrase: "hire a marketing agency", category: "intent", weight: 10 },
  { phrase: "marketing agency recommendations", category: "intent", weight: 9 },
  { phrase: "need a marketing consultant", category: "intent", weight: 9 },
  { phrase: "looking for marketing services", category: "intent", weight: 9 },
  { phrase: "marketing freelancer", category: "intent", weight: 7 },
  { phrase: "white label software", category: "service", weight: 10 },
  { phrase: "white label saas", category: "service", weight: 10 },
  { phrase: "white label crm", category: "service", weight: 9 },
  { phrase: "need more leads", category: "pain", weight: 9 },
  { phrase: "not getting leads", category: "pain", weight: 9 },
  { phrase: "low conversion rate", category: "pain", weight: 8 },
  { phrase: "fired our agency", category: "complaint", weight: 9 },
  { phrase: "looking to replace our agency", category: "complaint", weight: 10 },
  { phrase: "agency ripped me off", category: "complaint", weight: 9 },
  { phrase: "ai marketing tool", category: "service", weight: 8 },
  { phrase: "ai for my business", category: "service", weight: 8 },
  { phrase: "just launched", category: "launch", weight: 5 },
  { phrase: "grand opening", category: "launch", weight: 6 },
  { phrase: "hiring a marketing manager", category: "hiring", weight: 8 },
  { phrase: "hiring a marketing director", category: "hiring", weight: 8 },
  { phrase: "chatbot for my business", category: "service", weight: 7 },
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

/**
 * Scan text for keyword matches. Returns matches with a small snippet
 * of surrounding context so we can show *why* this lead surfaced.
 */
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

export function detectState(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES_TO_CODE)) {
    if (lower.includes(name)) return code;
  }
  // Look for ", XX" state codes
  const m = text.match(/,\s*([A-Z]{2})\b/);
  if (m && Object.values(STATE_NAMES_TO_CODE).includes(m[1])) return m[1];
  return null;
}

export function isEastCoast(state: string | null): boolean {
  return !!state && EAST_COAST_STATES.has(state);
}
