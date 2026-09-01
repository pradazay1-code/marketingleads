import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState, hasVerticalMatch } from "../keywords";
import { ALL_SUBREDDITS, classifyVertical } from "../verticals";

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
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${url}`);
  return (await res.json()) as RedditListing;
}

/**
 * Scan the `new` feed of each vertical-relevant subreddit.
 *
 * v4 change: a post must match a JUNK REMOVAL or REAL ESTATE keyword —
 * generic "need marketing help" is no longer enough to create a lead.
 */
export async function fetchRedditSignals(
  opts: { subreddits?: string[]; limit?: number } = {}
): Promise<RawSignal[]> {
  const subs = opts.subreddits ?? ALL_SUBREDDITS;
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

        // HARD REQUIREMENT: must be junk removal or real estate related
        if (!hasVerticalMatch(matches)) continue;

        const vertical = classifyVertical(text);
        if (vertical === "other") continue;

        const topMatch = matches.reduce((a, b) => (a.weight >= b.weight ? a : b));
        const state = detectState(text);

        signals.push({
          external_id: `reddit:${p.id}`,
          source: "reddit",
          source_url: `https://www.reddit.com${p.permalink}`,
          source_post_content: text.slice(0, 5000),
          source_post_at: new Date(p.created_utc * 1000).toISOString(),
          person_name: p.author,
          location: state ?? undefined,
          matched_keywords: matches.map((m) => m.phrase),
          intent_signal: topMatch.snippet,
          intent_category: topMatch.category.startsWith("pain")
            ? "pain"
            : (topMatch.category as RawSignal["intent_category"]),
          raw: {
            vertical,
            subreddit: p.subreddit,
            title: p.title,
            num_comments: p.num_comments,
            url: p.url,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`[reddit] error scanning r/${sub}:`, err);
    }
  }

  return signals;
}
