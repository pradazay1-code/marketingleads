import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";
import { classifyVertical } from "../verticals";

/**
 * Twitter/X API v2 — vertical-specific intent search.
 * Requires TWITTER_BEARER_TOKEN (free dev tier works).
 *
 * v4: queries are junk removal + real estate specific only.
 */
const QUERIES = [
  // Junk removal
  '"junk removal" (angi OR thumbtack) -is:retweet lang:en',
  '"junk removal business" (leads OR marketing) -is:retweet lang:en',
  '"hauling business" leads -is:retweet lang:en',
  // Real estate
  '"zillow leads" (expensive OR waste OR done) -is:retweet lang:en',
  '"real estate" "need a better crm" -is:retweet lang:en',
  '(realtor OR "real estate agent") "lead generation" -is:retweet lang:en',
  '"real estate team" marketing agency -is:retweet lang:en',
];

interface TweetUser {
  id: string;
  name: string;
  username: string;
  location?: string;
  description?: string;
  url?: string;
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
      )}&max_results=25&tweet.fields=created_at,author_id&expansions=author_id&user.fields=name,username,location,description,url`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12000),
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

        // Classify using tweet + the author's bio (bios often say "Realtor @ X")
        const combined = `${t.text} ${u?.description ?? ""} ${u?.name ?? ""}`;
        const vertical = classifyVertical(combined);
        if (vertical === "other") continue;

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
          source_post_content: `${t.text}\n\n--- Author bio ---\n${u?.description ?? "(none)"}`,
          source_post_at: t.created_at,
          person_name: u?.name,
          website: u?.url,
          location: u?.location || state || undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: top.snippet,
          intent_category: top.category.startsWith("pain")
            ? "pain"
            : (top.category as RawSignal["intent_category"]),
          raw: {
            vertical,
            handle: u?.username,
            bio: u?.description,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 1100));
    } catch (err) {
      console.error(`[twitter] error for "${q}":`, err);
    }
  }

  return signals;
}
