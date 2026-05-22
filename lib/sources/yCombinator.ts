import * as cheerio from "cheerio";
import type { RawSignal } from "../types";

/**
 * Y Combinator's public company directory has every startup they've ever funded,
 * including new ones. Recently-funded startups are great prospects for
 * marketing services + white-label software (they have funding, are growing fast).
 *
 * Source: https://www.ycombinator.com/companies (public).
 */
export async function fetchYCSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];

  try {
    // Most recent batch — change the batch as new ones come out
    const url = "https://www.ycombinator.com/companies?batch=W25,S24,W24&isHiring=true";
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) {
      console.warn(`[yc] ${res.status}`);
      return [];
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    // YC's directory uses _next data — try to find embedded JSON
    const nextDataScript = $("script#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const data = JSON.parse(nextDataScript);
        const companies: Array<{
          id?: string;
          name?: string;
          slug?: string;
          one_liner?: string;
          long_description?: string;
          website?: string;
          all_locations?: string;
          batch?: string;
          industry?: string;
          team_size?: number;
        }> = data?.props?.pageProps?.companies ?? [];
        for (const c of companies.slice(0, 50)) {
          if (!c.id || !c.name) continue;
          const location = c.all_locations ?? "";
          const stateMatch = location.match(/, ([A-Z]{2})\b/);
          signals.push({
            external_id: `yc:${c.id}`,
            source: "ycombinator" as RawSignal["source"],
            source_url: `https://www.ycombinator.com/companies/${c.slug ?? c.id}`,
            source_post_content: `${c.name} (YC ${c.batch ?? ""}): ${c.one_liner ?? ""}\n\n${c.long_description ?? ""}\n\nLocation: ${location}\nIndustry: ${c.industry ?? "—"}\nTeam size: ${c.team_size ?? "—"}`,
            company_name: c.name,
            website: c.website,
            location,
            matched_keywords: ["yc startup", "funded", "hiring"],
            intent_signal: `YC-funded startup (${c.batch ?? "recent"}) hiring: ${c.one_liner ?? c.name}`,
            intent_category: "launching",
            raw: {
              batch: c.batch,
              industry: c.industry,
              team_size: c.team_size,
              state: stateMatch?.[1],
            },
          });
        }
      } catch (parseErr) {
        console.warn("[yc] could not parse __NEXT_DATA__:", parseErr);
      }
    }
  } catch (err) {
    console.error("[yc] error:", err);
  }
  return signals;
}
