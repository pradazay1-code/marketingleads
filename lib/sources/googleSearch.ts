import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";
import { ALL_SEARCH_QUERIES, classifyVertical } from "../verticals";

interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface GoogleResponse {
  items?: GoogleResult[];
}

const EXCLUDED_HOSTS = [
  "angi.com",
  "homeadvisor.com",
  "thumbtack.com",
  "yelp.com",
  "zillow.com",
  "realtor.com",
  "trulia.com",
  "redfin.com",
  "1800gotjunk.com",
  "indeed.com",
  "wikipedia.org",
  "youtube.com",
];

function isProspectable(link: string): boolean {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return !EXCLUDED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * Google Programmable Search — vertical-focused intent queries.
 * Needs GOOGLE_API_KEY + GOOGLE_CSE_ID (100 free searches/day).
 *
 * v4: all queries are junk removal or real estate specific.
 */
export async function fetchGoogleSignals(customQueries?: string[]): Promise<RawSignal[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) {
    console.warn("[google] GOOGLE_API_KEY / GOOGLE_CSE_ID not set — skipping");
    return [];
  }

  // Rotate through the query set so we don't burn the 100/day quota at once
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const pool = customQueries ?? ALL_SEARCH_QUERIES;
  const queries: string[] = [];
  for (let i = 0; i < 6; i++) {
    queries.push(pool[(epochHour + i * 2) % pool.length]);
  }

  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(
        q
      )}&num=10&dateRestrict=m2`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.error(`[google] ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as GoogleResponse;
      for (const item of data.items ?? []) {
        if (!isProspectable(item.link)) continue;
        const id = `google:${Buffer.from(item.link).toString("base64").slice(0, 32)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const text = `${item.title}\n${item.snippet}`;
        const vertical = classifyVertical(text);
        if (vertical === "other") continue;

        const matches = matchKeywords(text, keywords);
        const topMatch =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : { phrase: q, category: "intent" as const, weight: 6, snippet: item.snippet };
        const state = detectState(text);

        signals.push({
          external_id: id,
          source: "google",
          source_url: item.link,
          source_post_content: text.slice(0, 3000),
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: topMatch.snippet,
          intent_category: topMatch.category.startsWith("pain")
            ? "pain"
            : (topMatch.category as RawSignal["intent_category"]),
          raw: {
            vertical,
            title: item.title,
            display_link: item.displayLink,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`[google] error for "${q}":`, err);
    }
  }

  return signals;
}
