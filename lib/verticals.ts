/**
 * VERTICAL FOCUS — Aventis targets exactly two industries:
 *
 *   1. JUNK REMOVAL / HAULING — local service operators, 1-20 trucks.
 *      They spend heavily on Angi/Thumbtack leads (brutal CPLs), compete
 *      against 1-800-GOT-JUNK, and desperately need owned lead channels.
 *
 *   2. REAL ESTATE — agents, teams, brokerages, property managers, and
 *      investors. They burn money on Zillow/Realtor.com leads, have terrible
 *      follow-up discipline, and are the single best white-label CRM buyer
 *      in the entire SMB market.
 *
 * Everything in the system — keywords, Places categories, AI prompts,
 * scoring — is tuned for these two verticals only.
 */

export type Vertical = "junk_removal" | "real_estate" | "other";

export interface VerticalConfig {
  id: Vertical;
  label: string;
  /** Google Places search categories */
  placesCategories: string[];
  /** Subreddits where these operators hang out */
  subreddits: string[];
  /** High-intent search queries for Firecrawl/Google */
  searchQueries: string[];
  /** Job titles that indicate a growing business in this vertical */
  hiringTitles: string[];
  /** What Aventis sells them */
  offerings: string[];
  /** Known pain points we can lead with */
  painPoints: string[];
  /** Terms in a business name/description that identify this vertical */
  identifiers: string[];
}

export const JUNK_REMOVAL: VerticalConfig = {
  id: "junk_removal",
  label: "Junk Removal & Hauling",
  placesCategories: [
    "junk removal service",
    "hauling service",
    "dumpster rental",
    "estate cleanout service",
    "furniture removal service",
    "debris removal",
    "garbage collection service",
    "demolition contractor",
    "appliance removal",
    "construction debris removal",
    "property cleanout service",
    "waste management company",
  ],
  subreddits: ["junkremoval", "sweatystartup", "smallbusiness", "Entrepreneur"],
  searchQueries: [
    '"junk removal" "marketing" site:reddit.com',
    '"junk removal business" "need more leads"',
    '"junk removal" "angi leads" too expensive',
    '"junk removal" "thumbtack" cost per lead',
    '"hauling business" "how to get customers"',
    '"junk removal" franchise vs independent marketing',
    '"dumpster rental" business marketing help',
  ],
  hiringTitles: ["truck driver junk removal", "hauling crew", "junk removal technician"],
  offerings: [
    "Local SEO for 'junk removal [city]' — own the map pack instead of renting Angi leads",
    "Google Local Services Ads (LSA) setup — pay per lead at 1/3 Angi's cost",
    "AventisAI phone agent — answers after-hours calls and books jobs automatically",
    "White-label CRM with job scheduling, dispatch, and photo-quote intake",
    "Review-acceleration system — reviews are the #1 ranking factor for junk removal",
    "Facebook/Instagram ads for estate cleanouts and seasonal purges",
  ],
  painPoints: [
    "Angi/Thumbtack lead costs ($40-90 per shared lead, sold to 4 competitors)",
    "Competing against 1-800-GOT-JUNK's brand recognition and ad budget",
    "Seasonal demand swings (spring cleaning peak, winter dead zone)",
    "Missed calls while on jobs = lost revenue (no one answers the phone)",
    "No repeat-customer system despite high referral potential",
    "Quoting requires seeing the junk — friction in the sales process",
  ],
  identifiers: [
    "junk removal",
    "junk hauling",
    "hauling",
    "cleanout",
    "clean out",
    "debris removal",
    "dumpster",
    "rubbish",
    "trash removal",
    "waste removal",
    "demolition",
    "estate clearing",
    "got junk",
  ],
};

export const REAL_ESTATE: VerticalConfig = {
  id: "real_estate",
  label: "Real Estate",
  placesCategories: [
    "real estate agency",
    "real estate agent",
    "property management company",
    "real estate brokerage",
    "realtor",
    "real estate consultant",
    "apartment rental agency",
    "commercial real estate agency",
    "real estate investor",
    "home buying company",
  ],
  subreddits: ["realtors", "realestateinvesting", "RealEstate", "PropertyManagement", "smallbusiness"],
  searchQueries: [
    '"real estate agent" "zillow leads" too expensive',
    '"realtor" "need a better CRM"',
    '"real estate team" "looking for marketing"',
    '"brokerage" "lead generation" recommendations',
    '"property management" "marketing help"',
    '"real estate" "follow up" leads falling through',
    '"realtor" "IDX website" recommendations',
    '"real estate investor" "motivated seller leads"',
  ],
  hiringTitles: [
    "real estate marketing coordinator",
    "transaction coordinator",
    "real estate inside sales agent",
    "ISA real estate",
    "listing coordinator",
  ],
  offerings: [
    "White-label CRM with IDX integration — rebrand as your team's own platform",
    "AventisAI lead-response agent — responds to inbound leads in under 60 seconds (the #1 conversion factor)",
    "Automated nurture sequences — 80% of deals happen after the 5th touch",
    "Listing marketing packages (video, social, email blast to sphere)",
    "Google/Meta ads for seller leads (higher margin than buyer leads)",
    "Farm-area geographic marketing with direct mail + digital retargeting",
  ],
  painPoints: [
    "Zillow/Realtor.com lead costs ($20-200 per lead, low intent, shared)",
    "Slow lead response time — most agents take hours, deals go to whoever calls first",
    "No follow-up discipline past the 2nd touch, despite deals closing on the 5th-12th",
    "CRM is either a spreadsheet or an expensive tool nobody uses",
    "Sphere-of-influence marketing is inconsistent",
    "Buyer leads are unprofitable; seller leads are what actually pays",
  ],
  identifiers: [
    "real estate",
    "realtor",
    "realty",
    "brokerage",
    "broker",
    "property management",
    "properties",
    "homes",
    "estates",
    "keller williams",
    "re/max",
    "remax",
    "coldwell",
    "century 21",
    "compass",
    "exp realty",
    "sotheby",
    "berkshire hathaway home",
  ],
};

export const VERTICALS: VerticalConfig[] = [JUNK_REMOVAL, REAL_ESTATE];

/**
 * Classify a lead into a vertical based on any text we have about it.
 * Returns "other" when neither vertical matches — those get down-scored hard.
 */
export function classifyVertical(text: string | null | undefined): Vertical {
  if (!text) return "other";
  const lower = text.toLowerCase();

  let junkHits = 0;
  for (const id of JUNK_REMOVAL.identifiers) {
    if (lower.includes(id)) junkHits++;
  }
  let reHits = 0;
  for (const id of REAL_ESTATE.identifiers) {
    if (lower.includes(id)) reHits++;
  }

  if (junkHits === 0 && reHits === 0) return "other";
  return junkHits >= reHits ? "junk_removal" : "real_estate";
}

export function getVerticalConfig(v: Vertical): VerticalConfig | null {
  if (v === "junk_removal") return JUNK_REMOVAL;
  if (v === "real_estate") return REAL_ESTATE;
  return null;
}

/** All Places categories across both verticals */
export const ALL_PLACES_CATEGORIES = [
  ...JUNK_REMOVAL.placesCategories,
  ...REAL_ESTATE.placesCategories,
];

/** All subreddits across both verticals (deduped) */
export const ALL_SUBREDDITS = Array.from(
  new Set([...JUNK_REMOVAL.subreddits, ...REAL_ESTATE.subreddits])
);

/** All high-intent search queries across both verticals */
export const ALL_SEARCH_QUERIES = [
  ...JUNK_REMOVAL.searchQueries,
  ...REAL_ESTATE.searchQueries,
];

/** East-coast metros we prospect in, ordered by market size */
export const TARGET_METROS = [
  "New York NY",
  "Philadelphia PA",
  "Boston MA",
  "Washington DC",
  "Atlanta GA",
  "Miami FL",
  "Tampa FL",
  "Orlando FL",
  "Charlotte NC",
  "Raleigh NC",
  "Baltimore MD",
  "Jacksonville FL",
  "Richmond VA",
  "Virginia Beach VA",
  "Pittsburgh PA",
  "Newark NJ",
  "Hartford CT",
  "Providence RI",
  "Charleston SC",
  "Savannah GA",
  "Greenville SC",
  "Columbia SC",
  "Wilmington NC",
  "Fort Lauderdale FL",
];
