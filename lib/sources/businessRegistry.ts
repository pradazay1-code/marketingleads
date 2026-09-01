import type { RawSignal } from "../types";
import { classifyVertical } from "../verticals";

/**
 * Newly-registered businesses via OpenCorporates.
 *
 * v4: filtered to junk removal + real estate entities only. A brand-new
 * hauling LLC or realty company is a perfect prospect — they have a legal
 * entity, an address, and zero marketing infrastructure.
 */

interface OCCompany {
  company: {
    name: string;
    company_number: string;
    jurisdiction_code: string;
    incorporation_date: string;
    company_type: string;
    registered_address_in_full: string | null;
    opencorporates_url: string;
    current_status: string | null;
  };
}

interface OCResponse {
  results?: { companies: OCCompany[] };
}

const EAST_COAST_JURISDICTIONS = [
  "us_fl",
  "us_ny",
  "us_nj",
  "us_pa",
  "us_ma",
  "us_ga",
  "us_nc",
  "us_sc",
  "us_va",
  "us_md",
  "us_ct",
];

/** Name fragments that identify our two verticals in a registry filing */
const VERTICAL_NAME_TERMS = [
  // Junk removal
  "junk",
  "hauling",
  "haul",
  "cleanout",
  "clean out",
  "debris",
  "dumpster",
  "rubbish",
  "disposal",
  "removal",
  "demolition",
  // Real estate
  "realty",
  "real estate",
  "properties",
  "property management",
  "homes",
  "estates",
  "brokerage",
  "land co",
];

export async function fetchBusinessRegistrySignals(): Promise<RawSignal[]> {
  const apiToken = process.env.OPENCORPORATES_API_TOKEN;
  const signals: RawSignal[] = [];
  const today = new Date();
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const dateRange = `${ninetyDaysAgo.toISOString().slice(0, 10)}:${today
    .toISOString()
    .slice(0, 10)}`;

  // Rotate jurisdictions across cycles to spread out API usage
  const epochHour = Math.floor(Date.now() / 3_600_000);
  const jurisdictions = [
    EAST_COAST_JURISDICTIONS[epochHour % EAST_COAST_JURISDICTIONS.length],
    EAST_COAST_JURISDICTIONS[(epochHour + 4) % EAST_COAST_JURISDICTIONS.length],
    EAST_COAST_JURISDICTIONS[(epochHour + 8) % EAST_COAST_JURISDICTIONS.length],
  ];

  // Search directly for vertical terms instead of pulling every new LLC
  const searchTerms = ["junk removal", "hauling", "cleanout", "realty", "property management"];

  for (const j of jurisdictions) {
    for (const term of searchTerms) {
      try {
        const params = new URLSearchParams({
          q: term,
          jurisdiction_code: j,
          incorporation_date: dateRange,
          per_page: "20",
          order: "incorporation_date",
        });
        if (apiToken) params.set("api_token", apiToken);

        const url = `https://api.opencorporates.com/v0.4/companies/search?${params.toString()}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) {
          console.warn(`[businessRegistry] ${res.status} for ${j}/${term}`);
          continue;
        }
        const data = (await res.json()) as OCResponse;

        for (const item of data.results?.companies ?? []) {
          const c = item.company;
          const nameLower = c.name.toLowerCase();
          // Double-check the name actually matches a vertical term
          if (!VERTICAL_NAME_TERMS.some((t) => nameLower.includes(t))) continue;

          const vertical = classifyVertical(c.name);
          if (vertical === "other") continue;

          const state = j.replace("us_", "").toUpperCase();
          signals.push({
            external_id: `oc:${j}:${c.company_number}`,
            source: "businessregistry",
            source_url: c.opencorporates_url,
            source_post_content: [
              `${c.name} — newly registered ${c.company_type} in ${state}`,
              `Incorporated: ${c.incorporation_date}`,
              `Address: ${c.registered_address_in_full ?? "not listed"}`,
              "",
              `Signal: brand-new ${vertical === "junk_removal" ? "junk removal / hauling" : "real estate"} entity with a legal address and almost certainly zero marketing infrastructure.`,
            ].join("\n"),
            source_post_at: c.incorporation_date,
            company_name: c.name,
            location: c.registered_address_in_full ?? `${state}`,
            matched_keywords: [
              "new business",
              "just registered",
              vertical === "junk_removal" ? "junk removal" : "real estate",
            ],
            intent_signal: `Newly registered ${c.company_type} in ${state}: ${c.name} — no marketing presence yet`,
            intent_category: "launching",
            raw: {
              vertical,
              jurisdiction: j,
              state,
              company_number: c.company_number,
              status: c.current_status,
              incorporation_date: c.incorporation_date,
              search_term: term,
            },
          });
        }
        await new Promise((r) => setTimeout(r, 700));
      } catch (err) {
        console.error(`[businessRegistry] error for ${j}/${term}:`, err);
      }
    }
  }

  return signals;
}
