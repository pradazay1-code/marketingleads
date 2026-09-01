import type { RawSignal } from "../types";
import { detectState, isEastCoast } from "../keywords";
import { JUNK_REMOVAL, REAL_ESTATE, TARGET_METROS, classifyVertical } from "../verticals";

/**
 * Google Maps Places API — the highest-quality lead source for local
 * service businesses. Every result is a VERIFIED business with name,
 * address, phone, website, and rating.
 *
 * Now hyper-focused on junk removal + real estate categories only.
 *
 * Setup: enable "Places API (New)" in Google Cloud, set GOOGLE_PLACES_API_KEY.
 * Free $200/mo credit covers thousands of searches.
 */

// Big national brands / franchises we should never treat as prospects
const EXCLUDED_BRANDS = [
  "1-800-got-junk",
  "1800 got junk",
  "got junk",
  "junk king",
  "college hunks",
  "junkluggers",
  "the junkluggers",
  "waste management",
  "republic services",
  "keller williams realty international",
  "re/max llc",
  "zillow",
  "redfin",
  "opendoor",
];

function isExcludedBrand(name: string): boolean {
  const lower = name.toLowerCase();
  return EXCLUDED_BRANDS.some((b) => lower.includes(b));
}

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
  location?: { latitude: number; longitude: number };
}

interface PlacesResponse {
  places?: PlaceResult[];
}

/** Stay comfortably inside Google's $200/mo free credit */
const MAX_SEARCHES_PER_CYCLE = 10;

export async function fetchGoogleMapsSignals(): Promise<RawSignal[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[google-maps] GOOGLE_PLACES_API_KEY not set — skipping");
    return [];
  }

  const signals: RawSignal[] = [];
  const seen = new Set<string>();

  // Rotate metro × category pairs so we cover the full matrix across cycles
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const categories = [
    ...JUNK_REMOVAL.placesCategories,
    ...REAL_ESTATE.placesCategories,
  ];

  let searchCount = 0;
  for (let i = 0; i < MAX_SEARCHES_PER_CYCLE; i++) {
    const metro = TARGET_METROS[(epochHour + i) % TARGET_METROS.length];
    const category = categories[(epochHour * 3 + i) % categories.length];
    const query = `${category} in ${metro}`;

    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.rating,places.userRatingCount,places.primaryType,places.types,places.googleMapsUri,places.location",
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 12,
          languageCode: "en",
          regionCode: "US",
        }),
        signal: AbortSignal.timeout(15000),
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
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;

        const name = p.displayName?.text;
        if (!name || isExcludedBrand(name)) continue;

        const address = p.formattedAddress ?? "";
        const phone = p.nationalPhoneNumber ?? p.internationalPhoneNumber;
        const website = p.websiteUri;
        const state = detectState(address);
        const reviewCount = p.userRatingCount ?? 0;

        const vertical = classifyVertical(`${name} ${category}`);

        // The sweet spot: real businesses with a small-to-moderate online
        // footprint. Huge review counts usually mean they already have a
        // marketing partner; zero reviews often means defunct.
        const isPrimeProspect = reviewCount >= 3 && reviewCount <= 150;
        const hasNoWebsite = !website;

        // Signal quality note we pass to the AI
        const opportunityNote = hasNoWebsite
          ? "NO WEBSITE — huge opportunity, they're running on GMB + word of mouth alone"
          : reviewCount < 25
          ? "Low review count — losing map-pack traffic to bigger competitors"
          : reviewCount > 150
          ? "Established — likely already has a marketing partner, harder sell"
          : "Solid review base, room to scale with paid + SEO";

        signals.push({
          external_id: `gmaps:${p.id}`,
          source: "googlemaps",
          source_url: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
          source_post_content: [
            `${name} — ${category}`,
            `Address: ${address}`,
            `Phone: ${phone ?? "not listed"}`,
            `Website: ${website ?? "NONE LISTED"}`,
            `Google rating: ${p.rating ?? "n/a"} (${reviewCount} reviews)`,
            `Assessment: ${opportunityNote}`,
          ].join("\n"),
          company_name: name,
          website,
          phone,
          location: address,
          matched_keywords: [
            category,
            "verified business",
            vertical === "junk_removal" ? "junk removal" : "real estate",
          ],
          intent_signal: `${name} — verified ${category} in ${metro}. ${opportunityNote}`,
          intent_category: hasNoWebsite || reviewCount < 25 ? "launching" : "shopping",
          raw: {
            place_id: p.id,
            vertical,
            category,
            metro,
            state,
            east_coast: isEastCoast(state),
            rating: p.rating,
            review_count: reviewCount,
            is_prime_prospect: isPrimeProspect,
            has_no_website: hasNoWebsite,
            latitude: p.location?.latitude,
            longitude: p.location?.longitude,
            maps_url: p.googleMapsUri,
          },
        });
      }
      searchCount++;
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[google-maps] error for "${query}":`, err);
    }
  }

  console.log(`[google-maps] ${searchCount} searches → ${signals.length} signals`);
  return signals;
}
