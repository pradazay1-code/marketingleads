import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";

/**
 * Google Maps Places API — the highest-quality lead source.
 *
 * Every result includes: business name, full address, phone, website,
 * Google rating, and operating status. These are VERIFIED real businesses.
 *
 * Setup:
 *   1. Get a Google Cloud API key with Places API (New) enabled
 *   2. Set GOOGLE_PLACES_API_KEY in env vars
 *
 * Cost: $200/mo free credit covers many thousands of searches.
 * Uses the Text Search endpoint to find new businesses by category + city.
 */

const TARGET_INDUSTRIES = [
  // Service businesses that buy marketing services
  "hvac contractor",
  "plumbing company",
  "electrician",
  "roofing contractor",
  "law firm",
  "dental practice",
  "chiropractor",
  "med spa",
  "real estate agency",
  "moving company",
  "landscaping company",
  "pest control",
  "auto repair shop",
  "personal injury attorney",
  "wedding photographer",
  "catering company",
  "marketing agency",
  "accounting firm",
  "insurance agency",
  "fitness studio",
];

// East coast major metros
const EAST_COAST_CITIES = [
  "New York NY",
  "Boston MA",
  "Philadelphia PA",
  "Washington DC",
  "Atlanta GA",
  "Miami FL",
  "Orlando FL",
  "Tampa FL",
  "Jacksonville FL",
  "Charlotte NC",
  "Raleigh NC",
  "Richmond VA",
  "Baltimore MD",
  "Pittsburgh PA",
  "Newark NJ",
  "Hartford CT",
  "Providence RI",
  "Charleston SC",
  "Savannah GA",
];

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  types?: string[];
  googleMapsUri?: string;
  // Time-related fields (we ask for these to detect newly-opened businesses)
  regularOpeningHours?: { openNow?: boolean };
}

interface PlacesResponse {
  places?: PlaceResult[];
}

/**
 * Limit how much we query per cycle — Google Places isn't free past
 * $200/month and we want this to last forever on the free credit.
 */
const MAX_SEARCHES_PER_CYCLE = 8;

export async function fetchGoogleMapsSignals(): Promise<RawSignal[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[google-maps] GOOGLE_PLACES_API_KEY not set — skipping");
    return [];
  }

  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  // Rotate through industry/city pairs each run so we cover the matrix over time
  // Using current epoch hour to vary the slice — keeps diversity across cycles
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const cityOffset = epochHour % EAST_COAST_CITIES.length;
  const industryOffset = epochHour % TARGET_INDUSTRIES.length;

  let searchCount = 0;
  for (let ci = 0; ci < EAST_COAST_CITIES.length && searchCount < MAX_SEARCHES_PER_CYCLE; ci++) {
    for (let ii = 0; ii < TARGET_INDUSTRIES.length && searchCount < MAX_SEARCHES_PER_CYCLE; ii++) {
      const city = EAST_COAST_CITIES[(ci + cityOffset) % EAST_COAST_CITIES.length];
      const industry = TARGET_INDUSTRIES[(ii + industryOffset) % TARGET_INDUSTRIES.length];
      const query = `${industry} in ${city}`;

      try {
        const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,places.primaryType,places.types,places.googleMapsUri",
          },
          body: JSON.stringify({
            textQuery: query,
            pageSize: 10,
            languageCode: "en",
            regionCode: "US",
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.warn(`[google-maps] ${res.status} for "${query}": ${errText.slice(0, 200)}`);
          continue;
        }
        const data = (await res.json()) as PlacesResponse;
        for (const p of data.places ?? []) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);

          // Skip closed businesses
          if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;

          const name = p.displayName?.text;
          if (!name) continue;

          const address = p.formattedAddress ?? "";
          const phone = p.nationalPhoneNumber ?? p.internationalPhoneNumber;
          const website = p.websiteUri;
          const state = detectState(address);

          // Bias toward businesses with fewer reviews — these are likely
          // newer or smaller, hence prime marketing-services prospects.
          const reviewCount = p.userRatingCount ?? 0;
          const isPrime = reviewCount < 30 || reviewCount > 200; // tiny OR established

          const signal: RawSignal = {
            external_id: `gmaps:${p.id}`,
            source: "googlemaps",
            source_url: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
            source_post_content: `${name} — ${industry}\nAddress: ${address}\nPhone: ${phone ?? "n/a"}\nWebsite: ${website ?? "n/a"}\nGoogle rating: ${p.rating ?? "n/a"} (${reviewCount} reviews)\nStatus: ${p.businessStatus}`,
            company_name: name,
            email: undefined,
            website,
            phone,
            location: address,
            matched_keywords: [industry, "verified business"],
            intent_signal: `${name} — verified ${industry} in ${city}${reviewCount < 20 ? " (likely newer/smaller, prime marketing prospect)" : ""}`,
            intent_category: reviewCount < 20 ? "launching" : "shopping",
            raw: {
              place_id: p.id,
              industry,
              city,
              state,
              east_coast: isEastCoast(state),
              rating: p.rating,
              review_count: reviewCount,
              primary_type: p.primaryType,
              is_prime_prospect: isPrime,
              maps_url: p.googleMapsUri,
            },
          };
          signals.push(signal);
        }
        searchCount++;
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.error(`[google-maps] error for "${query}":`, err);
      }
    }
  }

  return signals;
}
