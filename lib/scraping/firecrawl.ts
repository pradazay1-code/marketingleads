/**
 * Firecrawl client — professional-grade scraping that handles JavaScript,
 * anti-bot protection, and structured extraction.
 *
 * Why this matters for lead quality:
 *   - Many small-business sites are Wix/Squarespace/GoDaddy SPAs where the
 *     phone number and email are rendered by JS. Cheerio sees an empty div.
 *     Firecrawl runs a real browser and gets the actual content.
 *   - The /extract endpoint takes a JSON schema and returns typed data,
 *     so we get {email, phone, owner_name, services} instead of raw text.
 *   - The /search endpoint finds prospects across the web without needing
 *     a separate Google Custom Search key.
 *
 * Set FIRECRAWL_API_KEY. Falls back to cheerio scraping when unset or on error.
 * Docs: https://docs.firecrawl.dev
 */

const API_BASE = "https://api.firecrawl.dev/v1";

function apiKey(): string | null {
  return process.env.FIRECRAWL_API_KEY ?? null;
}

export function isFirecrawlEnabled(): boolean {
  return !!apiKey();
}

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    rawHtml?: string;
    json?: Record<string, unknown>;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      statusCode?: number;
      ogTitle?: string;
      ogDescription?: string;
    };
    links?: string[];
  };
  error?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data?: Array<{
    url: string;
    title?: string;
    description?: string;
    markdown?: string;
  }>;
  error?: string;
}

async function firecrawlFetch<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 45_000
): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[firecrawl] ${path} → ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(
      `[firecrawl] ${path} failed:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * Scrape a single URL, returning clean markdown + metadata.
 * Much more reliable than raw fetch + cheerio for JS-heavy small-business sites.
 */
export async function firecrawlScrape(
  url: string,
  opts: { onlyMainContent?: boolean; includeLinks?: boolean } = {}
): Promise<{
  markdown: string | null;
  title: string | null;
  description: string | null;
  links: string[];
  html: string | null;
} | null> {
  const res = await firecrawlFetch<FirecrawlScrapeResponse>("/scrape", {
    url,
    formats: opts.includeLinks ? ["markdown", "links", "html"] : ["markdown", "html"],
    onlyMainContent: opts.onlyMainContent ?? false,
    timeout: 30000,
    blockAds: true,
    removeBase64Images: true,
  });
  if (!res?.success || !res.data) return null;
  return {
    markdown: res.data.markdown ?? null,
    title: res.data.metadata?.title ?? res.data.metadata?.ogTitle ?? null,
    description:
      res.data.metadata?.description ?? res.data.metadata?.ogDescription ?? null,
    links: res.data.links ?? [],
    html: res.data.html ?? res.data.rawHtml ?? null,
  };
}

/**
 * Structured extraction — hand Firecrawl a JSON schema and it returns
 * typed data pulled from the page. This is how we reliably get contact
 * info out of sites where it's buried in JS or images-as-text.
 */
export interface BusinessExtraction {
  business_name?: string | null;
  owner_or_contact_name?: string | null;
  email?: string | null;
  all_emails?: string[];
  phone?: string | null;
  all_phones?: string[];
  address?: string | null;
  city?: string | null;
  state?: string | null;
  services_offered?: string[];
  service_area?: string | null;
  years_in_business?: string | null;
  team_size?: string | null;
  social_links?: string[];
  has_online_booking?: boolean | null;
  uses_lead_marketplace?: boolean | null;
  notable_details?: string | null;
}

const BUSINESS_SCHEMA = {
  type: "object",
  properties: {
    business_name: { type: "string", description: "The legal or trading name of the business" },
    owner_or_contact_name: {
      type: "string",
      description: "Name of the owner, founder, principal agent, or main contact person",
    },
    email: { type: "string", description: "Primary contact email address" },
    all_emails: {
      type: "array",
      items: { type: "string" },
      description: "Every email address found anywhere on the page",
    },
    phone: { type: "string", description: "Primary phone number" },
    all_phones: {
      type: "array",
      items: { type: "string" },
      description: "Every phone number found anywhere on the page",
    },
    address: { type: "string", description: "Full street address if listed" },
    city: { type: "string" },
    state: { type: "string", description: "Two-letter US state code" },
    services_offered: {
      type: "array",
      items: { type: "string" },
      description: "List of services this business offers",
    },
    service_area: {
      type: "string",
      description: "Geographic area served (cities, counties, radius)",
    },
    years_in_business: { type: "string" },
    team_size: { type: "string", description: "Number of employees or crew size if mentioned" },
    social_links: {
      type: "array",
      items: { type: "string" },
      description: "URLs to social media profiles",
    },
    has_online_booking: {
      type: "boolean",
      description: "True if the site has online scheduling/booking/quote-request forms",
    },
    uses_lead_marketplace: {
      type: "boolean",
      description:
        "True if the site shows badges from Angi, HomeAdvisor, Thumbtack, Zillow, Realtor.com, or similar lead marketplaces",
    },
    notable_details: {
      type: "string",
      description: "Anything else useful for a sales conversation (recent expansion, awards, pain signals)",
    },
  },
} as const;

export async function firecrawlExtractBusiness(
  url: string
): Promise<BusinessExtraction | null> {
  const res = await firecrawlFetch<FirecrawlScrapeResponse>("/scrape", {
    url,
    formats: ["json"],
    jsonOptions: {
      schema: BUSINESS_SCHEMA,
      prompt:
        "Extract business contact and profile information. Find EVERY email address and phone number on the page, including ones inside footers, contact forms, and 'tel:'/'mailto:' links. If the business shows badges from lead marketplaces like Angi, HomeAdvisor, Thumbtack, Zillow, or Realtor.com, set uses_lead_marketplace to true.",
    },
    onlyMainContent: false,
    timeout: 30000,
  });
  if (!res?.success || !res.data?.json) return null;
  return res.data.json as BusinessExtraction;
}

/**
 * Web search via Firecrawl — returns results WITH page content already
 * scraped, so one call gives us both discovery and enrichment.
 */
export async function firecrawlSearch(
  query: string,
  opts: { limit?: number; scrapeResults?: boolean } = {}
): Promise<Array<{ url: string; title: string; description: string; markdown: string | null }>> {
  const body: Record<string, unknown> = {
    query,
    limit: opts.limit ?? 10,
  };
  if (opts.scrapeResults) {
    body.scrapeOptions = { formats: ["markdown"], onlyMainContent: true };
  }
  const res = await firecrawlFetch<FirecrawlSearchResponse>("/search", body, 60_000);
  if (!res?.success || !res.data) return [];
  return res.data.map((r) => ({
    url: r.url,
    title: r.title ?? "",
    description: r.description ?? "",
    markdown: r.markdown ?? null,
  }));
}

/**
 * Simple in-memory cache so a single cycle doesn't scrape the same URL twice.
 * (Serverless functions are short-lived, so this resets per invocation — which
 * is exactly the scope we want.)
 */
const scrapeCache = new Map<string, unknown>();

export async function cachedExtractBusiness(
  url: string
): Promise<BusinessExtraction | null> {
  const key = `extract:${url}`;
  if (scrapeCache.has(key)) return scrapeCache.get(key) as BusinessExtraction | null;
  const result = await firecrawlExtractBusiness(url);
  scrapeCache.set(key, result);
  return result;
}
