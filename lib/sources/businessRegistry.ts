import * as cheerio from "cheerio";
import type { RawSignal } from "../types";

/**
 * NEWLY-REGISTERED businesses — they have funding, intent, and zero marketing infrastructure.
 *
 * State business filing offices publish daily/weekly registrations. Each state's API
 * is different; we provide adapters for the highest-value East Coast states.
 *
 * Strategy: hit OpenCorporates' free tier (limited but works) for cross-state new entities.
 * For production scale, the user can sign up for state-level API access.
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
  results?: {
    companies: OCCompany[];
  };
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

export async function fetchBusinessRegistrySignals(): Promise<RawSignal[]> {
  const apiToken = process.env.OPENCORPORATES_API_TOKEN; // optional, raises limits
  const signals: RawSignal[] = [];
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateRange = `${thirtyDaysAgo.toISOString().slice(0, 10)}:${today
    .toISOString()
    .slice(0, 10)}`;

  for (const j of EAST_COAST_JURISDICTIONS) {
    try {
      const params = new URLSearchParams({
        jurisdiction_code: j,
        incorporation_date: dateRange,
        per_page: "30",
        order: "incorporation_date",
        sort_order: "desc",
      });
      if (apiToken) params.set("api_token", apiToken);

      const url = `https://api.opencorporates.com/v0.4/companies/search?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[businessRegistry] ${res.status} for ${j}`);
        continue;
      }
      const data = (await res.json()) as OCResponse;

      for (const item of data.results?.companies ?? []) {
        const c = item.company;
        const state = j.replace("us_", "").toUpperCase();
        signals.push({
          external_id: `oc:${j}:${c.company_number}`,
          source: "businessregistry",
          source_url: c.opencorporates_url,
          source_post_content: `${c.name} — newly registered ${c.company_type} in ${state}, incorporated ${c.incorporation_date}. Address: ${c.registered_address_in_full ?? "N/A"}`,
          source_post_at: c.incorporation_date,
          company_name: c.name,
          location: c.registered_address_in_full ?? undefined,
          matched_keywords: ["new business"],
          intent_signal: `Newly registered ${c.company_type} in ${state}: ${c.name}`,
          intent_category: "launching",
          raw: {
            jurisdiction: j,
            state,
            company_number: c.company_number,
            status: c.current_status,
            incorporation_date: c.incorporation_date,
          },
        });
      }
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      console.error(`[businessRegistry] error for ${j}:`, err);
    }
  }

  return signals;
}
