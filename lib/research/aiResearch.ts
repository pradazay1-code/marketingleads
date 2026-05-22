import * as cheerio from "cheerio";
import type { Lead } from "../types";

/**
 * AI research provider — FREE alternatives to Anthropic Claude.
 *
 * Default: Google Gemini 2.0 Flash
 *   - Free tier: 1,500 requests/day, 15 RPM, 1M TPM
 *   - More than enough for our ~60-90 research calls/day
 *   - Sign up at https://aistudio.google.com/apikey (no credit card needed)
 *
 * Fallback: Groq (Llama 3.3 70B)
 *   - Also free, very fast
 *   - Sign up at https://console.groq.com (no credit card needed)
 *
 * Set AI_PROVIDER=gemini (default) or AI_PROVIDER=groq in env.
 */

const PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export interface ResearchOutput {
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

OUTPUT FORMAT:
You must return ONLY valid JSON matching this exact schema:
{
  "company_name": string or null,
  "person_name": string or null,
  "website": string or null,
  "industry": string or null,
  "company_size": string or null,
  "location": string or null,
  "state": string or null (2-letter US state code if known, else null),
  "summary": string (2-4 sentences),
  "pain_points": string[],
  "buying_signals": string[],
  "recommended_services": string[],
  "outreach_angle": string (one-sentence personalized opening),
  "lead_score": number (0-100),
  "score_breakdown": {
    "intent_strength": number (0-20),
    "budget_indicators": number (0-20),
    "decision_maker_likely": number (0-20),
    "fit_with_aventis": number (0-20),
    "east_coast_bonus": number (0-20),
    "reasoning": string
  },
  "red_flags": string[],
  "enrichment": {
    "email_guesses": string[],
    "linkedin_guess": string or null,
    "domain_age_estimate": string or null
  }
}`;

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
    return $("body").text().replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return null;
  }
}

function buildUserMessage(lead: Lead, webContext: string | null): string {
  return `LEAD SIGNAL:
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

Return ONLY the JSON object — no markdown fences, no commentary.`;
}

// -----------------------------------
// Provider: Google Gemini (free)
// -----------------------------------
async function researchViaGemini(lead: Lead, webContext: string | null): Promise<ResearchOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const userMessage = buildUserMessage(lead, webContext);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 2500,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text");
  return parseAndValidate(text);
}

// -----------------------------------
// Provider: Groq (free, very fast)
// -----------------------------------
async function researchViaGroq(lead: Lead, webContext: string | null): Promise<ResearchOutput> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const userMessage = buildUserMessage(lead, webContext);
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return parseAndValidate(text);
}

function parseAndValidate(raw: string): ResearchOutput {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  let parsed: ResearchOutput;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[aiResearch] JSON parse failed. Raw:", raw.slice(0, 400));
    throw new Error(`AI returned invalid JSON: ${err}`);
  }
  parsed.pain_points ??= [];
  parsed.buying_signals ??= [];
  parsed.recommended_services ??= [];
  parsed.red_flags ??= [];
  parsed.enrichment ??= { email_guesses: [], linkedin_guess: null, domain_age_estimate: null };
  if (typeof parsed.lead_score !== "number") parsed.lead_score = 0;
  parsed.lead_score = Math.max(0, Math.min(100, Math.round(parsed.lead_score)));
  return parsed;
}

/**
 * Main entry point — performs deep research on a lead.
 * Picks provider based on AI_PROVIDER env var. Falls back to the other if primary fails.
 */
export async function researchLead(lead: Lead): Promise<ResearchOutput> {
  const webContext = lead.website
    ? await tryFetchWebContext(lead.website)
    : lead.source_url
    ? await tryFetchWebContext(lead.source_url)
    : null;

  const primary = PROVIDER === "groq" ? researchViaGroq : researchViaGemini;
  const fallback = PROVIDER === "groq" ? researchViaGemini : researchViaGroq;

  try {
    return await primary(lead, webContext);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Only attempt fallback if the other provider is actually configured
    const fallbackKey =
      PROVIDER === "groq" ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
    if (!fallbackKey) throw err;
    console.warn(`[aiResearch] primary (${PROVIDER}) failed: ${msg} — trying fallback`);
    return await fallback(lead, webContext);
  }
}
