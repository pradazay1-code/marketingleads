import type { Lead } from "../types";
import { enrichLead, type EnrichmentResult } from "./enrichment";

/**
 * Multi-pass AI research using FREE providers:
 *   1. Enrichment (web scrape, domain age, tech stack, socials, emails)
 *   2. AI analysis (Gemini default, Groq fallback)
 *
 * The enrichment step gives the AI much more to work with than just the
 * original post — it can now reference the company's actual website copy,
 * tech stack, team size hints, and contact info.
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
  outreach_email_draft: string;
  outreach_dm_draft: string;
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
    tech_stack: string[];
    social_links: Record<string, string>;
  };
  next_actions: string[];
}

const SYSTEM_PROMPT = `You are the autonomous lead-qualification engine for Aventis Marketing and AventisAI, run by Isaiah Wright.

ABOUT AVENTIS — what we sell:
- White-label marketing software (CRM, automation, AI chat, lead capture) — agencies & SMBs rebrand it as their own
- White-label AI tools (chatbots, content gen, voice agents) under the AventisAI brand
- Done-for-you marketing services (paid ads, SEO, email, web)
- Strategic marketing consulting for growth-stage businesses

YOUR JOB:
Given a raw lead signal PLUS enrichment data (their website, tech stack, contact info, domain age), produce a DEEP structured assessment Isaiah can act on immediately.

QUALIFICATION RULES:
1. Best leads explicitly say they need marketing help OR are agencies that could resell our white-label
2. East Coast US preferred — give a bonus
3. New businesses (< 6 months old) with a registered address are strong leads
4. Job postings for marketing roles indicate hiring budget — score them well
5. Anyone complaining about a past agency is a top-tier lead (motivated, has budget history)
6. Founders launching products on ProductHunt/Show HN/Bluesky may want growth services
7. If their tech stack shows Wix/Squarespace/Webflow + no marketing tools = perfect white-label SaaS target
8. If they're using HubSpot/competing CRMs already, our white-label is less compelling — focus on services
9. Avoid: minors, ghost accounts, lead-gen spammers, our competitors, jokes/memes
10. New domain (< 1 year per Wayback) + active site = launching, needs marketing
11. Old domain + outdated site = may want a refresh

SCORING (each 0-20, sum to lead_score 0-100):
- intent_strength: how clearly they expressed need (0=guess, 20=explicitly asking for our service)
- budget_indicators: do they have money (paid agencies before, hiring, funded, profitable, paying for tools)
- decision_maker_likely: are they the buyer (founder/owner = high, intern = low)
- fit_with_aventis: do our services solve their stated need (consider their current tech stack)
- east_coast_bonus: 20 if East Coast US (ME→FL plus PA, NJ, DC), 10 if elsewhere US, 0 if international

OUTREACH:
- outreach_angle: one-sentence personalized opening (specific to their actual situation)
- outreach_email_draft: 3-4 sentence cold email referencing something specific from their site/post
- outreach_dm_draft: 2-sentence DM/short message for Reddit/Twitter/LinkedIn
- next_actions: 2-4 concrete next steps Isaiah should take

OUTPUT FORMAT — return ONLY valid JSON matching this exact schema, no markdown fences, no commentary:
{
  "company_name": string or null,
  "person_name": string or null,
  "website": string or null,
  "industry": string or null,
  "company_size": string or null,
  "location": string or null,
  "state": string or null (2-letter US code if known),
  "summary": string (3-5 sentences explaining what the company does and why they're a lead),
  "pain_points": string[],
  "buying_signals": string[],
  "recommended_services": string[] (which Aventis offerings fit),
  "outreach_angle": string,
  "outreach_email_draft": string,
  "outreach_dm_draft": string,
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
    "domain_age_estimate": string or null,
    "tech_stack": string[],
    "social_links": object (key: platform, value: url)
  },
  "next_actions": string[]
}`;

function buildUserMessage(lead: Lead, enrichment: EnrichmentResult): string {
  const parts: string[] = [];
  parts.push("LEAD SIGNAL:");
  parts.push(`Source: ${lead.source}`);
  parts.push(`Source URL: ${lead.source_url ?? "N/A"}`);
  parts.push(`Posted at: ${lead.source_post_at ?? "N/A"}`);
  parts.push(`Person/handle: ${lead.person_name ?? "unknown"}`);
  parts.push(`Company guess: ${lead.company_name ?? "unknown"}`);
  parts.push(`Location hint: ${lead.location ?? "unknown"}`);
  parts.push(`Matched keywords: ${(lead.matched_keywords ?? []).join(", ")}`);
  parts.push(`Intent category: ${lead.intent_category ?? "unknown"}`);
  parts.push(`Intent snippet: ${lead.intent_signal ?? ""}`);
  parts.push("");
  parts.push("RAW POST / SIGNAL CONTENT:");
  parts.push(lead.source_post_content ?? "(none)");

  // Enrichment data
  if (enrichment.website) {
    parts.push("");
    parts.push("=== WEB ENRICHMENT (gathered automatically before this prompt) ===");
    parts.push(`Website: ${enrichment.website}`);
    if (enrichment.domain) parts.push(`Domain: ${enrichment.domain}`);
    if (enrichment.domain_age_estimate)
      parts.push(`Domain age: ${enrichment.domain_age_estimate}`);
    if (enrichment.homepage_title)
      parts.push(`Homepage <title>: ${enrichment.homepage_title}`);
    if (enrichment.homepage_description)
      parts.push(`Meta description: ${enrichment.homepage_description}`);
    if (enrichment.company_size_hint)
      parts.push(`Team size hint: ${enrichment.company_size_hint}`);
    if (enrichment.tech_stack_hints?.length)
      parts.push(`Tech stack detected: ${enrichment.tech_stack_hints.join(", ")}`);
    if (enrichment.has_pricing_page) parts.push(`Has pricing page: yes`);
    if (enrichment.has_blog) parts.push(`Has blog: yes`);
    if (enrichment.contact_emails?.length)
      parts.push(`Contact emails found: ${enrichment.contact_emails.join(", ")}`);
    if (enrichment.social_links && Object.keys(enrichment.social_links).length) {
      parts.push("Social links:");
      for (const [k, v] of Object.entries(enrichment.social_links)) {
        parts.push(`  - ${k}: ${v}`);
      }
    }
    if (enrichment.homepage_text) {
      parts.push("");
      parts.push("HOMEPAGE TEXT (excerpt):");
      parts.push(enrichment.homepage_text);
    }
    if (enrichment.about_text) {
      parts.push("");
      parts.push("ABOUT PAGE TEXT (excerpt):");
      parts.push(enrichment.about_text);
    }
  }

  parts.push("");
  parts.push("Produce the structured JSON assessment per the system prompt. Output ONLY the JSON object.");
  return parts.join("\n");
}

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 4000,
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
  return text;
}

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no text");
  return text;
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
  parsed.next_actions ??= [];
  parsed.outreach_email_draft ??= "";
  parsed.outreach_dm_draft ??= "";
  parsed.enrichment ??= {
    email_guesses: [],
    linkedin_guess: null,
    domain_age_estimate: null,
    tech_stack: [],
    social_links: {},
  };
  parsed.enrichment.tech_stack ??= [];
  parsed.enrichment.social_links ??= {};
  parsed.enrichment.email_guesses ??= [];
  if (typeof parsed.lead_score !== "number") parsed.lead_score = 0;
  parsed.lead_score = Math.max(0, Math.min(100, Math.round(parsed.lead_score)));
  return parsed;
}

export async function researchLead(lead: Lead): Promise<ResearchOutput> {
  // Step 1: enrich with public web data
  const enrichment = await enrichLead({
    website: lead.website,
    source_url: lead.source_url,
  });

  // Step 2: AI analysis with provider failover
  const userMessage = buildUserMessage(lead, enrichment);
  const primary = PROVIDER === "groq" ? callGroq : callGemini;
  const fallback = PROVIDER === "groq" ? callGemini : callGroq;
  const fallbackConfigured =
    PROVIDER === "groq" ? !!process.env.GEMINI_API_KEY : !!process.env.GROQ_API_KEY;

  let text: string;
  try {
    text = await primary(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!fallbackConfigured) throw err;
    console.warn(`[aiResearch] primary (${PROVIDER}) failed: ${msg} — trying fallback`);
    text = await fallback(SYSTEM_PROMPT, userMessage);
  }

  const out = parseAndValidate(text);

  // Merge our scraped enrichment into the AI output so we never lose
  // verified data even if the AI hallucinates around it
  if (enrichment.website) out.website ??= enrichment.website;
  if (enrichment.tech_stack_hints?.length) {
    out.enrichment.tech_stack = enrichment.tech_stack_hints;
  }
  if (enrichment.social_links) {
    out.enrichment.social_links = {
      ...enrichment.social_links,
      ...(out.enrichment.social_links ?? {}),
    };
  }
  if (enrichment.contact_emails?.length) {
    const merged = new Set([
      ...enrichment.contact_emails,
      ...(out.enrichment.email_guesses ?? []),
    ]);
    out.enrichment.email_guesses = Array.from(merged).slice(0, 8);
  }
  if (enrichment.domain_age_estimate) {
    out.enrichment.domain_age_estimate = enrichment.domain_age_estimate;
  }

  return out;
}
