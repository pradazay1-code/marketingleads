import * as cheerio from "cheerio";
import { findContacts, type FoundContacts } from "../enrichment/emailFinder";
import { resolveCompanyWebsite } from "../enrichment/companyResolver";
import {
  isFirecrawlEnabled,
  firecrawlScrape,
  cachedExtractBusiness,
} from "../scraping/firecrawl";

/**
 * Enrichment pipeline. Firecrawl-first with cheerio fallback.
 *
 *   1. Resolve company → website (if we only have a name)
 *   2. Firecrawl structured extraction (emails, phones, owner, services,
 *      lead-marketplace badges) — handles JS-rendered sites that cheerio
 *      can't see. Falls back to cheerio scraping if Firecrawl is unset/fails.
 *   3. Supplemental contact discovery (contact-page crawl + pattern guesses)
 *   4. Tech-stack detection, social links, domain age
 */

export interface EnrichmentResult {
  website?: string | null;
  domain?: string | null;
  domain_age_estimate?: string | null;
  homepage_title?: string | null;
  homepage_description?: string | null;
  homepage_text?: string | null;
  about_text?: string | null;
  contact_emails?: string[];
  best_email?: string | null;
  email_confidence?: "verified" | "probable" | "guess" | null;
  contact_phones?: string[];
  best_phone?: string | null;
  owner_name?: string | null;
  services_offered?: string[];
  service_area?: string | null;
  years_in_business?: string | null;
  has_online_booking?: boolean | null;
  uses_lead_marketplace?: boolean | null;
  notable_details?: string | null;
  social_links?: Record<string, string>;
  linkedin_company_url?: string | null;
  tech_stack_hints?: string[];
  company_size_hint?: string | null;
  industry_hint?: string | null;
  has_blog?: boolean;
  has_pricing_page?: boolean;
  appears_active?: boolean;
  enriched_via?: "firecrawl" | "cheerio" | "none";
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function fetchHtml(
  url: string,
  timeoutMs = 8000
): Promise<{ html: string; headers: Headers } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return { html: await res.text(), headers: res.headers };
  } catch {
    return null;
  }
}

function detectTechStack(html: string, headers?: Headers): string[] {
  const stack = new Set<string>();
  const h = html.toLowerCase();
  const tests: Array<[string, RegExp]> = [
    ["Next.js", /__next|_next\/static|nextjs/],
    ["React", /react-dom|reactjs/],
    ["WordPress", /wp-content|wp-includes|wordpress/],
    ["Webflow", /webflow\.com|webflow\.js/],
    ["Wix", /wix\.com|wixstatic/],
    ["Squarespace", /squarespace\.com|squarespace-cdn/],
    ["GoDaddy Website Builder", /godaddy|websitebuilder\.godaddy/],
    ["Shopify", /cdn\.shopify\.com/],
    ["GoHighLevel", /msgsndr\.com|leadconnectorhq/],
    ["HubSpot", /hubspot|hs-scripts/],
    ["Follow Up Boss", /followupboss/],
    ["Salesforce", /salesforce\.com|force\.com/],
    ["Mailchimp", /list-manage\.com|mailchimp/],
    ["Klaviyo", /klaviyo\.com/],
    ["Google Analytics", /gtag\(|google-analytics|googletagmanager/],
    ["Meta Pixel", /fbevents\.js|connect\.facebook\.net\/.*\/fbevents/],
    ["Stripe", /js\.stripe\.com/],
    ["Calendly", /assets\.calendly\.com/],
    ["Housecall Pro", /housecallpro/],
    ["Jobber", /getjobber|jobber\.com/],
    ["ServiceTitan", /servicetitan/],
    ["IDX Broker", /idxbroker/],
    ["Real Geeks", /realgeeks/],
    ["Placester", /placester/],
    ["Intercom", /widget\.intercom\.io/],
    ["Tailwind CSS", /tailwindcss/],
    ["Cloudflare", /cloudflare/],
    ["Vercel", /vercel\.app|_vercel/],
  ];
  for (const [name, re] of tests) if (re.test(h)) stack.add(name);

  // Lead-marketplace badges — a strong buying signal in both verticals
  if (/angi\.com|angieslist|homeadvisor/.test(h)) stack.add("Angi/HomeAdvisor badge");
  if (/thumbtack/.test(h)) stack.add("Thumbtack badge");
  if (/zillow/.test(h)) stack.add("Zillow badge");
  if (/realtor\.com/.test(h)) stack.add("Realtor.com badge");

  if (headers) {
    const server = headers.get("server")?.toLowerCase() ?? "";
    if (server.includes("cloudflare")) stack.add("Cloudflare");
    if (server.includes("nginx")) stack.add("Nginx");
    const xp = headers.get("x-powered-by")?.toLowerCase() ?? "";
    if (xp.includes("next.js")) stack.add("Next.js");
  }
  return Array.from(stack);
}

function extractSocialLinks(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const links: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    if (!href.startsWith("http")) return;
    if (!links.twitter && /(twitter\.com|x\.com)\/[a-z0-9_]+/.test(href) && !/intent|share/.test(href))
      links.twitter = href;
    if (!links.linkedin && /linkedin\.com\/(company|in)\//.test(href)) links.linkedin = href;
    if (!links.facebook && /facebook\.com\/[a-z0-9.]+/.test(href) && !/sharer|share\.php/.test(href))
      links.facebook = href;
    if (!links.instagram && /instagram\.com\/[a-z0-9_.]+/.test(href)) links.instagram = href;
    if (!links.youtube && /(youtube\.com\/(channel|c|user|@)|youtu\.be)/.test(href))
      links.youtube = href;
    if (!links.tiktok && /tiktok\.com\/@[a-z0-9_.]+/.test(href)) links.tiktok = href;
  });
  return links;
}

async function estimateDomainAge(domain: string): Promise<string | null> {
  try {
    const url = `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}&timestamp=20000101`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      archived_snapshots?: { closest?: { timestamp?: string } };
    };
    const ts = data.archived_snapshots?.closest?.timestamp;
    if (!ts || ts.length < 4) return null;
    const year = parseInt(ts.slice(0, 4), 10);
    const month = parseInt(ts.slice(4, 6), 10);
    const ageYears = new Date().getFullYear() - year;
    if (ageYears <= 0) return `first archived ${year}`;
    return `~${ageYears}y old (first archived ${year}-${String(month).padStart(2, "0")})`;
  } catch {
    return null;
  }
}

function urlToDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const SKIP_DOMAINS = [
  "reddit.com",
  "twitter.com",
  "x.com",
  "google.com",
  "news.google.com",
  "indeed.com",
  "opencorporates.com",
  "linkedin.com",
  "facebook.com",
  "angi.com",
  "thumbtack.com",
  "zillow.com",
  "realtor.com",
  "yelp.com",
];

export async function enrichLead(input: {
  website?: string | null;
  source_url?: string | null;
  company_name?: string | null;
  person_name?: string | null;
  location?: string | null;
}): Promise<EnrichmentResult> {
  const result: EnrichmentResult = { enriched_via: "none" };

  // ── STEP 1: resolve a website ──────────────────────────────────────
  let websiteUrl: string | null = input.website ?? null;
  if (!websiteUrl && input.source_url) {
    const d = urlToDomain(input.source_url);
    if (d && !SKIP_DOMAINS.some((s) => d === s || d.endsWith(`.${s}`))) {
      websiteUrl = input.source_url;
    }
  }
  if (!websiteUrl && input.company_name) {
    const resolved = await resolveCompanyWebsite({
      companyName: input.company_name,
      location: input.location,
    });
    if (resolved.website) websiteUrl = resolved.website;
    if (resolved.linkedin) result.linkedin_company_url = resolved.linkedin;
  }
  if (!websiteUrl) return result;

  result.website = websiteUrl;
  result.domain = urlToDomain(websiteUrl);

  // ── STEP 2: Firecrawl structured extraction (preferred) ────────────
  let rawHtml: string | null = null;
  let pageText: string | null = null;

  if (isFirecrawlEnabled()) {
    const [extraction, scraped] = await Promise.all([
      cachedExtractBusiness(websiteUrl),
      firecrawlScrape(websiteUrl, { includeLinks: true }),
    ]);

    if (extraction) {
      result.enriched_via = "firecrawl";
      result.owner_name = extraction.owner_or_contact_name ?? null;
      result.services_offered = extraction.services_offered ?? undefined;
      result.service_area = extraction.service_area ?? null;
      result.years_in_business = extraction.years_in_business ?? null;
      result.has_online_booking = extraction.has_online_booking ?? null;
      result.uses_lead_marketplace = extraction.uses_lead_marketplace ?? null;
      result.notable_details = extraction.notable_details ?? null;
      result.company_size_hint = extraction.team_size ?? null;

      const emails = new Set<string>();
      if (extraction.email) emails.add(extraction.email);
      for (const e of extraction.all_emails ?? []) emails.add(e);
      if (emails.size > 0) {
        result.contact_emails = Array.from(emails);
        result.best_email = extraction.email ?? Array.from(emails)[0];
        result.email_confidence = "verified";
      }

      const phones = new Set<string>();
      if (extraction.phone) phones.add(extraction.phone);
      for (const p of extraction.all_phones ?? []) phones.add(p);
      if (phones.size > 0) {
        result.contact_phones = Array.from(phones);
        result.best_phone = extraction.phone ?? Array.from(phones)[0];
      }

      if (extraction.social_links?.length) {
        const social: Record<string, string> = {};
        for (const link of extraction.social_links) {
          const l = link.toLowerCase();
          if (l.includes("linkedin")) social.linkedin = link;
          else if (l.includes("facebook")) social.facebook = link;
          else if (l.includes("instagram")) social.instagram = link;
          else if (l.includes("twitter") || l.includes("x.com")) social.twitter = link;
          else if (l.includes("youtube")) social.youtube = link;
          else if (l.includes("tiktok")) social.tiktok = link;
        }
        if (Object.keys(social).length) result.social_links = social;
      }
    }

    if (scraped) {
      result.homepage_title = scraped.title;
      result.homepage_description = scraped.description;
      pageText = scraped.markdown;
      rawHtml = scraped.html;
      if (scraped.markdown) result.homepage_text = scraped.markdown.slice(0, 5000);
    }
  }

  // ── STEP 3: cheerio fallback when Firecrawl unavailable or empty ───
  if (!pageText) {
    const home = await fetchHtml(websiteUrl);
    if (home) {
      result.enriched_via = result.enriched_via === "firecrawl" ? "firecrawl" : "cheerio";
      rawHtml = home.html;
      const $ = cheerio.load(home.html);
      result.homepage_title ??= $("title").first().text().trim() || null;
      result.homepage_description ??=
        $('meta[name="description"]').attr("content")?.trim() ||
        $('meta[property="og:description"]').attr("content")?.trim() ||
        null;
      $("script, style, noscript, svg").remove();
      pageText = $("body").text().replace(/\s+/g, " ").trim();
      result.homepage_text ??= pageText.slice(0, 5000);
      result.tech_stack_hints = detectTechStack(home.html, home.headers);
    }
  }

  if (rawHtml) {
    result.tech_stack_hints ??= detectTechStack(rawHtml);
    const social = extractSocialLinks(rawHtml);
    if (Object.keys(social).length) {
      result.social_links = { ...social, ...(result.social_links ?? {}) };
    }
    result.has_pricing_page = /href="[^"]*\/(pricing|plans|rates)"/i.test(rawHtml);
    result.has_blog = /href="[^"]*\/(blog|news|resources)"/i.test(rawHtml);
    // Marketplace badges are a top-tier buying signal
    if (result.uses_lead_marketplace === undefined || result.uses_lead_marketplace === null) {
      result.uses_lead_marketplace =
        /angi\.com|angieslist|homeadvisor|thumbtack|zillow\.com|realtor\.com/i.test(rawHtml);
    }
  }

  if (pageText) {
    if (!result.company_size_hint) {
      if (/\b(solo|owner[- ]operator|1[- ]person|just me)\b/i.test(pageText))
        result.company_size_hint = "solo/owner-operator";
      else {
        const m = pageText.match(/\b(team of \d+|we are \d+|\d+\+? (employees|trucks|agents))\b/i);
        if (m) result.company_size_hint = m[0];
      }
    }
    result.appears_active =
      pageText.length > 200 &&
      !/\b(under construction|coming soon|domain for sale|parked)\b/i.test(pageText);
  }

  // ── STEP 4: supplemental contact discovery ─────────────────────────
  // Runs even when Firecrawl found some contacts — the contact-page crawl
  // and pattern guesses often surface additional inboxes.
  const contacts: FoundContacts = await findContacts({
    websiteUrl,
    personName: result.owner_name ?? input.person_name,
    scrapedText: pageText,
  });

  if (contacts.emails.length > 0) {
    const existing = new Set(result.contact_emails ?? []);
    for (const e of contacts.emails) existing.add(e.email);
    result.contact_emails = Array.from(existing).slice(0, 12);
    if (!result.best_email) {
      const verified = contacts.emails.find((e) => e.confidence === "verified");
      result.best_email = verified?.email ?? contacts.best_email;
      result.email_confidence = verified ? "verified" : "guess";
    }
  }
  if (contacts.phones.length > 0) {
    const existing = new Set(result.contact_phones ?? []);
    for (const p of contacts.phones) existing.add(p);
    result.contact_phones = Array.from(existing).slice(0, 6);
    result.best_phone ??= contacts.best_phone;
  }

  // ── STEP 5: domain age ─────────────────────────────────────────────
  if (result.domain) {
    result.domain_age_estimate = await estimateDomainAge(result.domain);
  }

  return result;
}
