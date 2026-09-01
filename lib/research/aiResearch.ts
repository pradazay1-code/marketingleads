import type { Lead } from "../types";
import { enrichLead, type EnrichmentResult } from "./enrichment";
import { classifyVertical, JUNK_REMOVAL, REAL_ESTATE, type Vertical } from "../verticals";

/**
 * Multi-pass AI research using FREE providers (Gemini default, Groq fallback).
 *
 * v4: the system prompt is now hyper-specialized for junk removal and
 * real estate. The AI gets the actual economics of each vertical so its
 * outreach drafts sound like they came from someone who works in the space.
 */

const PROVIDER = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export interface ResearchOutput {
  vertical: Vertical;
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
  outreach_phone_script: string;
  estimated_monthly_value: number | null;
  lead_score: number;
  score_breakdown: {
    intent_strength: number;
    budget_indicators: number;
    decision_maker_likely: number;
    vertical_fit: number;
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

const SYSTEM_PROMPT = `You are the lead-qualification engine for Aventis Marketing and AventisAI, run by Isaiah Wright.

═══════════════════════════════════════════════════════════════
AVENTIS SELLS TO EXACTLY TWO INDUSTRIES. NOTHING ELSE.
═══════════════════════════════════════════════════════════════

### VERTICAL 1: JUNK REMOVAL & HAULING
Local operators running 1-20 trucks. Owner-operators scaling up.

THEIR ECONOMICS (know this cold — it makes outreach credible):
- Average job ticket: $200-$600. Full truckload: $500-$800.
- They buy leads from Angi/HomeAdvisor/Thumbtack at $40-90 per SHARED lead
  (the same lead is sold to 3-5 competitors — brutal close rates, ~20%).
  So their real customer-acquisition cost is $200-450 per booked job.
- 1-800-GOT-JUNK, Junk King, and College Hunks dominate brand search and
  outbid independents on Google Ads.
- Peak season is spring (March-June) plus post-holiday January. Winter is dead.
- The #1 revenue leak: missed calls. Crews are on jobs, phones go to voicemail,
  and the customer calls the next company on the list. Nobody calls back a
  voicemail in this industry.
- Reviews are THE ranking factor for the Google map pack, which is where
  most of their organic volume comes from.

WHAT AVENTIS SELLS THEM:
${JUNK_REMOVAL.offerings.map((o) => `- ${o}`).join("\n")}

TYPICAL DEAL SIZE: $1,500-$4,000/month retainer, or $800-1,500/mo for
software + lighter service.

### VERTICAL 2: REAL ESTATE
Agents, teams, brokerages, property managers, investors.

THEIR ECONOMICS:
- Average commission per closed side: $7,000-$12,000. One extra deal per
  month pays for any marketing retainer several times over — lead with this.
- Zillow Premier Agent costs $200-$1,500+/month per ZIP; leads are low-intent
  and shared. Realtor.com and Ylopo are similar.
- Speed-to-lead is everything: responding within 5 minutes vs 30 minutes is
  roughly a 20x difference in contact rate. Most agents take HOURS.
- 80% of deals close between the 5th and 12th touch, but the average agent
  gives up after 2. Follow-up discipline is the single biggest gap.
- Seller leads are far more profitable than buyer leads (listings scale,
  buyers eat weekends).
- Their CRM is usually a spreadsheet, a stale Follow Up Boss seat nobody
  logs into, or whatever the brokerage forced on them.

WHAT AVENTIS SELLS THEM:
${REAL_ESTATE.offerings.map((o) => `- ${o}`).join("\n")}

TYPICAL DEAL SIZE: $1,000-$3,000/month for solo agents/small teams,
$3,000-$10,000/month for teams and brokerages. White-label CRM: $500-2,000/mo.

═══════════════════════════════════════════════════════════════
QUALIFICATION RULES
═══════════════════════════════════════════════════════════════
1. If the lead is NOT junk removal or real estate, set vertical="other" and
   score it below 30. We do not sell to anyone else.
2. East Coast US is strongly preferred (ME→FL plus PA, NJ, DC, WV).
3. STRONGEST signals, in order:
   a. Publicly complaining about Angi/Thumbtack/Zillow lead costs
   b. Fired or is replacing a marketing agency
   c. Hiring (drivers for junk removal, ISA/TC for real estate) = growing
   d. Has a Google Business Profile but NO website, or a terrible one
   e. Low review count (<25) in a competitive metro = losing map-pack traffic
   f. Newly registered LLC in the vertical = zero marketing infrastructure
4. Tech-stack tells:
   - Wix/Squarespace/GoDaddy site + no booking form = they're DIY-ing it, easy win
   - Angi/HomeAdvisor/Thumbtack badges on site = paying marketplace tax, prime target
   - Already running HubSpot/Salesforce/Follow Up Boss = harder sell on software,
     pivot to services
   - No Google Analytics or pixel = not running paid ads yet
5. Down-score: national franchises (1-800-GOT-JUNK, Junk King, College Hunks,
   RE/MAX corporate, Keller Williams International), marketplaces themselves,
   job boards, competitors (other marketing agencies), and anything outside
   the two verticals.

═══════════════════════════════════════════════════════════════
SCORING (each 0-20, summing to lead_score 0-100)
═══════════════════════════════════════════════════════════════
- intent_strength: how clearly they signaled need (20 = explicitly asking
  for exactly what we sell; 0 = we're inferring it entirely)
- budget_indicators: proof they spend money (paying for marketplace leads,
  hiring, multiple trucks/agents, established revenue)
- decision_maker_likely: owner/broker/principal = high; employee = low
- vertical_fit: 20 = squarely junk removal or real estate; 0 = neither
- east_coast_bonus: 20 = East Coast US, 10 = elsewhere US, 0 = international

═══════════════════════════════════════════════════════════════
OUTREACH — write like an operator, not a marketer
═══════════════════════════════════════════════════════════════
- Reference something SPECIFIC you can see (their review count, their Wix site,
  the Angi badge, the job posting, their exact words in a post).
- Lead with their economics, not our features. For junk removal: cost per
  booked job and missed calls. For real estate: one extra closing pays for it.
- No corporate filler. No "I hope this email finds you well." No "synergy."
- outreach_email_draft: 4-6 sentences, specific, ends with a low-friction ask.
- outreach_dm_draft: 2 sentences max, casual, for Reddit/X/LinkedIn.
- outreach_phone_script: a 20-second cold-call opener including a
  pattern-interrupt and one specific observation about their business.
- estimated_monthly_value: realistic monthly retainer in USD we'd charge
  this specific lead based on their size (integer, no currency symbol).

═══════════════════════════════════════════════════════════════
OUTPUT — return ONLY valid JSON, no markdown fences, no commentary
═══════════════════════════════════════════════════════════════
{
  "vertical": "junk_removal" | "real_estate" | "other",
  "company_name": string|null,
  "person_name": string|null,
  "website": string|null,
  "industry": string|null,
  "company_size": string|null,
  "location": string|null,
  "state": string|null,
  "summary": string (3-5 sentences: what they do, their situation, why they're a lead),
  "pain_points": string[],
  "buying_signals": string[],
  "recommended_services": string[],
  "outreach_angle": string,
  "outreach_email_draft": string,
  "outreach_dm_draft": string,
  "outreach_phone_script": string,
  "estimated_monthly_value": number|null,
  "lead_score": number (0-100),
  "score_breakdown": {
    "intent_strength": number, "budget_indicators": number,
    "decision_maker_likely": number, "vertical_fit": number,
    "east_coast_bonus": number, "reasoning": string
  },
  "red_flags": string[],
  "enrichment": {
    "email_guesses": string[], "linkedin_guess": string|null,
    "domain_age_estimate": string|null, "tech_stack": string[],
    "social_links": object
  },
  "next_actions": string[]
}`;

function buildUserMessage(lead: Lead, enrichment: EnrichmentResult): string {
  const parts: string[] = [];
  const guessedVertical = classifyVertical(
    `${lead.company_name ?? ""} ${lead.source_post_content ?? ""} ${lead.intent_signal ?? ""}`
  );

  parts.push("LEAD SIGNAL");
  parts.push(`Pre-classified vertical (verify this): ${guessedVertical}`);
  parts.push(`Source: ${lead.source}`);
  parts.push(`Source URL: ${lead.source_url ?? "N/A"}`);
  parts.push(`Posted at: ${lead.source_post_at ?? "N/A"}`);
  parts.push(`Person/handle: ${lead.person_name ?? "unknown"}`);
  parts.push(`Company: ${lead.company_name ?? "unknown"}`);
  parts.push(`Known phone: ${lead.phone ?? "none"}`);
  parts.push(`Known email: ${lead.email ?? "none"}`);
  parts.push(`Location: ${lead.location ?? "unknown"}`);
  parts.push(`Matched keywords: ${(lead.matched_keywords ?? []).join(", ")}`);
  parts.push(`Intent category: ${lead.intent_category ?? "unknown"}`);
  parts.push(`Intent snippet: ${lead.intent_signal ?? ""}`);
  parts.push("");
  parts.push("RAW SIGNAL CONTENT:");
  parts.push(lead.source_post_content ?? "(none)");

  if (enrichment.website) {
    parts.push("");
    parts.push("=== WEB ENRICHMENT (scraped automatically) ===");
    parts.push(`Website: ${enrichment.website}`);
    if (enrichment.domain) parts.push(`Domain: ${enrichment.domain}`);
    if (enrichment.domain_age_estimate) parts.push(`Domain age: ${enrichment.domain_age_estimate}`);
    if (enrichment.homepage_title) parts.push(`Page title: ${enrichment.homepage_title}`);
    if (enrichment.homepage_description) parts.push(`Meta description: ${enrichment.homepage_description}`);
    if (enrichment.company_size_hint) parts.push(`Team size hint: ${enrichment.company_size_hint}`);
    if (enrichment.tech_stack_hints?.length)
      parts.push(`Tech stack detected: ${enrichment.tech_stack_hints.join(", ")}`);
    if (enrichment.uses_lead_marketplace)
      parts.push(`⚠️ USES LEAD MARKETPLACE (Angi/Thumbtack/Zillow badges found) — prime target`);
    if (enrichment.has_online_booking !== undefined && enrichment.has_online_booking !== null)
      parts.push(`Online booking form present: ${enrichment.has_online_booking}`);
    if (enrichment.has_pricing_page) parts.push(`Has pricing page: yes`);
    if (enrichment.services_offered?.length)
      parts.push(`Services listed: ${enrichment.services_offered.join(", ")}`);
    if (enrichment.service_area) parts.push(`Service area: ${enrichment.service_area}`);
    if (enrichment.years_in_business) parts.push(`Years in business: ${enrichment.years_in_business}`);
    if (enrichment.contact_emails?.length)
      parts.push(`Emails found: ${enrichment.contact_emails.join(", ")}`);
    if (enrichment.contact_phones?.length)
      parts.push(`Phones found: ${enrichment.contact_phones.join(", ")}`);
    if (enrichment.owner_name) parts.push(`Owner/contact name: ${enrichment.owner_name}`);
    if (enrichment.social_links && Object.keys(enrichment.social_links).length) {
      parts.push("Social links:");
      for (const [k, v] of Object.entries(enrichment.social_links)) parts.push(`  - ${k}: ${v}`);
    }
    if (enrichment.notable_details) parts.push(`Notable: ${enrichment.notable_details}`);
    if (enrichment.homepage_text) {
      parts.push("");
      parts.push("HOMEPAGE CONTENT:");
      parts.push(enrichment.homepage_text.slice(0, 4000));
    }
  }

  parts.push("");
  parts.push("Return ONLY the JSON object per the schema.");
  return parts.join("\n");
}

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        maxOutputTokens: 4000,
      },
    }),
    signal: AbortSignal.timeout(60000),
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
    signal: AbortSignal.timeout(60000),
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
  parsed.outreach_phone_script ??= "";
  parsed.vertical ??= "other";
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

  // Hard rule: anything outside our two verticals is capped at 30
  if (parsed.vertical === "other") {
    parsed.lead_score = Math.min(parsed.lead_score, 30);
  }
  if (typeof parsed.estimated_monthly_value !== "number") {
    parsed.estimated_monthly_value = null;
  }
  return parsed;
}

export async function researchLead(lead: Lead): Promise<ResearchOutput> {
  const enrichment = await enrichLead({
    website: lead.website,
    source_url: lead.source_url,
    company_name: lead.company_name,
    person_name: lead.person_name,
    location: lead.location,
  });

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

  // Merge verified scraped data over anything the AI might have hallucinated
  if (enrichment.website) out.website ??= enrichment.website;
  if (enrichment.tech_stack_hints?.length) out.enrichment.tech_stack = enrichment.tech_stack_hints;
  if (enrichment.social_links) {
    out.enrichment.social_links = {
      ...enrichment.social_links,
      ...(out.enrichment.social_links ?? {}),
    };
  }
  if (enrichment.contact_emails?.length) {
    const merged = new Set([...enrichment.contact_emails, ...(out.enrichment.email_guesses ?? [])]);
    out.enrichment.email_guesses = Array.from(merged).slice(0, 10);
  }
  if (enrichment.domain_age_estimate) {
    out.enrichment.domain_age_estimate = enrichment.domain_age_estimate;
  }

  return out;
}
