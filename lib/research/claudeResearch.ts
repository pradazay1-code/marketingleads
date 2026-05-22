import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import type { Lead } from "../types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

let client: Anthropic | null = null;
function anth(): Anthropic {
  if (!client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey: key });
  }
  return client;
}

interface ResearchOutput {
  company_name: string | null;
  person_name: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  state: string | null;
  summary: string;
  pain_points: string[];
  buying_signals: string[];
  recommended_services: string[];
  outreach_angle: string;
  lead_score: number;
  score_breakdown: {
    intent_strength: number;
    budget_indicators: number;
    decision_maker_likely: number;
    fit_with_aventis: number;
    east_coast_bonus: number;
    reasoning: string;
  };
  red_flags: string[];
  enrichment: {
    email_guesses: string[];
    linkedin_guess: string | null;
    domain_age_estimate: string | null;
  };
}

const SYSTEM_PROMPT = `You are the autonomous lead-qualification engine for Aventis Marketing and AventisAI, run by Isaiah Wright.

ABOUT AVENTIS — what we sell:
- White-label marketing software (CRM, automation, AI chat, lead capture) — agencies & SMBs rebrand it as their own
- White-label AI tools (chatbots, content gen, voice agents) under the AventisAI brand
- Done-for-you marketing services (paid ads, SEO, email, web)
- Strategic marketing consulting for growth-stage businesses

YOUR JOB:
Given a raw lead signal (a Reddit post, tweet, job posting, business registration, etc.), produce a high-quality structured assessment so Isaiah can decide whether to spend time on this lead.

QUALIFICATION RULES:
1. The BEST leads explicitly say they need marketing help OR are agencies that could resell our white-label
2. East Coast US is preferred — give a bonus
3. New businesses (< 6 months old) with a registered address are good leads
4. Job postings for marketing roles indicate hiring budget — score them well
5. Anyone complaining about a past agency is a top-tier lead (motivated, has budget history)
6. Founders launching products on ProductHunt/Show HN may want growth services
7. Avoid: minors, ghost accounts, obvious lead-gen spammers, competitors, jokes/memes

SCORING (each 0-20, sum to lead_score 0-100):
- intent_strength: how clearly they expressed need (0=guess, 20=explicitly asking for our service)
- budget_indicators: do they have money (paying agencies before, hiring, funded, profitable)
- decision_maker_likely: are they the buyer (founder/owner = high, intern = low)
- fit_with_aventis: do our services solve their stated need
- east_coast_bonus: 20 if on East Coast US (ME→FL plus PA, NJ, DC), 10 if elsewhere US, 0 if international

OUTPUT: Return ONLY a single valid JSON object matching the schema. No prose, no markdown.`;

async function tryFetchWebContext(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, noscript, svg").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

/**
 * Performs deep research on a lead using Claude + light web enrichment.
 */
export async function researchLead(lead: Lead): Promise<ResearchOutput> {
  const webContext = lead.website
    ? await tryFetchWebContext(lead.website)
    : lead.source_url
    ? await tryFetchWebContext(lead.source_url)
    : null;

  const userMessage = `LEAD SIGNAL:
Source: ${lead.source}
Source URL: ${lead.source_url ?? "N/A"}
Posted at: ${lead.source_post_at ?? "N/A"}

Person/handle: ${lead.person_name ?? "unknown"}
Company guess: ${lead.company_name ?? "unknown"}
Location hint: ${lead.location ?? "unknown"}
Matched keywords: ${(lead.matched_keywords ?? []).join(", ")}
Intent category: ${lead.intent_category ?? "unknown"}
Intent snippet: ${lead.intent_signal ?? ""}

RAW POST / SIGNAL CONTENT:
${lead.source_post_content ?? "(none)"}

${webContext ? `\nEXTRA WEB CONTEXT (scraped from URL):\n${webContext}\n` : ""}

Produce the structured JSON assessment per the system prompt. Output ONLY the JSON object — no markdown fences, no commentary.`;

  const resp = await anth().messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = resp.content.find((c) => c.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  const raw = block.text.trim();
  // Strip optional code fences if Claude added them
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ResearchOutput;
    // sanity defaults
    parsed.pain_points ??= [];
    parsed.buying_signals ??= [];
    parsed.recommended_services ??= [];
    parsed.red_flags ??= [];
    parsed.enrichment ??= { email_guesses: [], linkedin_guess: null, domain_age_estimate: null };
    if (typeof parsed.lead_score !== "number") parsed.lead_score = 0;
    parsed.lead_score = Math.max(0, Math.min(100, Math.round(parsed.lead_score)));
    return parsed;
  } catch (err) {
    console.error("[research] JSON parse failed. Raw:", raw.slice(0, 400));
    throw new Error(`Claude returned invalid JSON: ${err}`);
  }
}
