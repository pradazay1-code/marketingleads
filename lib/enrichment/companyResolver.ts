/**
 * Company resolver — given partial signals (company name, person name,
 * location), try to find the company's real website + LinkedIn page.
 *
 * Strategy (in order of preference):
 *   1. If Google Custom Search is configured, query for "company-name site"
 *   2. Try direct domain guess: companyname.com / co / io
 *   3. Try DuckDuckGo lite search (no auth, but lower quality)
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface GoogleResponse {
  items?: GoogleResult[];
}

const NON_BUSINESS_DOMAINS = new Set([
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "yelp.com",
  "tripadvisor.com",
  "google.com",
  "bing.com",
  "reddit.com",
  "wikipedia.org",
  "indeed.com",
  "glassdoor.com",
  "bbb.org",
  "ziprecruiter.com",
  "monster.com",
  "angi.com",
  "homeadvisor.com",
  "thumbtack.com",
  "zillow.com",
  "realtor.com",
  "trulia.com",
  "redfin.com",
  "1800gotjunk.com",
]);

function tldDomain(host: string): string {
  return host.replace(/^www\./, "");
}

function looksLikeBusinessSite(url: string): boolean {
  try {
    const host = tldDomain(new URL(url).hostname);
    if (NON_BUSINESS_DOMAINS.has(host)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function resolveCompanyWebsite(opts: {
  companyName?: string | null;
  location?: string | null;
}): Promise<{ website: string | null; linkedin: string | null }> {
  const { companyName, location } = opts;
  if (!companyName || companyName.trim().length < 2) {
    return { website: null, linkedin: null };
  }

  // Strategy 1: Google Custom Search
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  let website: string | null = null;
  let linkedin: string | null = null;

  if (apiKey && cseId) {
    const q = location ? `"${companyName}" ${location}` : `"${companyName}"`;
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(q)}&num=8`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = (await res.json()) as GoogleResponse;
        for (const item of data.items ?? []) {
          if (!linkedin && /linkedin\.com\/company\//i.test(item.link)) {
            linkedin = item.link;
          }
          if (!website && looksLikeBusinessSite(item.link)) {
            website = `https://${tldDomain(new URL(item.link).hostname)}`;
          }
          if (website && linkedin) break;
        }
      }
    } catch {
      // fall through
    }
  }

  // Strategy 2: direct domain guess if name is one word
  if (!website && companyName) {
    const slug = companyName
      .toLowerCase()
      .replace(/\b(llc|inc|corp|co|the|&|and|ltd|company)\b/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
    if (slug.length >= 3 && slug.length <= 20) {
      const candidates = [`https://${slug}.com`, `https://${slug}.co`, `https://${slug}.io`, `https://www.${slug}.com`];
      for (const c of candidates) {
        try {
          const res = await fetch(c, {
            method: "HEAD",
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(4000),
            redirect: "follow",
          });
          if (res.ok || res.status === 405 /* HEAD not allowed but exists */) {
            website = c;
            break;
          }
        } catch {
          // continue
        }
      }
    }
  }

  return { website, linkedin };
}
