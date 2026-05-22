import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

interface LobstersPost {
  short_id: string;
  title: string;
  description: string;
  url: string;
  comments_url: string;
  submitter_user: string;
  created_at: string;
  score: number;
  tags: string[];
}

/**
 * Lobste.rs — HN-style community with a public JSON feed.
 * Smaller volume but higher signal-to-noise for tech founders.
 */
export async function fetchLobstersSignals(): Promise<RawSignal[]> {
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];

  try {
    const res = await fetch("https://lobste.rs/newest.json", {
      headers: { "User-Agent": "AventisLeadsBot/1.0" },
    });
    if (!res.ok) {
      console.warn(`[lobsters] ${res.status}`);
      return [];
    }
    const posts = (await res.json()) as LobstersPost[];
    for (const p of posts) {
      const text = `${p.title}\n${p.description ?? ""}`;
      const matches = matchKeywords(text, keywords);
      const isShowOrLaunch =
        p.tags?.includes("show") ||
        p.tags?.includes("launch") ||
        /^(I (built|made|launched)|Show:|Launching)/i.test(p.title);
      if (matches.length === 0 && !isShowOrLaunch) continue;

      const top =
        matches.length > 0
          ? matches.reduce((a, b) => (a.weight >= b.weight ? a : b))
          : { phrase: "show/launch", category: "launching" as const, weight: 4, snippet: p.title };
      const state = detectState(text);

      signals.push({
        external_id: `lobsters:${p.short_id}`,
        source: "lobsters" as RawSignal["source"],
        source_url: p.comments_url ?? p.url,
        source_post_content: text.slice(0, 3000),
        source_post_at: p.created_at,
        person_name: p.submitter_user,
        location: state ?? undefined,
        matched_keywords: matches.length > 0 ? matches.map((m) => m.phrase) : ["show/launch"],
        intent_signal: top.snippet,
        intent_category: top.category as RawSignal["intent_category"],
        raw: { score: p.score, tags: p.tags, link: p.url },
      });
    }
  } catch (err) {
    console.error("[lobsters] error:", err);
  }
  return signals;
}
