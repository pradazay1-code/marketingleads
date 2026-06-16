import * as cheerio from "cheerio";
import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";

/**
 * Companies posting marketing job openings = companies that need marketing help RIGHT NOW.
 * We scan public job listings on Indeed for marketing roles. The hiring company
 * itself is the lead — they're already budgeting for marketing.
 *
 * Note: Indeed has anti-bot protection. We use a desktop UA and short scans.
 * For production volume, route through ScraperAPI by setting SCRAPER_API_KEY.
 */

const QUERIES = [
  "marketing manager",
  "marketing director",
  "head of growth",
  "chief marketing officer",
  "marketing coordinator",
];

const EAST_COAST_CITIES = [
  "New York, NY",
  "Boston, MA",
  "Philadelphia, PA",
  "Washington, DC",
  "Atlanta, GA",
  "Miami, FL",
  "Charlotte, NC",
  "Tampa, FL",
  "Orlando, FL",
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string | null> {
  const scraperKey = process.env.SCRAPER_API_KEY;
  const target = scraperKey
    ? `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(url)}&render=false`
    : url;
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.warn(`[indeed] ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[indeed] fetch error for ${url}:`, err);
    return null;
  }
}

export async function fetchIndeedSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of QUERIES) {
    for (const city of EAST_COAST_CITIES) {
      try {
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(
          q
        )}&l=${encodeURIComponent(city)}&fromage=7&sort=date`;
        const html = await fetchHtml(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        $('a[data-jk], .job_seen_beacon').each((_, el) => {
          const $el = $(el);
          const jk = $el.attr("data-jk") || $el.find("[data-jk]").first().attr("data-jk");
          if (!jk || seen.has(jk)) return;
          seen.add(jk);

          const company = $el.find('[data-testid="company-name"], .companyName').first().text().trim();
          const title = $el.find('[data-testid="jobTitle"] span, h2.jobTitle span').first().text().trim();
          const location = $el.find('[data-testid="text-location"], .companyLocation').first().text().trim();
          const snippet = $el.find('.job-snippet, [data-testid="snippet"]').first().text().trim();
          // Reject anything that's actually a staffing-agency / aggregator posting (no real business name)
          if (!company || !title) return;
          if (/(staffing|recruiters|jobot|robert half|placement|aerotek)/i.test(company)) return;
          // Reject if the "company" looks like a job-aggregator
          if (/^(confidential|undisclosed)$/i.test(company)) return;

          const state = detectState(location);
          // Indeed company-name often has a Glassdoor rating appended — strip
          const cleanCompany = company.replace(/\s*\d\.\d+(\s*-\s*\d\.\d+)?\s*★?\s*$/i, "").trim();

          signals.push({
            external_id: `indeed:${jk}`,
            source: "indeed",
            source_url: `https://www.indeed.com/viewjob?jk=${jk}`,
            source_post_content: `${cleanCompany} is hiring: ${title}\nLocation: ${location}\n\n${snippet}`,
            company_name: cleanCompany,
            location,
            matched_keywords: [q, "hiring marketer", "verified business"],
            intent_signal: `${cleanCompany} is hiring a ${title} in ${location} (real company, has budget)`,
            intent_category: "hiring",
            raw: { title, location, snippet, query: q, east_coast: isEastCoast(state) },
          });
        });

        await new Promise((r) => setTimeout(r, 1200));
      } catch (err) {
        console.error(`[indeed] error for ${q} in ${city}:`, err);
      }
    }
  }

  return signals;
}
