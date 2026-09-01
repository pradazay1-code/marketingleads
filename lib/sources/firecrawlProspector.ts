import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";
import { firecrawlSearch, isFirecrawlEnabled } from "../scraping/firecrawl";
import { JUNK_REMOVAL, REAL_ESTATE, TARGET_METROS, classifyVertical } from "../verticals";

/**
 * Firecrawl-powered prospecting — the highest-yield discovery source.
 *
 * Two search modes:
 *   1. PAIN SEARCH — find operators publicly complaining about lead costs,
 *      bad CRMs, marketing that isn't working. These are buying-intent signals.
 *   2. DIRECTORY SEARCH — find junk removal / real estate businesses in each
 *      target metro that have a website but a weak marketing footprint.
 *
 * Firecrawl returns the page content along with the search result, so we get
 * discovery + enrichment in a single API call.
 */

const NON_PROSPECT_DOMAINS = [
  "wikipedia.org",
  "youtube.com",
  "amazon.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "angi.com",
  "homeadvisor.com",
  "thumbtack.com",
  "yelp.com",
  "zillow.com",
  "realtor.com",
  "trulia.com",
  "redfin.com",
  "1800gotjunk.com",
  "junk-king.com",
  "collegehunkshaulingjunk.com",
  "facebook.com",
  "instagram.com",
  "pinterest.com",
  "quora.com",
];

function isProspectableUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return !NON_PROSPECT_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Pain-point searches: operators publicly complaining = buying intent */
const PAIN_SEARCHES = [
  ...JUNK_REMOVAL.searchQueries,
  ...REAL_ESTATE.searchQueries,
];

/**
 * Directory-style searches per metro. We rotate metros each cycle so we
 * cover the whole East Coast over the course of a day.
 */
function directorySearches(metro: string): string[] {
  return [
    `junk removal company ${metro} -1800gotjunk -angi`,
    `estate cleanout service ${metro}`,
    `real estate team ${metro} website`,
    `property management company ${metro}`,
  ];
}

export async function fetchFirecrawlProspects(): Promise<RawSignal[]> {
  if (!isFirecrawlEnabled()) {
    console.warn("[firecrawl-prospector] FIRECRAWL_API_KEY not set — skipping");
    return [];
  }

  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  // Rotate which metros we prospect this cycle (2 metros × 4 searches = 8)
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const metroA = TARGET_METROS[epochHour % TARGET_METROS.length];
  const metroB = TARGET_METROS[(epochHour + 7) % TARGET_METROS.length];

  // Rotate which pain searches we run this cycle (4 per run)
  const painSlice: string[] = [];
  for (let i = 0; i < 4; i++) {
    painSlice.push(PAIN_SEARCHES[(epochHour + i * 3) % PAIN_SEARCHES.length]);
  }

  const queries = [
    ...painSlice,
    ...directorySearches(metroA),
    ...directorySearches(metroB),
  ];

  for (const q of queries) {
    try {
      const results = await firecrawlSearch(q, { limit: 8, scrapeResults: true });
      for (const r of results) {
        if (!isProspectableUrl(r.url)) continue;
        const id = `firecrawl:${Buffer.from(r.url).toString("base64").slice(0, 40)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const combinedText = [r.title, r.description, r.markdown?.slice(0, 4000)]
          .filter(Boolean)
          .join("\n");

        // Only keep results that clearly belong to one of our two verticals
        const vertical = classifyVertical(combinedText);
        if (vertical === "other") continue;

        const state = detectState(combinedText);
        const isPainSearch = painSlice.includes(q);

        let host = "";
        try {
          host = new URL(r.url).hostname.replace(/^www\./, "");
        } catch {
          /* ignore */
        }

        signals.push({
          external_id: id,
          source: "firecrawl",
          source_url: r.url,
          source_post_content: combinedText.slice(0, 5000),
          company_name: r.title?.split(/[|\-–—]/)[0]?.trim() || host || undefined,
          website: `https://${host}`,
          location: state ?? undefined,
          matched_keywords: [
            vertical === "junk_removal" ? "junk removal" : "real estate",
            isPainSearch ? "pain signal" : "directory discovery",
          ],
          intent_signal: isPainSearch
            ? `Found via pain search "${q}": ${r.description?.slice(0, 160) ?? r.title}`
            : `${vertical === "junk_removal" ? "Junk removal" : "Real estate"} business with website — ${r.title?.slice(0, 120) ?? host}`,
          intent_category: isPainSearch ? "pain" : "shopping",
          raw: {
            vertical,
            search_query: q,
            is_pain_search: isPainSearch,
            east_coast: isEastCoast(state),
            domain: host,
          },
        });
      }
      // Firecrawl search is relatively slow + rate-limited; pace ourselves
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error(`[firecrawl-prospector] error for "${q}":`, err);
    }
  }

  return signals;
}
