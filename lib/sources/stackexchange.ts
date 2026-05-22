import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords, detectState } from "../keywords";

/**
 * Stack Exchange API — Webmasters / Startups / Pro Webmasters all have
 * marketing-related Q&A. Free public API, no auth needed for read access.
 * https://api.stackexchange.com
 */

const SITES = ["webmasters", "freelancing", "writers", "pm"];

interface SEQuestion {
  question_id: number;
  title: string;
  body_markdown?: string;
  link: string;
  owner: { display_name: string; user_id: number };
  creation_date: number;
  tags: string[];
  is_answered: boolean;
  view_count: number;
}

interface SEResponse {
  items?: SEQuestion[];
}

export async function fetchStackExchangeSignals(): Promise<RawSignal[]> {
  const keywords = await loadKeywords();
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const site of SITES) {
    try {
      const since = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
      const url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&site=${site}&fromdate=${since}&filter=withbody&pagesize=50`;
      const res = await fetch(url, {
        headers: { "User-Agent": "AventisLeadsBot/1.0", "Accept-Encoding": "gzip" },
      });
      if (!res.ok) {
        console.warn(`[stackex] ${res.status} for site ${site}`);
        continue;
      }
      const data = (await res.json()) as SEResponse;
      for (const q of data.items ?? []) {
        const id = `stackex:${site}:${q.question_id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const text = `${q.title}\n${q.body_markdown ?? ""}`;
        const matches = matchKeywords(text, keywords);
        if (matches.length === 0) continue;

        const top = matches.reduce((a, b) => (a.weight >= b.weight ? a : b));
        const state = detectState(text);

        signals.push({
          external_id: id,
          source: "stackexchange" as RawSignal["source"],
          source_url: q.link,
          source_post_content: text.slice(0, 4000),
          source_post_at: new Date(q.creation_date * 1000).toISOString(),
          person_name: q.owner.display_name,
          location: state ?? undefined,
          matched_keywords: matches.map((m) => m.phrase),
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: {
            site,
            tags: q.tags,
            views: q.view_count,
            answered: q.is_answered,
            title: q.title,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[stackex] error for ${site}:`, err);
    }
  }
  return signals;
}
