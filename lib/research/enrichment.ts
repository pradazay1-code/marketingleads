import * as cheerio from "cheerio";

/**
 * Enrichment layer — gathers additional public-data signals about a lead
 * BEFORE handing the bundle to the AI for analysis. Each step is best-effort:
 * if a step fails, we continue with whatever else we have.
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
  social_links?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    github?: string;
  };
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

function extractEmails(text: string): string[] {
  const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const found = text.match(re) ?? [];
  return Array.from(
    new Set(
      found.filter((e) => {
        const lower = e.toLowerCase();
        // skip obvious non-contact emails
        return (
          !lower.endsWith(".png") &&
          !lower.endsWith(".jpg") &&
          !lower.includes("example.com") &&
          !lower.includes("sentry.io") &&
          !lower.includes("@2x") &&
          !lower.includes("wixpress")
        );
      })
    )
  ).slice(0, 5);
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
    ["AWS", /amazonaws\.com/],
    ["Vercel", /vercel\.app|_vercel/],
    ["Netlify", /netlify\.app/],
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
  return Array.from(stack);
}

function extractSocialLinks(html: string): EnrichmentResult["social_links"] {
  const $ = cheerio.load(html);
  const links: NonNullable<EnrichmentResult["social_links"]> = {};
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").toLowerCase();
    if (!href.startsWith("http")) return;
    if (!links.twitter && /(twitter\.com|x\.com)\/[A-Za-z0-9_]+/.test(href)) links.twitter = href;
    if (!links.linkedin && /linkedin\.com\/(company|in)\//.test(href)) links.linkedin = href;
    if (!links.facebook && /facebook\.com\/[A-Za-z0-9.]+/.test(href)) links.facebook = href;
    if (!links.instagram && /instagram\.com\/[A-Za-z0-9_.]+/.test(href)) links.instagram = href;
    if (!links.youtube && /(youtube\.com\/(channel|c|user)|youtu\.be)/.test(href)) links.youtube = href;
    if (!links.github && /github\.com\/[A-Za-z0-9-]+/.test(href)) links.github = href;
  });
  return Object.keys(links).length > 0 ? links : undefined;
}

async function estimateDomainAge(domain: string): Promise<string | null> {
  // Web Archive Wayback machine has a free no-auth API to find first capture
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

export async function enrichLead(input: {
  website?: string | null;
  source_url?: string | null;
}): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {};

  let websiteUrl = input.website;
  if (!websiteUrl && input.source_url) {
    // Use source_url only if it looks like a business site (not reddit/twitter/etc)
    const d = urlToDomain(input.source_url);
    const skipDomains = ["reddit.com", "twitter.com", "x.com", "bsky.app", "news.ycombinator.com", "dev.to", "lobste.rs", "github.com", "linkedin.com"];
    if (d && !skipDomains.some((s) => d.endsWith(s))) {
      websiteUrl = input.source_url;
    }
  }

  if (!websiteUrl) return result;

  result.website = websiteUrl;
  result.domain = urlToDomain(websiteUrl);

  // Fetch homepage
  const home = await fetchHtml(websiteUrl);
  if (home) {
    const $ = cheerio.load(home.html);
    result.homepage_title = $("title").first().text().trim() || null;
    result.homepage_description =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null;
    $("script, style, noscript, svg").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    result.homepage_text = text.slice(0, 5000);
    result.contact_emails = extractEmails(text);
    result.social_links = extractSocialLinks(home.html);
    result.tech_stack_hints = detectTechStack(home.html, home.headers);
    result.has_pricing_page = /href="[^"]*\/(pricing|plans)"/i.test(home.html);
    result.has_blog = /href="[^"]*\/(blog|news)"/i.test(home.html);

    // Detect team-size hints
    if (/\b(solo|founder|1-person|one[- ]person)\b/i.test(text)) result.company_size_hint = "solo/founder";
    else if (/\b(team of \d+|we are \d+|\d+\+? employees)\b/i.test(text)) {
      const m = text.match(/\b(team of \d+|we are \d+|\d+\+? employees)\b/i);
      result.company_size_hint = m?.[0] ?? null;
    }

    result.appears_active =
      text.length > 200 &&
      !/\b(under construction|coming soon|placeholder)\b/i.test(text);
  }

  // Try to fetch /about
  if (websiteUrl && home) {
    try {
      const aboutUrl = new URL("/about", websiteUrl).toString();
      const about = await fetchHtml(aboutUrl, 5000);
      if (about) {
        const $a = cheerio.load(about.html);
        $a("script, style, noscript").remove();
        result.about_text = $a("body").text().replace(/\s+/g, " ").trim().slice(0, 3000);
      }
    } catch {
      // ignore
    }
  }

  // Domain age via Wayback (no API key)
  if (result.domain) {
    result.domain_age_estimate = await estimateDomainAge(result.domain);
  }

  return result;
}
