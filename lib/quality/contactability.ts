import type { Lead } from "../types";

/**
 * Contactability — how reachable is this lead?
 *
 * A 0-100 score that measures whether Isaiah can ACTUALLY reach this person.
 * Leads below CONTACTABILITY_THRESHOLD are rejected from the main pipeline
 * (they go into a separate "uncontactable" bucket for reference, not the
 * main CRM view).
 *
 * Weights:
 *   email          +30  (most direct outreach channel)
 *   verified phone +25  (high signal — usually a real business)
 *   business website +20 (we can scrape it, find more contact info)
 *   real company name +10 ("Sunshine HVAC" yes, "tampa_hvac_owner" no)
 *   decision-maker name +10
 *   physical location +10 (city/state at minimum)
 *   linkedin       +10
 *   social link    +5
 *
 * Plus penalties:
 *   pseudonymous handle only        -10
 *   no business identification      -15
 *   only an anonymous social handle -20
 */

export const CONTACTABILITY_THRESHOLD = 45;

export interface ContactabilityResult {
  score: number;
  has_email: boolean;
  has_phone: boolean;
  has_website: boolean;
  has_linkedin: boolean;
  has_company_name: boolean;
  has_person_name: boolean;
  has_location: boolean;
  reachable_channels: string[];
  missing: string[];
  passes_gate: boolean;
}

const PSEUDONYMOUS_PATTERNS = [
  /^[a-z]+[_-][a-z]+[_-][a-z]+\d*$/i, // tampa_hvac_owner, etc
  /^u\/[a-z0-9_-]+$/i, // u/somebody
  /^@[a-z0-9_]+$/i, // @handle
  /^[a-z0-9]{6,}$/i, // random8429
];

function looksPseudonymous(name: string | null | undefined): boolean {
  if (!name) return false;
  const t = name.trim();
  if (t.length < 2) return true;
  if (t.includes(" ")) return false; // has a space = probably real name
  return PSEUDONYMOUS_PATTERNS.some((re) => re.test(t));
}

function isLegitCompanyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const t = name.trim();
  if (t.length < 3) return false;
  // Looks like a company if: has multiple words OR ends in LLC/Inc/Co/Studio/Group/etc
  if (t.split(/\s+/).length >= 2) return true;
  return /\b(llc|inc|co|corp|group|studio|labs|works|agency|partners|associates|solutions|services|systems|technologies|technology|software|saas|ai|ventures|capital|holdings|enterprises|industries|company)\b/i.test(t);
}

export function scoreContactability(lead: Partial<Lead>): ContactabilityResult {
  const reachable: string[] = [];
  const missing: string[] = [];
  let score = 0;

  const has_email = !!lead.email && /\S+@\S+\.\S+/.test(lead.email);
  if (has_email) {
    score += 30;
    reachable.push("email");
  } else {
    missing.push("email");
  }

  const has_phone = !!lead.phone && /\d{3}/.test(lead.phone);
  if (has_phone) {
    score += 25;
    reachable.push("phone");
  } else {
    missing.push("phone");
  }

  const has_website =
    !!lead.website &&
    /^https?:\/\//i.test(lead.website) &&
    !/(reddit|twitter|x\.com|bsky|news\.ycombinator|github|linkedin)\.com/i.test(lead.website);
  if (has_website) {
    score += 20;
    reachable.push("website");
  } else {
    missing.push("website");
  }

  const has_linkedin = !!lead.linkedin_url && /linkedin\.com\//i.test(lead.linkedin_url);
  if (has_linkedin) {
    score += 10;
    reachable.push("linkedin");
  }

  const has_company_name = isLegitCompanyName(lead.company_name);
  if (has_company_name) score += 10;
  else missing.push("company_name");

  const has_person_name =
    !!lead.person_name && !looksPseudonymous(lead.person_name) && lead.person_name.includes(" ");
  if (has_person_name) score += 10;
  else if (lead.person_name && looksPseudonymous(lead.person_name)) score -= 5;

  const has_location = !!lead.location && lead.location.length >= 2;
  if (has_location) score += 10;

  // Source-based penalties — if ONLY social handle, hard penalty
  const onlySocialIdentified =
    !has_email &&
    !has_phone &&
    !has_website &&
    (lead.source === "reddit" || lead.source === "twitter") &&
    !has_company_name;
  if (onlySocialIdentified) score -= 15;

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    has_email,
    has_phone,
    has_website,
    has_linkedin,
    has_company_name,
    has_person_name,
    has_location,
    reachable_channels: reachable,
    missing,
    passes_gate: finalScore >= CONTACTABILITY_THRESHOLD,
  };
}
