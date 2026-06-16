import * as cheerio from "cheerio";
import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";

/**
 * Funding announcements via Google News RSS — companies that just raised
 * a Seed/Series A/B round are PRIME prospects:
 *   - Verified real businesses
 *   - Have budget RIGHT NOW
 *   - Often hiring marketers (or need marketing services to grow)
 *   - Founder names are publicly stated in the article
 *
 * No API key required. Google News RSS is a public XML feed.
 */

const SEARCH_QUERIES = [
  "raises seed funding",
  "series A round announcement",
  "series B round announcement",
  "secures funding 2026",
  "raises pre-seed",
  "startup funding announcement",
];

interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  source: string;
}

const COMPANY_NAME_PATTERNS = [
  // "ACME raises $5M" → ACME
  /^([A-Z][A-Za-z0-9.&'\- ]{1,50}?)\s+(raises|secures|closes|announces|nets|lands|picks up|receives)\b/,
  // "$5M for ACME" → ACME
  /\$[\d.]+[MK]?\s+(?:for|to)\s+([A-Z][A-Za-z0-9.&'\- ]{1,50})/,
  // "ACME, a ... company, raises" → ACME
  /^([A-Z][A-Za-z0-9.&'\- ]{1,50}?),\s+(?:a|the)\s+/,
];

function extractCompanyName(headline: string): string | null {
  for (const re of COMPANY_NAME_PATTERNS) {
    const m = headline.match(re);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (candidate.length >= 2 && candidate.length <= 60) return candidate;
    }
  }
  return null;
}

function extractFundingAmount(headline: string): string | null {
  const m = headline.match(/\$[\d.]+[BMK]?/);
  return m?.[0] ?? null;
}

function extractRoundType(headline: string): string | null {
  const m = headline.match(/\b(pre-seed|seed|series [A-F]|growth round)\b/i);
  return m?.[0]?.toLowerCase() ?? null;
}

async function fetchRss(url: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AventisLeadsBot/1.0", Accept: "application/rss+xml,application/xml,text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[news-funding] RSS ${res.status} for ${url}`);
      return [];
    }
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: NewsItem[] = [];
    $("item").each((_, el) => {
      const $el = $(el);
      items.push({
        title: $el.find("title").first().text().trim(),
        link: $el.find("link").first().text().trim(),
        pubDate: $el.find("pubDate").first().text().trim(),
        description: $el.find("description").first().text().trim(),
        source: $el.find("source").first().text().trim() || "Google News",
      });
    });
    return items;
  } catch (err) {
    console.error(`[news-funding] error:`, err);
    return [];
  }
}

export async function fetchFundingNewsSignals(): Promise<RawSignal[]> {
  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  for (const q of SEARCH_QUERIES) {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:14d&hl=en-US&gl=US&ceid=US:en`;
    const items = await fetchRss(rssUrl);
    for (const item of items) {
      // Stable id from the article URL
      const id = `news:${Buffer.from(item.link).toString("base64").slice(0, 32)}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const company = extractCompanyName(item.title);
      const amount = extractFundingAmount(item.title);
      const round = extractRoundType(item.title);

      // Skip headlines we can't extract a company from — low quality
      if (!company) continue;

      const fullText = `${item.title}\n\n${item.description ?? ""}`;
      const state = detectState(fullText);

      signals.push({
        external_id: id,
        source: "newsfunding",
        source_url: item.link,
        source_post_content: fullText.slice(0, 3000),
        source_post_at: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        company_name: company,
        location: state ?? undefined,
        matched_keywords: ["funding announcement", round ?? "round", "just raised"],
        intent_signal: `${company} just ${amount ? `raised ${amount}` : "received funding"}${round ? ` (${round})` : ""} — likely budget for marketing growth services`,
        intent_category: "launching",
        raw: {
          funding_amount: amount,
          round_type: round,
          news_source: item.source,
          headline: item.title,
          east_coast: isEastCoast(state),
          search_query: q,
        },
      });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return signals;
}
