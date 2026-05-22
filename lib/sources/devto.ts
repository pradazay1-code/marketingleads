import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

/**
 * DEV.to — public API, no auth. Lots of founders + indie builders post here.
 * https://developers.forem.com/api/v1
 */

const TAGS = ["startup", "marketing", "saas", "indiehackers", "business", "growth"];

interface DevArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  user: { name: string; username: string; twitter_username: string | null };
  tag_list: string[];
  positive_reactions_count: number;
  page_views_count?: number;
}

export async function fetchDevToSignals(): Promise<RawSignal[]> {
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const tag of TAGS) {
    try {
      const url = `https://dev.to/api/articles?tag=${tag}&per_page=30&top=7`;
      const res = await fetch(url, {
        headers: { "User-Agent": "AventisLeadsBot/1.0", Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[dev.to] ${res.status} for tag ${tag}`);
        continue;
      }
      const articles = (await res.json()) as DevArticle[];
      for (const a of articles) {
        const id = `devto:${a.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const text = `${a.title}\n${a.description}`;
        const matches = matchKeywords(text, keywords);
        // Lower bar for dev.to — also accept "I built" / "I launched" style posts
        const isLaunch = /^(I (built|launched|made|created)|introducing|launching|just shipped)/i.test(a.title);
        if (matches.length === 0 && !isLaunch) continue;

        const top =
          matches.length > 0
            ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
            : { phrase: "launch", category: "launching" as const, weight: 5, snippet: a.title };

        const state = detectState(text);

        signals.push({
          external_id: id,
          source: "devto" as RawSignal["source"],
          source_url: a.url,
          source_post_content: text.slice(0, 3000),
          source_post_at: a.published_at,
          person_name: a.user.name,
          twitter_handle: a.user.twitter_username ?? undefined,
          location: state ?? undefined,
          matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : ["launch"],
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: {
            reactions: a.positive_reactions_count,
            tags: a.tag_list,
            username: a.user.username,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.error(`[dev.to] error for tag ${tag}:`, err);
    }
  }
  return signals;
}
