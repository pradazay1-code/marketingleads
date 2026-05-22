import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

/**
 * Bluesky — open social network with a free, no-auth public search API.
 * Founders + small-business owners increasingly post here.
 * Docs: https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
 */

const QUERIES = [
  "looking for a marketing agency",
  "need help with marketing",
  "need more leads",
  "white label software",
  "just launched my business",
  "fired our marketing agency",
  "marketing agency recommendations",
  "AI marketing tool",
];

interface BlueskyPost {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
  };
  record: {
    text: string;
    createdAt: string;
  };
  indexedAt: string;
}

interface BlueskyResponse {
  posts?: BlueskyPost[];
}

export async function fetchBlueskySignals(): Promise<RawSignal[]> {
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    try {
      const url = `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(
        q
      )}&limit=25&sort=latest`;
      const res = await fetch(url, {
        headers: { "User-Agent": "AventisLeadsBot/1.0", Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[bluesky] ${res.status} for "${q}"`);
        continue;
      }
      const data = (await res.json()) as BlueskyResponse;
      for (const p of data.posts ?? []) {
        if (seen.has(p.uri)) continue;
        seen.add(p.uri);
        const text = p.record.text ?? "";
        const matches = matchKeywords(text, keywords);
        const top =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : { phrase: q, category: "intent" as const, weight: 5, snippet: text };
        const state = detectState(`${text} ${p.author.description ?? ""}`);

        // Convert at:// URI to web URL
        const rkey = p.uri.split("/").pop();
        const webUrl = `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;

        signals.push({
          external_id: `bluesky:${p.cid}`,
          source: "bluesky" as RawSignal["source"],
          source_url: webUrl,
          source_post_content: text,
          source_post_at: p.record.createdAt,
          person_name: p.author.displayName ?? p.author.handle,
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [q],
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: {
            handle: p.author.handle,
            bio: p.author.description,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`[bluesky] error for "${q}":`, err);
    }
  }
  return signals;
}
