import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

const DEFAULT_SUBREDDITS = [
  "smallbusiness",
  "Entrepreneur",
  "startups",
  "EntrepreneurRideAlong",
  "marketing",
  "SEO",
  "sweatystartup",
  "SaaS",
  "b2bmarketing",
  "advertising",
  "DigitalMarketing",
  "Startup_Ideas",
];

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    permalink: string;
    subreddit: string;
    author: string;
    created_utc: number;
    url: string;
    num_comments: number;
    over_18: boolean;
  };
}

interface RedditListing {
  data: { children: RedditPost[] };
}

const UA = process.env.REDDIT_USER_AGENT || "AventisLeadsBot/1.0";

async function fetchRedditJson(url: string): Promise<RedditListing> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${url}`);
  return (await res.json()) as RedditListing;
}

/**
 * Scan Reddit's `new` feed for each subreddit. Reddit's public JSON
 * endpoints don't require auth — just a User-Agent.
 */
export async function fetchRedditSignals(
  opts: { subreddits?: string[]; limit?: number } = {}
): Promise<RawSignal[]> {
  const subs = opts.subreddits ?? DEFAULT_SUBREDDITS;
  const limit = opts.limit ?? 50;
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];

  for (const sub of subs) {
    try {
      const listing = await fetchRedditJson(
        `https://www.reddit.com/r/${encodeURIComponent(sub)}/new.json?limit=${limit}`
      );
      for (const child of listing.data.children) {
        const p = child.data;
        if (p.over_18) continue;
        const text = `${p.title}\n${p.selftext ?? ""}`;
        const matches = matchKeywords(text, keywords);
        if (matches.length === 0) continue;

        const topMatch = matches.reduce((a, b) => (a.weight >= b.weight ? a : b));
        const state = detectState(text);

        signals.push({
          external_id: `reddit:${p.id}`,
          source: "reddit",
          source_url: `https://www.reddit.com${p.permalink}`,
          source_post_content: text.slice(0, 4000),
          source_post_at: new Date(p.created_utc * 1000).toISOString(),
          person_name: p.author,
          location: state ?? undefined,
          matched_keywords: matches.map((m) => m.phrase),
          intent_signal: topMatch.snippet,
          intent_category: topMatch.category as RawSignal["intent_category"],
          raw: {
            subreddit: p.subreddit,
            title: p.title,
            num_comments: p.num_comments,
            url: p.url,
          },
        });
      }
      // small jitter so we don't hit rate limits
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`[reddit] error scanning r/${sub}:`, err);
    }
  }

  return signals;
}

/**
 * Search Reddit's site-wide search for an explicit query.
 * Useful for very specific intent phrases.
 */
export async function searchReddit(query: string, limit = 25): Promise<RawSignal[]> {
  try {
    const listing = await fetchRedditJson(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(
        query
      )}&sort=new&t=week&limit=${limit}`
    );
    const keywords = await loadKeywords();
    const out: RawSignal[] = [];
    for (const child of listing.data.children) {
      const p = child.data;
      if (p.over_18) continue;
      const text = `${p.title}\n${p.selftext ?? ""}`;
      const matches = matchKeywords(text, keywords);
      const topMatch =
        matches.length > 0
          ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
          : { snippet: query, category: "intent" as const, weight: 5, phrase: query };
      const state = detectState(text);
      out.push({
        external_id: `reddit:${p.id}`,
        source: "reddit",
        source_url: `https://www.reddit.com${p.permalink}`,
        source_post_content: text.slice(0, 4000),
        source_post_at: new Date(p.created_utc * 1000).toISOString(),
        person_name: p.author,
        location: state ?? undefined,
        matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [query],
        intent_signal: topMatch.snippet,
        intent_category: topMatch.category as RawSignal["intent_category"],
        raw: { subreddit: p.subreddit, title: p.title, search_query: query },
      });
    }
    return out;
  } catch (err) {
    console.error(`[reddit] search error for "${query}":`, err);
    return [];
  }
}
