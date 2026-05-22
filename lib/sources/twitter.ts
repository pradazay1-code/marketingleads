import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

/**
 * Twitter/X via the official API v2 (requires bearer token).
 *
 * To use: get a free dev account at https://developer.x.com,
 * set TWITTER_BEARER_TOKEN in env vars.
 *
 * Free tier allows ~500k tweets/month search — plenty for our use.
 */
const QUERIES = [
  '"looking for a marketing agency" -is:retweet lang:en',
  '"need help with marketing" -is:retweet lang:en',
  '"fired my marketing agency" -is:retweet lang:en',
  '"need more leads" -is:retweet lang:en',
  '"white label software" -is:retweet lang:en',
  '"just launched" startup -is:retweet lang:en',
];

interface TweetUser {
  id: string;
  name: string;
  username: string;
  location?: string;
  description?: string;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
}

interface TwitterResponse {
  data?: Tweet[];
  includes?: { users?: TweetUser[] };
}

export async function fetchTwitterSignals(): Promise<RawSignal[]> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.warn("[twitter] TWITTER_BEARER_TOKEN not set — skipping");
    return [];
  }

  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    try {
      const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        q
      )}&max_results=25&tweet.fields=created_at,author_id&expansions=author_id&user.fields=name,username,location,description`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`[twitter] ${res.status} for ${q}`);
        continue;
      }
      const data = (await res.json()) as TwitterResponse;
      const userMap = new Map<string, TweetUser>();
      for (const u of data.includes?.users ?? []) userMap.set(u.id, u);

      for (const t of data.data ?? []) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        const u = userMap.get(t.author_id);
        const matches = matchKeywords(t.text, keywords);
        const top =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : { phrase: q, category: "intent" as const, weight: 5, snippet: t.text };
        const state = detectState(`${t.text} ${u?.location ?? ""}`);

        signals.push({
          external_id: `twitter:${t.id}`,
          source: "twitter",
          source_url: `https://twitter.com/${u?.username ?? "i"}/status/${t.id}`,
          source_post_content: t.text,
          source_post_at: t.created_at,
          person_name: u?.name,
          location: u?.location || state || undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: {
            handle: u?.username,
            bio: u?.description,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 1100)); // respect rate limits
    } catch (err) {
      console.error(`[twitter] error for "${q}":`, err);
    }
  }

  return signals;
}
