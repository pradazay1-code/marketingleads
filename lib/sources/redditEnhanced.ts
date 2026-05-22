import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

/**
 * Targeted Reddit search across multiple high-intent queries — runs in
 * ADDITION to fetchRedditSignals (which scans new posts per subreddit).
 * This catches keyword-matched posts even from subreddits we don't monitor.
 */

const SEARCH_QUERIES = [
  "looking for marketing agency",
  "need marketing help",
  "fired our marketing agency",
  "marketing agency recommendations",
  "need more leads",
  "white label software",
  "white label saas",
  "ai chatbot for my business",
  "best crm for small business",
  "best marketing automation",
  "low conversion rate help",
  "need a new website",
  "agency ripped me off",
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
        `"${q}"`
      )}&sort=new&t=week&limit=25`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
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
          source_post_content: text.slice(0, 4000),
          source_post_at: new Date(p.created_utc * 1000).toISOString(),
          person_name: p.author,
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: {
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
