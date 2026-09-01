/**
 * Mapbox integration — geocoding + static map images.
 *
 * Why: junk removal and real estate are BOTH hyper-local businesses.
 * Knowing exactly where a lead sits lets us:
 *   - Visualize territory density on the /map dashboard
 *   - Filter by radius from a metro
 *   - Prioritize leads clustered near existing clients
 *   - Show a location thumbnail on each lead
 *
 * Set MAPBOX_TOKEN (server, for geocoding) and
 * NEXT_PUBLIC_MAPBOX_TOKEN (browser, for the interactive map).
 * A single public token works for both.
 */

const GEOCODE_BASE = "https://api.mapbox.com/search/geocode/v6/forward";
const STATIC_BASE = "https://api.mapbox.com/styles/v1/mapbox";

function token(): string | null {
  return process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null;
}

export function isMapboxEnabled(): boolean {
  return !!token();
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  confidence: string | null;
}

interface MapboxFeature {
  properties?: {
    full_address?: string;
    name?: string;
    coordinates?: { longitude: number; latitude: number };
    match_code?: { confidence?: string };
    context?: {
      place?: { name?: string };
      region?: { region_code?: string; name?: string };
      postcode?: { name?: string };
      country?: { country_code?: string };
    };
  };
  geometry?: { coordinates?: [number, number] };
}

interface MapboxGeocodeResponse {
  features?: MapboxFeature[];
}

/**
 * Turn a free-text address into coordinates.
 * Biased to US results since we only prospect domestically.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const t = token();
  if (!t || !address || address.trim().length < 4) return null;

  try {
    const url = `${GEOCODE_BASE}?q=${encodeURIComponent(
      address
    )}&country=us&limit=1&access_token=${t}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.warn(`[mapbox] geocode ${res.status} for "${address.slice(0, 60)}"`);
      return null;
    }
    const data = (await res.json()) as MapboxGeocodeResponse;
    const f = data.features?.[0];
    if (!f) return null;

    const coords =
      f.properties?.coordinates ??
      (f.geometry?.coordinates
        ? { longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1] }
        : null);
    if (!coords) return null;

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      formatted_address: f.properties?.full_address ?? f.properties?.name ?? address,
      city: f.properties?.context?.place?.name ?? null,
      state: f.properties?.context?.region?.region_code ?? null,
      postcode: f.properties?.context?.postcode?.name ?? null,
      country: f.properties?.context?.country?.country_code ?? null,
      confidence: f.properties?.match_code?.confidence ?? null,
    };
  } catch (err) {
    console.warn(
      `[mapbox] geocode error:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * Build a static map image URL for a lead's location — used as a thumbnail
 * on the lead detail page. No JS needed, just an <img src>.
 */
export function staticMapUrl(opts: {
  latitude: number;
  longitude: number;
  zoom?: number;
  width?: number;
  height?: number;
  style?: "streets-v12" | "light-v11" | "dark-v11" | "satellite-streets-v12";
  markerColor?: string;
}): string | null {
  const t = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN;
  if (!t) return null;
  const {
    latitude,
    longitude,
    zoom = 13,
    width = 600,
    height = 260,
    style = "light-v11",
    markerColor = "5168fa",
  } = opts;
  const marker = `pin-l+${markerColor}(${longitude},${latitude})`;
  return `${STATIC_BASE}/${style}/static/${marker}/${longitude},${latitude},${zoom},0/${width}x${height}@2x?access_token=${t}`;
}

/**
 * Approximate distance in miles between two coordinates (haversine).
 * Used for radius filtering and "nearby leads" clustering.
 */
export function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
