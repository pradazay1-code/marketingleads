import { db, log, insertRow, updateRow, updateRowsByIds, bulkUpsert } from "./db";
import type { RawSignal, Lead, GenerationRun } from "./types";
import { detectState, isEastCoast } from "./keywords";
import { preScore } from "./scoring/leadScorer";
import { researchLead } from "./research/aiResearch";
import { notifyBatch } from "./notify";
import { seedSampleLeadsIfEmpty } from "./seed";

import { fetchRedditSignals } from "./sources/reddit";
import { fetchRedditSearchSignals } from "./sources/redditEnhanced";
import { fetchHackerNewsSignals } from "./sources/hackernews";
import { fetchGoogleSignals } from "./sources/googleSearch";
import { fetchTwitterSignals } from "./sources/twitter";
import { fetchIndeedSignals } from "./sources/indeed";
import { fetchProductHuntSignals } from "./sources/producthunt";
import { fetchIndieHackersSignals } from "./sources/indiehackers";
import { fetchBusinessRegistrySignals } from "./sources/businessRegistry";
import { fetchBlueskySignals } from "./sources/bluesky";
import { fetchGithubSignals } from "./sources/github";
import { fetchStackExchangeSignals } from "./sources/stackexchange";
import { fetchDevToSignals } from "./sources/devto";
import { fetchLobstersSignals } from "./sources/lobsters";
import { fetchYCSignals } from "./sources/yCombinator";

const PRE_RESEARCH_THRESHOLD = 25;
const QUALIFIED_THRESHOLD = 65;

interface SourceTask {
  name: string;
  fn: () => Promise<RawSignal[]>;
}

const SOURCES: SourceTask[] = [
  { name: "reddit", fn: fetchRedditSignals },
  { name: "reddit_search", fn: fetchRedditSearchSignals },
  { name: "hackernews", fn: fetchHackerNewsSignals },
  { name: "google", fn: fetchGoogleSignals },
  { name: "twitter", fn: fetchTwitterSignals },
  { name: "indeed", fn: fetchIndeedSignals },
  { name: "producthunt", fn: fetchProductHuntSignals },
  { name: "indiehackers", fn: fetchIndieHackersSignals },
  { name: "businessregistry", fn: fetchBusinessRegistrySignals },
  { name: "bluesky", fn: fetchBlueskySignals },
  { name: "github", fn: fetchGithubSignals },
  { name: "stackexchange", fn: fetchStackExchangeSignals },
  { name: "devto", fn: fetchDevToSignals },
  { name: "lobsters", fn: fetchLobstersSignals },
  { name: "ycombinator", fn: fetchYCSignals },
];

export async function runLeadGenerationCycle(): Promise<{
  runId: string;
  leadsCreated: number;
  leadsResearched: number;
  leadsQualified: number;
  leadsNotified: number;
  seeded: boolean;
}> {
  const sql = db();

  // Seed sample leads on the very first run so the dashboard is never empty
  const seeded = await seedSampleLeadsIfEmpty();

  // Create a generation_runs row
  const run = await insertRow<GenerationRun>("generation_runs", {
    status: "running",
    sources_attempted: SOURCES.map((s) => s.name),
  });
  const runId = run.id;
  await log("info", "run_started", `Lead generation cycle starting`, { runId, seeded });

  // --- Phase 1: fetch from all sources in parallel ---
  const sourcesSucceeded: string[] = [];
  const sourceErrors: Record<string, string> = {};

  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const signals = await s.fn();
        sourcesSucceeded.push(s.name);
        await sql`
          UPDATE sources
          SET last_run_at = now(),
              last_success_at = now(),
              last_error = NULL
          WHERE type = ${s.name}
        `;
        return signals;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceErrors[s.name] = msg;
        await sql`
          UPDATE sources
          SET last_run_at = now(),
              last_error = ${msg}
          WHERE type = ${s.name}
        `;
        await log("error", "source_failed", `${s.name}: ${msg}`);
        return [] as RawSignal[];
      }
    })
  );

  const allSignals = results.flat();
  await log("info", "signals_fetched", `Fetched ${allSignals.length} raw signals`, {
    counts: Object.fromEntries(SOURCES.map((s, i) => [s.name, results[i].length])),
  });

  // --- Phase 2: dedupe + pre-score ---
  const externalIds = allSignals.map((s) => s.external_id);
  let existingIds = new Set<string>();
  if (externalIds.length > 0) {
    const existing = (await sql`
      SELECT external_id FROM leads WHERE external_id = ANY(${externalIds})
    `) as Array<{ external_id: string }>;
    existingIds = new Set(existing.map((r) => r.external_id));
  }

  const newSignals = allSignals.filter((s) => !existingIds.has(s.external_id));

  const toInsert = newSignals
    .map((s) => {
      const state = detectState(`${s.source_post_content} ${s.location ?? ""}`);
      const score = preScore(s, state);
      return { signal: s, state, score };
    })
    .filter((x) => x.score >= PRE_RESEARCH_THRESHOLD);

  const inserts = toInsert.map(({ signal, state, score }) => ({
    external_id: signal.external_id,
    source: signal.source,
    source_url: signal.source_url,
    source_post_content: signal.source_post_content,
    source_post_at: signal.source_post_at ?? null,
    person_name: signal.person_name ?? null,
    company_name: signal.company_name ?? null,
    location: signal.location ?? null,
    state,
    is_east_coast: isEastCoast(state),
    matched_keywords: signal.matched_keywords,
    intent_signal: signal.intent_signal,
    intent_category: signal.intent_category ?? null,
    lead_score: score,
    research_status: "pending",
    status: "new",
  }));

  let inserted: Lead[] = [];
  if (inserts.length > 0) {
    try {
      inserted = await bulkUpsert<Lead>("leads", inserts, "external_id");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log("error", "insert_failed", msg);
    }
  }

  await log("info", "leads_inserted", `${inserted.length} new leads queued for research`);

  // --- Phase 3: research the top leads with Gemini/Groq ---
  const RESEARCH_CAP = 15;
  const toResearch = inserted
    .sort((a, b) => b.lead_score - a.lead_score)
    .slice(0, RESEARCH_CAP);

  let researched = 0;
  let qualified = 0;
  const qualifiedLeads: Lead[] = [];

  for (const lead of toResearch) {
    try {
      await sql`UPDATE leads SET research_status = 'in_progress' WHERE id = ${lead.id}`;
      const r = await researchLead(lead);

      const updated = {
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
        next_actions: r.next_actions,
        tech_stack: r.enrichment?.tech_stack ?? null,
        social_links: r.enrichment?.social_links ?? null,
        domain_age_estimate: r.enrichment?.domain_age_estimate ?? null,
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
      if (r.lead_score >= QUALIFIED_THRESHOLD && updatedLead) {
        qualified++;
        qualifiedLeads.push(updatedLead);
      }
      await new Promise((res) => setTimeout(res, 600));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sql`
        UPDATE leads
        SET research_status = 'failed', research_summary = ${`Error: ${msg}`}
        WHERE id = ${lead.id}
      `;
      await log("error", "research_failed", msg, { lead_id: lead.id });
    }
  }

  // --- Phase 4: notify ---
  let notifiedCount = 0;
  if (qualifiedLeads.length > 0) {
    const batchId = crypto.randomUUID();
    const result = await notifyBatch({ leads: qualifiedLeads, batchId, runId });
    notifiedCount = qualifiedLeads.length;
    await log("info", "notified", `${notifiedCount} leads notified`, result);
  }

  // --- Finalize run ---
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
  });

  await log(
    "info",
    "run_completed",
    `Cycle done: ${inserted.length} new, ${researched} researched, ${qualified} qualified, ${notifiedCount} notified`
  );

  return {
    runId,
    leadsCreated: inserted.length,
    leadsResearched: researched,
    leadsQualified: qualified,
    leadsNotified: notifiedCount,
    seeded,
  };
}

/**
 * Between 4-hour batches, continuously research any leads still pending.
 * Runs every 30 minutes.
 */
export async function runDeepResearchCycle(): Promise<{ researched: number }> {
  const sql = db();
  const pending = (await sql`
    SELECT * FROM leads
    WHERE research_status = 'pending'
    ORDER BY lead_score DESC
    LIMIT 5
  `) as Lead[];
  if (pending.length === 0) return { researched: 0 };

  let researched = 0;
  for (const lead of pending) {
    try {
      await sql`UPDATE leads SET research_status = 'in_progress' WHERE id = ${lead.id}`;
      const r = await researchLead(lead);
      await updateRow("leads", lead.id, {
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
        next_actions: r.next_actions,
        tech_stack: r.enrichment?.tech_stack ?? null,
        social_links: r.enrichment?.social_links ?? null,
        domain_age_estimate: r.enrichment?.domain_age_estimate ?? null,
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
        UPDATE leads
        SET research_status = 'failed', research_summary = ${`Error: ${msg}`}
        WHERE id = ${lead.id}
      `;
      await log("error", "deep_research_failed", msg, { lead_id: lead.id });
    }
  }
  await log("info", "deep_research_done", `Researched ${researched} leads in background tick`);
  return { researched };
}

// Re-export for callers
export { updateRowsByIds };
