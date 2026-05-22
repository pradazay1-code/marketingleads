import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface GoogleResponse {
  items?: GoogleResult[];
}

// Curated high-intent queries — biased toward East Coast US
const INTENT_QUERIES = [
  '"looking for a marketing agency" site:reddit.com',
  '"need help with marketing" site:reddit.com',
  '"fired our marketing agency" site:reddit.com OR site:quora.com',
  '"need a marketing consultant" "new york" OR "florida" OR "georgia"',
  '"white label software" "looking for"',
  '"hire a marketing agency" 2026',
  '"just launched my business" "need help"',
  '"marketing agency recommendations" "east coast"',
  '"need more leads" small business owner',
  '"low conversion rate" startup founder',
  '"hiring a marketing manager" remote OR "new york" OR "boston"',
  '"AI marketing tool" "looking for"',
];

/**
 * Google Programmable Search Engine — needs GOOGLE_API_KEY + GOOGLE_CSE_ID.
 * Returns up to 10 results per query. With ~12 queries we get ~120 candidates per run.
 */
export async function fetchGoogleSignals(
  customQueries?: string[]
): Promise<RawSignal[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.warn("[google] GOOGLE_API_KEY / GOOGLE_CSE_ID not set — skipping");
    return [];
  }

  const queries = customQueries ?? INTENT_QUERIES;
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(
        q
      )}&num=10&dateRestrict=m1`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[google] ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as GoogleResponse;
      for (const item of data.items ?? []) {
        const id = `google:${Buffer.from(item.link).toString("base64").slice(0, 32)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const text = `${item.title}\n${item.snippet}`;
        const matches = matchKeywords(text, keywords);
        const topMatch =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : {
                phrase: q,
                category: "intent" as const,
                weight: 6,
                snippet: item.snippet,
              };
        const state = detectState(text);

        signals.push({
          external_id: id,
          source: "google",
          source_url: item.link,
          source_post_content: text.slice(0, 2000),
          location: state ?? undefined,
          matched_keywords:
            matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: topMatch.snippet,
          intent_category: topMatch.category as RawSignal["intent_category"],
          raw: {
            title: item.title,
            display_link: item.displayLink,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 350));
    } catch (err) {
      console.error(`[google] error for "${q}":`, err);
    }
  }

  return signals;
}
