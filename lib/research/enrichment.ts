import * as cheerio from "cheerio";
import { findContacts, type FoundContacts } from "../enrichment/emailFinder";
import { resolveCompanyWebsite } from "../enrichment/companyResolver";

/**
 * Aggressive enrichment pipeline. Runs BEFORE the AI research step and
 * actively goes hunting for missing contact info instead of just scraping
 * whatever URL was provided.
 *
 *   1. Resolve company → website (if we don't have one yet)
 *   2. Scrape homepage + /about + /contact + /team
 *   3. Extract emails (scraped + common-inbox + name-pattern guesses)
 *   4. Extract phone numbers
 *   5. Detect tech stack
 *   6. Extract social links
 *   7. Look up domain age (Wayback)
 *
 * Every step is best-effort and continues on failure.
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
  social_links?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    github?: string;
    tiktok?: string;
  };
  linkedin_company_url?: string | null;
  tech_stack_hints?: string[];
  company_size_hint?: string | null;
  industry_hint?: string | null;
  has_blog?: boolean;
  has_pricing_page?: boolean;
  appears_active?: boolean;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function fetchHtml(url: string, timeoutMs = 8000): Promise<{ html: string; headers: Headers } | null> {
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

function detectTechStack(html: string, headers: Headers): string[] {
  const stack: Set<string> = new Set();
  const h = html.toLowerCase();
  const tests: Array<[string, RegExp | string]> = [
    ["Next.js", /__next|_next\/static|nextjs/],
    ["React", /react-dom|reactjs/],
    ["WordPress", /wp-content|wp-includes|wordpress/],
    ["Webflow", /webflow\.com|webflow\.js/],
    ["Wix", /wix\.com|wixstatic/],
    ["Squarespace", /squarespace\.com|squarespace-cdn/],
    ["Shopify", /cdn\.shopify\.com|shopify\.com\/s/],
    ["GoHighLevel", /msgsndr\.com|leadconnectorhq/],
    ["HubSpot", /hubspot|hs-scripts/],
    ["Mailchimp", /list-manage\.com|mailchimp/],
    ["Klaviyo", /klaviyo\.com/],
    ["Google Analytics", /gtag\(|google-analytics|googletagmanager/],
    ["Meta Pixel", /fbevents\.js|connect\.facebook\.net\/.*\/fbevents/],
    ["Stripe", /js\.stripe\.com|stripe\.com\/v3/],
    ["Calendly", /assets\.calendly\.com|calendly\.com\/.*\?/],
    ["Intercom", /widget\.intercom\.io/],
    ["Drift", /js\.driftt\.com/],
    ["Tailwind CSS", /tailwindcss|tw-/],
    ["Framer", /framer\.com|framerstatic/],
    ["Bubble.io", /bubble\.io|bubble-cdn/],
    ["Cloudflare", /cloudflare|cf-/],
    ["Vercel", /vercel\.app|_vercel/],
    ["Netlify", /netlify\.app/],
    ["Squarespace Commerce", /squarespace.*commerce/],
    ["Salesforce", /salesforce\.com|force\.com/],
    ["Zoho", /zoho\.com/],
  ];
  for (const [name, re] of tests) {
    if (typeof re === "string") {
      if (h.includes(re)) stack.add(name);
    } else if (re.test(h)) stack.add(name);
  }
  const server = headers.get("server")?.toLowerCase() ?? "";
  if (server.includes("cloudflare")) stack.add("Cloudflare");
  if (server.includes("nginx")) stack.add("Nginx");
  if (server.includes("apache")) stack.add("Apache");
  const xPowered = headers.get("x-powered-by")?.toLowerCase() ?? "";
  if (xPowered.includes("next.js")) stack.add("Next.js");
  if (xPowered.includes("express")) stack.add("Express.js");
  return Array.from(stack);
}

function extractSocialLinks(html: string): EnrichmentResult["social_links"] {
  const $ = cheerio.load(html);
  const links: NonNullable<EnrichmentResult["social_links"]> = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    if (!href.startsWith("http")) return;
    if (!links.twitter && /(twitter\.com|x\.com)\/[A-Za-z0-9_]+/.test(href) && !/intent|share/.test(href)) links.twitter = href;
    if (!links.linkedin && /linkedin\.com\/(company|in)\//.test(href)) links.linkedin = href;
    if (!links.facebook && /facebook\.com\/[A-Za-z0-9.]+/.test(href) && !/sharer|share\.php/.test(href)) links.facebook = href;
    if (!links.instagram && /instagram\.com\/[A-Za-z0-9_.]+/.test(href)) links.instagram = href;
    if (!links.youtube && /(youtube\.com\/(channel|c|user|@)|youtu\.be)/.test(href)) links.youtube = href;
    if (!links.github && /github\.com\/[A-Za-z0-9-]+/.test(href)) links.github = href;
    if (!links.tiktok && /tiktok\.com\/@[A-Za-z0-9_.]+/.test(href)) links.tiktok = href;
  });
  return Object.keys(links).length > 0 ? links : undefined;
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

/**
 * Main enrichment entry point.
 *
 * Tries hard to produce contact info even when the source signal is thin.
 */
export async function enrichLead(input: {
  website?: string | null;
  source_url?: string | null;
  company_name?: string | null;
  person_name?: string | null;
  location?: string | null;
}): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {};

  // STEP 1: Resolve website if we don't have one
  let websiteUrl: string | null = input.website ?? null;
  if (!websiteUrl && input.source_url) {
    const d = urlToDomain(input.source_url);
    const skipDomains = [
      "reddit.com",
      "twitter.com",
      "x.com",
      "bsky.app",
      "news.ycombinator.com",
      "dev.to",
      "lobste.rs",
      "github.com",
      "linkedin.com",
      "google.com",
      "news.google.com",
      "producthunt.com",
      "indeed.com",
      "indiehackers.com",
      "opencorporates.com",
      "ycombinator.com",
    ];
    if (d && !skipDomains.some((s) => d.endsWith(s))) {
      websiteUrl = input.source_url;
    }
  }

  // If still no website and we have a company name, try to RESOLVE one
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

  // STEP 2: Scrape homepage
  const home = await fetchHtml(websiteUrl);
  let homepageText: string | null = null;
  if (home) {
    const $ = cheerio.load(home.html);
    result.homepage_title = $("title").first().text().trim() || null;
    result.homepage_description =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;
    $("script, style, noscript, svg").remove();
    homepageText = $("body").text().replace(/\s+/g, " ").trim();
    result.homepage_text = homepageText.slice(0, 5000);
    result.social_links = extractSocialLinks(home.html);
    result.tech_stack_hints = detectTechStack(home.html, home.headers);
    result.has_pricing_page = /href="[^"]*\/(pricing|plans)"/i.test(home.html);
    result.has_blog = /href="[^"]*\/(blog|news)"/i.test(home.html);

    // Detect team-size hints
    if (/\b(solo|founder|1-person|one[- ]person)\b/i.test(homepageText))
      result.company_size_hint = "solo/founder";
    else if (/\b(team of \d+|we are \d+|\d+\+? employees)\b/i.test(homepageText)) {
      const m = homepageText.match(/\b(team of \d+|we are \d+|\d+\+? employees)\b/i);
      result.company_size_hint = m?.[0] ?? null;
    }

    result.appears_active =
      homepageText.length > 200 &&
      !/\b(under construction|coming soon|placeholder|domain for sale)\b/i.test(homepageText);
  }

  // STEP 3: Active contact discovery (scrapes /contact, /about, etc + pattern guesses)
  const contacts: FoundContacts = await findContacts({
    websiteUrl,
    personName: input.person_name,
    scrapedText: homepageText,
  });

  if (contacts.emails.length > 0) {
    result.contact_emails = contacts.emails.map((e) => e.email);
    const verified = contacts.emails.find((e) => e.confidence === "verified");
    result.best_email = verified?.email ?? contacts.best_email;
    result.email_confidence = verified
      ? "verified"
      : contacts.emails.find((e) => e.confidence === "probable")
      ? "probable"
      : "guess";
  }
  if (contacts.phones.length > 0) {
    result.contact_phones = contacts.phones;
    result.best_phone = contacts.best_phone;
  }

  // STEP 4: Domain age via Wayback (no API key)
  if (result.domain) {
    result.domain_age_estimate = await estimateDomainAge(result.domain);
  }

  return result;
}
