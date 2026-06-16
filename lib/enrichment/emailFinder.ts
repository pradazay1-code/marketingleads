/**
 * Email finder — combination of scraping + smart pattern generation.
 *
 * Strategy:
 *   1. Scrape the website's contact page, footer, /about, /team
 *   2. If we have a person's name + domain, generate the 6 most-common
 *      email patterns: john@, john.doe@, jdoe@, johnd@, john_doe@, j.doe@
 *   3. Return one "best guess" + a list of probable candidates
 *
 * We DON'T verify SMTP from serverless (firewalls / IP reputation issues).
 * Pattern-guessed emails are flagged as `guess: true` so the AI prompt and
 * the UI can show them as "likely" not "verified".
 */

import * as cheerio from "cheerio";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Common contact-page paths we'll try
const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/contact.html",
  "/about",
  "/about-us",
  "/team",
  "/company",
  "/get-in-touch",
];

const COMMON_INBOX_PREFIXES = [
  "contact",
  "hello",
  "info",
  "sales",
  "support",
  "team",
  "hi",
  "founders",
];

interface EmailCandidate {
  email: string;
  confidence: "verified" | "probable" | "guess";
  source: "scraped" | "common_inbox" | "name_pattern";
}

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function looksLikeBusinessEmail(addr: string, domain?: string | null): boolean {
  const lower = addr.toLowerCase();
  // skip image filenames mistaken as emails
  if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(lower)) return false;
  // skip placeholders + spam-trap domains
  if (/(example|test|demo|placeholder|wixpress|sentry|@2x)/.test(lower)) return false;
  if (lower.includes("noreply") || lower.includes("no-reply") || lower.includes("donotreply"))
    return false;
  // Heavy bias toward emails on the company's own domain (much higher confidence)
  if (domain) {
    const at = lower.split("@")[1];
    if (at && (at === domain || at.endsWith(`.${domain}`))) return true;
    // Allow non-domain emails too, just less weight in the caller
  }
  return true;
}

function namePatternEmails(personName: string, domain: string): string[] {
  const parts = personName
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return [];
  const [first, ...rest] = parts;
  const last = rest[rest.length - 1] ?? "";
  const patterns = new Set<string>();
  if (first) patterns.add(`${first}@${domain}`);
  if (first && last) {
    patterns.add(`${first}.${last}@${domain}`);
    patterns.add(`${first[0]}${last}@${domain}`);
    patterns.add(`${first}${last[0]}@${domain}`);
    patterns.add(`${first}_${last}@${domain}`);
    patterns.add(`${first}-${last}@${domain}`);
    patterns.add(`${first[0]}.${last}@${domain}`);
  }
  return Array.from(patterns);
}

function urlToDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface FoundContacts {
  emails: EmailCandidate[];
  phones: string[];
  best_email: string | null;
  best_phone: string | null;
}

export async function findContacts(opts: {
  websiteUrl?: string | null;
  personName?: string | null;
  scrapedText?: string | null;
}): Promise<FoundContacts> {
  const { websiteUrl, personName, scrapedText } = opts;
  const out: FoundContacts = { emails: [], phones: [], best_email: null, best_phone: null };

  let domain: string | null = null;
  if (websiteUrl) domain = urlToDomain(websiteUrl);

  // 1. Extract emails + phones from already-scraped homepage text
  const textPool: string[] = [];
  if (scrapedText) textPool.push(scrapedText);

  // 2. Fetch contact pages
  if (websiteUrl) {
    const visited = new Set<string>();
    for (const path of CONTACT_PATHS) {
      try {
        const u = new URL(path, websiteUrl).toString();
        if (visited.has(u)) continue;
        visited.add(u);
        const html = await fetchHtml(u, 5000);
        if (!html) continue;
        const $ = cheerio.load(html);
        $("script, style, noscript, svg").remove();

        // Also look at mailto + tel links explicitly
        $("a[href^='mailto:']").each((_, el) => {
          const addr = $(el).attr("href")!.replace(/^mailto:/i, "").split("?")[0].trim();
          if (looksLikeBusinessEmail(addr, domain)) {
            out.emails.push({ email: addr, confidence: "verified", source: "scraped" });
          }
        });
        $("a[href^='tel:']").each((_, el) => {
          const num = $(el).attr("href")!.replace(/^tel:/i, "").trim();
          if (num.match(/\d{3}/)) out.phones.push(num);
        });
        textPool.push($("body").text().replace(/\s+/g, " "));
      } catch {
        // ignore individual page errors
      }
    }
  }

  // 3. Extract from the text pool
  const text = textPool.join(" ");
  const emailHits = text.match(EMAIL_REGEX) ?? [];
  for (const e of emailHits) {
    if (looksLikeBusinessEmail(e, domain)) {
      const already = out.emails.find((x) => x.email.toLowerCase() === e.toLowerCase());
      if (!already) {
        out.emails.push({ email: e, confidence: "verified", source: "scraped" });
      }
    }
  }

  // Phones (US format: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxx.xxx.xxxx)
  const phoneRe =
    /(\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  const phoneHits = text.match(phoneRe) ?? [];
  for (const p of phoneHits) {
    const normalized = p.trim();
    if (!out.phones.includes(normalized)) out.phones.push(normalized);
  }

  // 4. Add common-inbox guesses on the company's own domain
  if (domain) {
    for (const prefix of COMMON_INBOX_PREFIXES) {
      const guess = `${prefix}@${domain}`;
      if (!out.emails.find((x) => x.email.toLowerCase() === guess.toLowerCase())) {
        out.emails.push({ email: guess, confidence: "guess", source: "common_inbox" });
      }
    }
  }

  // 5. Name-pattern guesses
  if (domain && personName && personName.includes(" ")) {
    for (const guess of namePatternEmails(personName, domain)) {
      if (!out.emails.find((x) => x.email.toLowerCase() === guess.toLowerCase())) {
        out.emails.push({ email: guess, confidence: "guess", source: "name_pattern" });
      }
    }
  }

  // Best email: prefer verified > probable > guess
  const verified = out.emails.find((e) => e.confidence === "verified");
  const guess = out.emails.find((e) => e.confidence === "guess");
  out.best_email = verified?.email ?? guess?.email ?? null;
  out.best_phone = out.phones[0] ?? null;

  // Trim to reasonable lengths
  out.emails = out.emails.slice(0, 10);
  out.phones = out.phones.slice(0, 5);

  return out;
}
