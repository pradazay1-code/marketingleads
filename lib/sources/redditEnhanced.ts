import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";
import { classifyVertical } from "../verticals";

/**
 * Targeted Reddit search across vertical-specific high-intent queries.
 * Runs in ADDITION to the per-subreddit feed scan, catching posts in
 * subreddits we don't monitor directly.
 *
 * v4: every query is junk-removal or real-estate specific.
 */
const SEARCH_QUERIES = [
  // Junk removal
  '"junk removal" "angi" leads expensive',
  '"junk removal business" marketing',
  '"junk removal" "need more customers"',
  '"junk removal" thumbtack worth it',
  '"estate cleanout" business marketing',
  '"hauling business" getting customers',
  '"junk removal" google ads',
  // Real estate
  '"zillow leads" not worth it realtor',
  '"real estate" CRM recommendations agent',
  '"realtor" "lead generation" help',
  '"real estate team" marketing agency',
  '"property management" marketing leads',
  '"real estate" follow up automation',
  '"motivated seller leads" marketing',
];

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    permalink: string;
    subreddit: string;
    author: string;
    created_utc: number;
    over_18: boolean;
    num_comments: number;
  };
}

interface RedditListing {
  data: { children: RedditChild[] };
}

export async function fetchRedditSearchSignals(): Promise<RawSignal[]> {
  const UA = process.env.REDDIT_USER_AGENT || "AventisLeadsBot/1.0";
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of SEARCH_QUERIES) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(
        q
      )}&sort=new&t=month&limit=25`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.warn(`[reddit-search] ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as RedditListing;
      for (const child of data.data.children) {
        const p = child.data;
        if (p.over_18 || seen.has(p.id)) continue;
        seen.add(p.id);
        const text = `${p.title}\n${p.selftext ?? ""}`;

        const vertical = classifyVertical(text);
        if (vertical === "other") continue;

        const matches = matchKeywords(text, keywords);
        const top =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : { phrase: q, category: "intent" as const, weight: 7, snippet: text.slice(0, 200) };
        const state = detectState(text);

        signals.push({
          external_id: `reddit:${p.id}`,
          source: "reddit",
          source_url: `https://www.reddit.com${p.permalink}`,
          source_post_content: text.slice(0, 5000),
          source_post_at: new Date(p.created_utc * 1000).toISOString(),
          person_name: p.author,
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: top.snippet,
          intent_category: top.category.startsWith("pain")
            ? "pain"
            : (top.category as RawSignal["intent_category"]),
          raw: {
            vertical,
            subreddit: p.subreddit,
            title: p.title,
            comments: p.num_comments,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[reddit-search] error for "${q}":`, err);
    }
  }
  return signals;
}
