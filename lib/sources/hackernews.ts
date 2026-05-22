import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

interface HNHit {
  objectID: string;
  title: string | null;
  story_text: string | null;
  comment_text: string | null;
  url: string | null;
  author: string;
  created_at: string;
  created_at_i: number;
  num_comments: number | null;
  points: number | null;
  _tags: string[];
}

interface HNResponse {
  hits: HNHit[];
}

/**
 * Hacker News via Algolia search API — no auth required.
 * Searches both Show HN (founders launching) and Ask HN (founders asking for help).
 */
export async function fetchHackerNewsSignals(): Promise<RawSignal[]> {
  const keywords = await loadKeywords();
  const queries = [
    "marketing",
    "agency",
    "lead generation",
    "growth",
    "SEO",
    "white label",
    "needs marketing",
    "find customers",
  ];

  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    try {
      const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(
        q
      )}&tags=(story,ask_hn,show_hn)&hitsPerPage=30`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HN ${res.status}`);
      const data = (await res.json()) as HNResponse;

      for (const hit of data.hits) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);

        const text = [hit.title, hit.story_text, hit.comment_text]
          .filter(Boolean)
          .join("\n");
        if (!text) continue;

        const matches = matchKeywords(text, keywords);
        // For HN, also accept high-context matches even if no keyword (e.g. Show HN of a SaaS = founder we could partner with)
        const isShow = hit._tags.includes("show_hn");
        const isAsk = hit._tags.includes("ask_hn");
        if (matches.length === 0 && !isShow && !isAsk) continue;

        const topMatch =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : {
                phrase: isAsk ? "ask hn (potential need)" : "show hn (potential partner)",
                category: (isAsk ? "intent" : "launch") as RawSignal["intent_category"],
                weight: 4,
                snippet: hit.title ?? "",
              };
        const state = detectState(text);

        signals.push({
          external_id: `hn:${hit.objectID}`,
          source: "hackernews",
          source_url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source_post_content: text.slice(0, 4000),
          source_post_at: hit.created_at,
          person_name: hit.author,
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : [topMatch.phrase],
          intent_signal: topMatch.snippet || hit.title || "",
          intent_category: topMatch.category as RawSignal["intent_category"],
          raw: {
            title: hit.title,
            points: hit.points,
            num_comments: hit.num_comments,
            external_url: hit.url,
            search_query: q,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[hn] error for query "${q}":`, err);
    }
  }

  return signals;
}
