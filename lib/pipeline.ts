import { db, log, insertRow, updateRow, bulkUpsert } from "./db";
import type { RawSignal, Lead, GenerationRun } from "./types";
import { detectState, isEastCoast } from "./keywords";
import { preScore } from "./scoring/leadScorer";
import { researchLead } from "./research/aiResearch";
import { enrichLead } from "./research/enrichment";
import { scoreContactability, CONTACTABILITY_THRESHOLD } from "./quality/contactability";
import { classifyVertical, type Vertical } from "./verticals";
import { geocodeAddress, isMapboxEnabled } from "./mapping/mapbox";
import { notifyBatch } from "./notify";
import { seedSampleLeadsIfEmpty } from "./seed";

import { fetchGoogleMapsSignals } from "./sources/googleMaps";
import { fetchFirecrawlProspects } from "./sources/firecrawlProspector";
import { fetchRedditSignals } from "./sources/reddit";
import { fetchRedditSearchSignals } from "./sources/redditEnhanced";
import { fetchIndeedSignals } from "./sources/indeed";
import { fetchBusinessRegistrySignals } from "./sources/businessRegistry";
import { fetchGoogleSignals } from "./sources/googleSearch";
import { fetchTwitterSignals } from "./sources/twitter";

const PRE_RESEARCH_THRESHOLD = 25;
const QUALIFIED_THRESHOLD = 65;
/** Anything the AI classifies outside our two verticals never gets notified */
const ALLOWED_VERTICALS: Vertical[] = ["junk_removal", "real_estate"];

interface SourceTask {
  name: string;
  fn: () => Promise<RawSignal[]>;
}

const SOURCES: SourceTask[] = [
  // Verified-business sources first — these already carry name/phone/website
  { name: "googlemaps", fn: fetchGoogleMapsSignals },
  { name: "firecrawl", fn: fetchFirecrawlProspects },
  { name: "indeed", fn: fetchIndeedSignals },
  { name: "businessregistry", fn: fetchBusinessRegistrySignals },
  // Intent-signal sources — need enrichment to become contactable
  { name: "reddit", fn: fetchRedditSignals },
  { name: "reddit", fn: fetchRedditSearchSignals },
  { name: "google", fn: fetchGoogleSignals },
  { name: "twitter", fn: fetchTwitterSignals },
];

export interface CycleResult {
  runId: string;
  signalsFound: number;
  enrichmentAttempted: number;
  rejectedUncontactable: number;
  rejectedOffVertical: number;
  leadsCreated: number;
  leadsGeocoded: number;
  leadsResearched: number;
  leadsQualified: number;
  leadsNotified: number;
  seeded: boolean;
}

export async function runLeadGenerationCycle(): Promise<CycleResult> {
  const sql = db();
  const seeded = await seedSampleLeadsIfEmpty();

  const run = await insertRow<GenerationRun>("generation_runs", {
    status: "running",
    sources_attempted: SOURCES.map((s) => s.name),
  });
  const runId = run.id;
  await log("info", "run_started", "Lead generation cycle starting", { runId, seeded });

  // ── Phase 1: fetch all sources in parallel ─────────────────────────
  const sourcesSucceeded: string[] = [];
  const sourceErrors: Record<string, string> = {};

  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const signals = await s.fn();
        if (!sourcesSucceeded.includes(s.name)) sourcesSucceeded.push(s.name);
        await sql`
          UPDATE sources SET last_run_at = now(), last_success_at = now(), last_error = NULL
          WHERE type = ${s.name}
        `;
        return { name: s.name, signals };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceErrors[s.name] = msg;
        await sql`UPDATE sources SET last_run_at = now(), last_error = ${msg} WHERE type = ${s.name}`;
        await log("error", "source_failed", `${s.name}: ${msg}`);
        return { name: s.name, signals: [] as RawSignal[] };
      }
    })
  );

  const allSignals = results.flatMap((r) => r.signals);
  await log("info", "signals_fetched", `Fetched ${allSignals.length} raw signals`, {
    counts: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.name] = (acc[r.name] ?? 0) + r.signals.length;
      return acc;
    }, {}),
  });

  // ── Phase 2: dedupe + vertical gate + pre-score ────────────────────
  const externalIds = allSignals.map((s) => s.external_id);
  let existingIds = new Set<string>();
  if (externalIds.length > 0) {
    const existing = (await sql`
      SELECT external_id FROM leads WHERE external_id = ANY(${externalIds})
    `) as Array<{ external_id: string }>;
    existingIds = new Set(existing.map((r) => r.external_id));
  }
  const newSignals = allSignals.filter((s) => !existingIds.has(s.external_id));

  let rejectedOffVertical = 0;
  const verticalFiltered = newSignals.filter((s) => {
    const v = classifyVertical(
      `${s.company_name ?? ""} ${s.source_post_content} ${s.intent_signal} ${(s.matched_keywords ?? []).join(" ")}`
    );
    if (v === "other") {
      rejectedOffVertical++;
      return false;
    }
    return true;
  });

  const ENRICH_CAP = 60;
  const triaged = verticalFiltered
    .map((s) => {
      const state = detectState(`${s.source_post_content} ${s.location ?? ""}`);
      return { signal: s, state, preScore: preScore(s, state) };
    })
    .filter((x) => x.preScore >= PRE_RESEARCH_THRESHOLD)
    .sort((a, b) => b.preScore - a.preScore)
    .slice(0, ENRICH_CAP);

  await log(
    "info",
    "triage_complete",
    `${triaged.length} signals to enrich (${rejectedOffVertical} rejected as off-vertical)`
  );

  // ── Phase 3: enrichment + contactability gate + geocoding ──────────
  let enrichmentAttempted = 0;
  let rejectedUncontactable = 0;
  let leadsGeocoded = 0;

  type Candidate = {
    signal: RawSignal;
    state: string | null;
    preScore: number;
    enrichment: Awaited<ReturnType<typeof enrichLead>>;
    contactability: ReturnType<typeof scoreContactability>;
    vertical: Vertical;
    geo: Awaited<ReturnType<typeof geocodeAddress>>;
  };
  const insertCandidates: Candidate[] = [];

  const CONCURRENCY = 4;
  for (let i = 0; i < triaged.length; i += CONCURRENCY) {
    const batch = triaged.slice(i, i + CONCURRENCY);
    const enriched = await Promise.all(
      batch.map(async ({ signal, state, preScore }) => {
        enrichmentAttempted++;
        try {
          const enrichment = await enrichLead({
            website: signal.website,
            source_url: signal.source_url,
            company_name: signal.company_name,
            person_name: signal.person_name,
            location: signal.location ?? state ?? undefined,
          });

          const merged: Partial<Lead> = {
            source: signal.source,
            company_name: signal.company_name,
            person_name: signal.person_name ?? enrichment.owner_name ?? null,
            email: signal.email ?? enrichment.best_email ?? null,
            phone: signal.phone ?? enrichment.best_phone ?? null,
            website: signal.website ?? enrichment.website ?? null,
            linkedin_url: signal.linkedin_url ?? enrichment.linkedin_company_url ?? null,
            location: signal.location ?? state ?? null,
          };
          const contactability = scoreContactability(merged);
          const vertical = classifyVertical(
            `${signal.company_name ?? ""} ${signal.source_post_content} ${(enrichment.services_offered ?? []).join(" ")}`
          );

          // Geocode if we have an address-like location and Mapbox is on
          let geo: Awaited<ReturnType<typeof geocodeAddress>> = null;
          const rawLat = (signal.raw?.latitude as number | undefined) ?? undefined;
          const rawLng = (signal.raw?.longitude as number | undefined) ?? undefined;
          if (rawLat !== undefined && rawLng !== undefined) {
            // Google Places already gave us coordinates — no geocode call needed
            geo = {
              latitude: rawLat,
              longitude: rawLng,
              formatted_address: signal.location ?? "",
              city: null,
              state: state,
              postcode: null,
              country: "us",
              confidence: "exact",
            };
          } else if (isMapboxEnabled() && signal.location && signal.location.length > 6) {
            geo = await geocodeAddress(signal.location);
          }

          return { signal, state, preScore, enrichment, contactability, vertical, geo };
        } catch (err) {
          await log("warn", "enrichment_failed", err instanceof Error ? err.message : String(err), {
            external_id: signal.external_id,
          });
          return null;
        }
      })
    );

    for (const item of enriched) {
      if (!item) continue;
      if (item.contactability.passes_gate) {
        if (item.geo) leadsGeocoded++;
        insertCandidates.push(item);
      } else {
        rejectedUncontactable++;
        await sql`
          INSERT INTO system_log (level, event, message, metadata)
          VALUES ('info', 'rejected_uncontactable',
            ${`${item.signal.source}: ${item.signal.company_name ?? item.signal.person_name ?? "unknown"}`},
            ${JSON.stringify({
              external_id: item.signal.external_id,
              contactability_score: item.contactability.score,
              missing: item.contactability.missing,
            })}
          )
        `;
      }
    }
  }

  await log(
    "info",
    "gate_applied",
    `${insertCandidates.length} passed contactability; ${rejectedUncontactable} rejected`,
    { threshold: CONTACTABILITY_THRESHOLD }
  );

  // ── Phase 4: insert ────────────────────────────────────────────────
  const inserts = insertCandidates.map(
    ({ signal, state, preScore, enrichment, contactability, vertical, geo }) => ({
      external_id: signal.external_id,
      source: signal.source,
      source_url: signal.source_url,
      source_post_content: signal.source_post_content,
      source_post_at: signal.source_post_at ?? null,
      person_name: signal.person_name ?? enrichment.owner_name ?? null,
      company_name: signal.company_name ?? null,
      email: signal.email ?? enrichment.best_email ?? null,
      phone: signal.phone ?? enrichment.best_phone ?? null,
      website: signal.website ?? enrichment.website ?? null,
      linkedin_url: signal.linkedin_url ?? enrichment.linkedin_company_url ?? null,
      location: signal.location ?? state ?? null,
      state: geo?.state ?? state,
      is_east_coast: isEastCoast(geo?.state ?? state),
      industry: enrichment.industry_hint ?? null,
      company_size: enrichment.company_size_hint ?? null,
      vertical,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      geocoded_address: geo?.formatted_address ?? null,
      matched_keywords: signal.matched_keywords,
      intent_signal: signal.intent_signal,
      intent_category: signal.intent_category ?? null,
      lead_score: preScore,
      research_status: "pending",
      status: "new",
      contactability_score: contactability.score,
      has_email: contactability.has_email,
      has_phone: contactability.has_phone,
      has_website: contactability.has_website,
      has_linkedin: contactability.has_linkedin,
      contact_emails: enrichment.contact_emails ?? null,
      contact_phones: enrichment.contact_phones ?? null,
      email_confidence: enrichment.email_confidence ?? null,
      best_email: enrichment.best_email ?? null,
      best_phone: enrichment.best_phone ?? null,
      tech_stack: enrichment.tech_stack_hints ?? null,
      social_links: enrichment.social_links ?? null,
      domain_age_estimate: enrichment.domain_age_estimate ?? null,
      uses_lead_marketplace: enrichment.uses_lead_marketplace ?? null,
      services_offered: enrichment.services_offered ?? null,
    })
  );

  let inserted: Lead[] = [];
  if (inserts.length > 0) {
    try {
      inserted = await bulkUpsert<Lead>("leads", inserts, "external_id");
    } catch (err) {
      await log("error", "insert_failed", err instanceof Error ? err.message : String(err));
    }
  }

  // ── Phase 5: AI research ───────────────────────────────────────────
  const RESEARCH_CAP = 15;
  const toResearch = inserted
    .sort(
      (a, b) =>
        b.lead_score + b.contactability_score - (a.lead_score + a.contactability_score)
    )
    .slice(0, RESEARCH_CAP);

  let researched = 0;
  let qualified = 0;
  const qualifiedLeads: Lead[] = [];

  for (const lead of toResearch) {
    try {
      await sql`UPDATE leads SET research_status = 'in_progress' WHERE id = ${lead.id}`;
      const r = await researchLead(lead);

      const updated = {
        vertical: r.vertical,
        company_name: r.company_name ?? lead.company_name,
        person_name: r.person_name ?? lead.person_name,
        website: r.website ?? lead.website,
        industry: r.industry ?? lead.industry,
        company_size: r.company_size ?? lead.company_size,
        location: r.location ?? lead.location,
        state: r.state ?? lead.state,
        is_east_coast: isEastCoast(r.state ?? lead.state),
        research_status: "completed",
        research_summary: r.summary,
        research_data: r,
        pain_points: r.pain_points,
        buying_signals: r.buying_signals,
        recommended_services: r.recommended_services,
        outreach_angle: r.outreach_angle,
        outreach_email_draft: r.outreach_email_draft,
        outreach_dm_draft: r.outreach_dm_draft,
        outreach_phone_script: r.outreach_phone_script,
        estimated_monthly_value: r.estimated_monthly_value,
        next_actions: r.next_actions,
        tech_stack: r.enrichment?.tech_stack ?? lead.tech_stack,
        social_links: r.enrichment?.social_links ?? lead.social_links,
        domain_age_estimate: r.enrichment?.domain_age_estimate ?? lead.domain_age_estimate,
        lead_score: r.lead_score,
        score_breakdown: r.score_breakdown,
        last_researched_at: new Date().toISOString(),
      };

      const updatedLead = await updateRow<Lead>("leads", lead.id, updated);
      await insertRow("lead_activities", {
        lead_id: lead.id,
        type: "research_update",
        title: "AI research completed",
        content: r.summary,
        metadata: r,
      });

      researched++;
      // Only notify on in-vertical leads that clear the score bar
      if (
        r.lead_score >= QUALIFIED_THRESHOLD &&
        ALLOWED_VERTICALS.includes(r.vertical) &&
        updatedLead
      ) {
        qualified++;
        qualifiedLeads.push(updatedLead);
      }
      await new Promise((res) => setTimeout(res, 600));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`
        UPDATE leads SET research_status = 'failed', research_summary = ${`Error: ${msg}`}
        WHERE id = ${lead.id}
      `;
      await log("error", "research_failed", msg, { lead_id: lead.id });
    }
  }

  // ── Phase 6: notify ────────────────────────────────────────────────
  let notifiedCount = 0;
  if (qualifiedLeads.length > 0) {
    const batchId = crypto.randomUUID();
    const result = await notifyBatch({ leads: qualifiedLeads, batchId, runId });
    notifiedCount = qualifiedLeads.length;
    await log("info", "notified", `${notifiedCount} leads notified`, result);
  }

  await updateRow("generation_runs", runId, {
    completed_at: new Date().toISOString(),
    status: "completed",
    sources_succeeded: sourcesSucceeded,
    raw_signals_found: allSignals.length,
    leads_created: inserted.length,
    leads_researched: researched,
    leads_qualified: qualified,
    notification_sent: notifiedCount > 0,
    errors: Object.keys(sourceErrors).length ? sourceErrors : null,
    metadata: {
      enrichment_attempted: enrichmentAttempted,
      rejected_uncontactable: rejectedUncontactable,
      rejected_off_vertical: rejectedOffVertical,
      leads_geocoded: leadsGeocoded,
      contactability_threshold: CONTACTABILITY_THRESHOLD,
    },
  });

  await log(
    "info",
    "run_completed",
    `${allSignals.length} signals → ${rejectedOffVertical} off-vertical → ${enrichmentAttempted} enriched → ${rejectedUncontactable} unreachable → ${inserted.length} saved → ${researched} researched → ${qualified} qualified → ${notifiedCount} notified`
  );

  return {
    runId,
    signalsFound: allSignals.length,
    enrichmentAttempted,
    rejectedUncontactable,
    rejectedOffVertical,
    leadsCreated: inserted.length,
    leadsGeocoded,
    leadsResearched: researched,
    leadsQualified: qualified,
    leadsNotified: notifiedCount,
    seeded,
  };
}

/** Background worker: research pending leads + backfill missing geocodes. */
export async function runDeepResearchCycle(): Promise<{ researched: number; geocoded: number }> {
  const sql = db();
  let geocoded = 0;

  // Backfill geocoding for leads that have an address but no coordinates
  if (isMapboxEnabled()) {
    const needsGeo = (await sql`
      SELECT id, location, geocoded_address FROM leads
      WHERE latitude IS NULL AND location IS NOT NULL AND length(location) > 6
      ORDER BY lead_score DESC
      LIMIT 15
    `) as Array<{ id: string; location: string }>;
    for (const row of needsGeo) {
      const geo = await geocodeAddress(row.location);
      if (geo) {
        await sql`
          UPDATE leads
          SET latitude = ${geo.latitude}, longitude = ${geo.longitude},
              geocoded_address = ${geo.formatted_address}
          WHERE id = ${row.id}
        `;
        geocoded++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const pending = (await sql`
    SELECT * FROM leads
    WHERE research_status = 'pending'
    ORDER BY (lead_score + contactability_score) DESC
    LIMIT 5
  `) as Lead[];
  if (pending.length === 0) return { researched: 0, geocoded };

  let researched = 0;
  for (const lead of pending) {
    try {
      await sql`UPDATE leads SET research_status = 'in_progress' WHERE id = ${lead.id}`;
      const r = await researchLead(lead);
      await updateRow("leads", lead.id, {
        vertical: r.vertical,
        company_name: r.company_name ?? lead.company_name,
        person_name: r.person_name ?? lead.person_name,
        website: r.website ?? lead.website,
        industry: r.industry ?? lead.industry,
        state: r.state ?? lead.state,
        is_east_coast: isEastCoast(r.state ?? lead.state),
        research_status: "completed",
        research_summary: r.summary,
        research_data: r,
        pain_points: r.pain_points,
        buying_signals: r.buying_signals,
        recommended_services: r.recommended_services,
        outreach_angle: r.outreach_angle,
        outreach_email_draft: r.outreach_email_draft,
        outreach_dm_draft: r.outreach_dm_draft,
        outreach_phone_script: r.outreach_phone_script,
        estimated_monthly_value: r.estimated_monthly_value,
        next_actions: r.next_actions,
        lead_score: r.lead_score,
        score_breakdown: r.score_breakdown,
        last_researched_at: new Date().toISOString(),
      });
      await insertRow("lead_activities", {
        lead_id: lead.id,
        type: "research_update",
        title: "Background research completed",
        content: r.summary,
      });
      researched++;
      await new Promise((res) => setTimeout(res, 800));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`
        UPDATE leads SET research_status = 'failed', research_summary = ${`Error: ${msg}`}
        WHERE id = ${lead.id}
      `;
      await log("error", "deep_research_failed", msg, { lead_id: lead.id });
    }
  }
  await log("info", "deep_research_done", `Researched ${researched}, geocoded ${geocoded}`);
  return { researched, geocoded };
}
