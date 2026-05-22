import * as cheerio from "cheerio";
import type { RawSignal } from "../types";
import { loadKeywords, matchKeywords } from "../keywords";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Indie Hackers — founders openly sharing struggles and needs.
 * We scan the public groups/posts pages.
 */
export async function fetchIndieHackersSignals(): Promise<RawSignal[]> {
  const groups = ["growth", "marketing", "starting-up"];
  const signals: RawSignal[] = [];
  const seen = new Set<string>();
  const keywords = await loadKeywords();

  for (const group of groups) {
    try {
      const url = `https://www.indiehackers.com/group/${group}`;
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.warn(`[indiehackers] ${res.status} for ${group}`);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      $('a[href^="/post/"]').each((_, el) => {
        const href = $(el).attr("href");
        if (!href) return;
        const id = href.replace("/post/", "").split("?")[0];
        if (seen.has(id)) return;
        seen.add(id);

        const title = $(el).text().trim();
        if (!title) return;

        const text = title;
        const matches = matchKeywords(text, keywords);
        if (matches.length === 0) return;

        const top = matches.reduce((a, b) => (a.weight >= b.weight ? a : b));
        signals.push({
          external_id: `indiehackers:${id}`,
          source: "indiehackers",
          source_url: `https://www.indiehackers.com${href}`,
          source_post_content: title.slice(0, 2000),
          matched_keywords: matches.map((m) => m.phrase),
          intent_signal: top.snippet,
          intent_category: top.category as RawSignal["intent_category"],
          raw: { group, title },
        });
      });

      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`[indiehackers] error for ${group}:`, err);
    }
  }
  return signals;
}
