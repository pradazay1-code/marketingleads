import * as cheerio from "cheerio";
import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";
import { TARGET_METROS, classifyVertical } from "../verticals";

/**
 * Indeed job postings — a hiring junk-removal or real-estate business is a
 * GROWING business with payroll budget. That's a buying signal.
 *
 * v4: retargeted to junk removal + real estate roles specifically.
 *
 * Note: Indeed has anti-bot protection. Route through Firecrawl or
 * ScraperAPI (SCRAPER_API_KEY) for reliable volume.
 */

const VERTICAL_QUERIES = [
  // Junk removal — hiring drivers/crew means they have more work than capacity
  "junk removal driver",
  "hauling crew member",
  "junk removal technician",
  "dumpster delivery driver",
  // Real estate — hiring support staff means the team is scaling
  "real estate inside sales agent",
  "real estate transaction coordinator",
  "real estate marketing coordinator",
  "listing coordinator real estate",
  "property management assistant",
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
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.warn(`[indeed] ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[indeed] fetch error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function fetchIndeedSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  // Rotate metro coverage across cycles to stay under scraping limits
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const metros = [
    TARGET_METROS[epochHour % TARGET_METROS.length],
    TARGET_METROS[(epochHour + 5) % TARGET_METROS.length],
    TARGET_METROS[(epochHour + 11) % TARGET_METROS.length],
  ];

  for (const q of VERTICAL_QUERIES) {
    for (const city of metros) {
      try {
        const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(
          q
        )}&l=${encodeURIComponent(city)}&fromage=14&sort=date`;
        const html = await fetchHtml(url);
        if (!html) continue;

        const $ = cheerio.load(html);
        $('a[data-jk], .job_seen_beacon').each((_, el) => {
          const $el = $(el);
          const jk = $el.attr("data-jk") || $el.find("[data-jk]").first().attr("data-jk");
          if (!jk || seen.has(jk)) return;
          seen.add(jk);

          const rawCompany = $el
            .find('[data-testid="company-name"], .companyName')
            .first()
            .text()
            .trim();
          const title = $el
            .find('[data-testid="jobTitle"] span, h2.jobTitle span')
            .first()
            .text()
            .trim();
          const location = $el
            .find('[data-testid="text-location"], .companyLocation')
            .first()
            .text()
            .trim();
          const snippet = $el.find('.job-snippet, [data-testid="snippet"]').first().text().trim();
          if (!rawCompany || !title) return;

          // Reject staffing agencies + confidential postings — no real business to sell to
          if (/(staffing|recruiter|jobot|robert half|placement|aerotek|adecco|randstad)/i.test(rawCompany)) return;
          if (/^(confidential|undisclosed|private)$/i.test(rawCompany)) return;

          // Strip trailing Glassdoor rating from the company name
          const company = rawCompany.replace(/\s*\d\.\d+(\s*-\s*\d\.\d+)?\s*★?\s*$/i, "").trim();

          const vertical = classifyVertical(`${company} ${title} ${snippet}`);
          if (vertical === "other") return;

          const state = detectState(location);
          signals.push({
            external_id: `indeed:${jk}`,
            source: "indeed",
            source_url: `https://www.indeed.com/viewjob?jk=${jk}`,
            source_post_content: [
              `${company} is hiring: ${title}`,
              `Location: ${location}`,
              "",
              snippet,
              "",
              `Signal: a ${vertical === "junk_removal" ? "junk removal" : "real estate"} business hiring means they have more work than capacity — they're growing and have payroll budget.`,
            ].join("\n"),
            company_name: company,
            location,
            matched_keywords: [
              q,
              "hiring",
              "verified business",
              vertical === "junk_removal" ? "junk removal" : "real estate",
            ],
            intent_signal: `${company} is hiring a ${title} in ${location} — growing ${vertical === "junk_removal" ? "junk removal" : "real estate"} business with payroll budget`,
            intent_category: "hiring",
            raw: {
              vertical,
              title,
              location,
              snippet,
              query: q,
              east_coast: isEastCoast(state),
            },
          });
        });

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[indeed] error for ${q} in ${city}:`, err);
      }
    }
  }

  return signals;
}
