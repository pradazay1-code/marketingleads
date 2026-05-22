import { db, log } from "./db";
import type { RawSignal, Lead } from "./types";
import { detectState, isEastCoast } from "./keywords";
import { preScore } from "./scoring/leadScorer";
import { researchLead } from "./research/claudeResearch";
import { notifyBatch } from "./notify";

import { fetchRedditSignals } from "./sources/reddit";
import { fetchHackerNewsSignals } from "./sources/hackernews";
import { fetchGoogleSignals } from "./sources/googleSearch";
import { fetchTwitterSignals } from "./sources/twitter";
import { fetchIndeedSignals } from "./sources/indeed";
import { fetchProductHuntSignals } from "./sources/producthunt";
import { fetchIndieHackersSignals } from "./sources/indiehackers";
import { fetchBusinessRegistrySignals } from "./sources/businessRegistry";

const PRE_RESEARCH_THRESHOLD = 25; // pre-score must clear this to enter research queue
const QUALIFIED_THRESHOLD = 65;    // post-research score required to notify

interface SourceTask {
  name: string;
  fn: () => Promise<RawSignal[]>;
}

const SOURCES: SourceTask[] = [
  { name: "reddit", fn: fetchRedditSignals },
  { name: "hackernews", fn: fetchHackerNewsSignals },
  { name: "google", fn: fetchGoogleSignals },
  { name: "twitter", fn: fetchTwitterSignals },
  { name: "indeed", fn: fetchIndeedSignals },
  { name: "producthunt", fn: fetchProductHuntSignals },
  { name: "indiehackers", fn: fetchIndieHackersSignals },
  { name: "businessregistry", fn: fetchBusinessRegistrySignals },
];

export async function runLeadGenerationCycle(): Promise<{
  runId: string;
  leadsCreated: number;
  leadsResearched: number;
  leadsQualified: number;
  leadsNotified: number;
}> {
  // Create a generation_runs row to track this batch
  const { data: runRow, error: runErr } = await db()
    .from("generation_runs")
    .insert({
      status: "running",
      sources_attempted: SOURCES.map((s) => s.name),
    })
    .select("id")
    .single();
  if (runErr || !runRow) throw new Error(`Failed to create run: ${runErr?.message}`);
  const runId = runRow.id as string;
  await log("info", "run_started", `Lead generation cycle starting`, { runId });

  // --- Phase 1: fetch from all sources in parallel ---
  const sourcesSucceeded: string[] = [];
  const sourceErrors: Record<string, string> = {};

  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const signals = await s.fn();
        sourcesSucceeded.push(s.name);
        await db()
          .from("sources")
          .update({
            last_run_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("type", s.name);
        return signals;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sourceErrors[s.name] = msg;
        await log("error", "source_failed", `${s.name}: ${msg}`);
        return [] as RawSignal[];
      }
    })
  );

  const allSignals = results.flat();
  await log("info", "signals_fetched", `Fetched ${allSignals.length} raw signals`, {
    counts: Object.fromEntries(SOURCES.map((s, i) => [s.name, results[i].length])),
  });

  // --- Phase 2: dedupe and pre-score ---
  const { data: existing } = await db()
    .from("leads")
    .select("external_id")
    .in(
      "external_id",
      allSignals.map((s) => s.external_id)
    );
  const existingIds = new Set((existing ?? []).map((r: { external_id: string }) => r.external_id));

  const newSignals = allSignals.filter((s) => !existingIds.has(s.external_id));

  const toInsert = newSignals
    .map((s) => {
      const state = detectState(`${s.source_post_content} ${s.location ?? ""}`);
      const score = preScore(s, state);
      return { signal: s, state, score };
    })
    .filter((x) => x.score >= PRE_RESEARCH_THRESHOLD);

  // Insert as 'pending' leads
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
    research_status: "pending" as const,
    status: "new" as const,
  }));

  let inserted: Lead[] = [];
  if (inserts.length > 0) {
    const { data, error } = await db()
      .from("leads")
      .upsert(inserts, { onConflict: "external_id", ignoreDuplicates: false })
      .select("*");
    if (error) {
      await log("error", "insert_failed", error.message);
    } else {
      inserted = (data ?? []) as Lead[];
    }
  }

  await log("info", "leads_inserted", `${inserted.length} new leads queued for research`);

  // --- Phase 3: research each new lead via Claude ---
  // Cap at 15 per cycle to control API spend & runtime
  const RESEARCH_CAP = 15;
  const toResearch = inserted
    .sort((a, b) => b.lead_score - a.lead_score)
    .slice(0, RESEARCH_CAP);

  let researched = 0;
  let qualified = 0;
  const qualifiedLeads: Lead[] = [];

  for (const lead of toResearch) {
    try {
      await db()
        .from("leads")
        .update({ research_status: "in_progress" })
        .eq("id", lead.id);

      const r = await researchLead(lead);

      const updated: Partial<Lead> = {
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
        research_data: r as unknown as Record<string, unknown>,
        pain_points: r.pain_points,
        buying_signals: r.buying_signals,
        recommended_services: r.recommended_services,
        outreach_angle: r.outreach_angle,
        lead_score: r.lead_score,
        score_breakdown: r.score_breakdown as unknown as Record<string, unknown>,
        last_researched_at: new Date().toISOString(),
      };

      await db().from("leads").update(updated).eq("id", lead.id);
      await db().from("lead_activities").insert({
        lead_id: lead.id,
        type: "research_update",
        title: "AI research completed",
        content: r.summary,
        metadata: r as unknown as Record<string, unknown>,
      });

      researched++;
      if (r.lead_score >= QUALIFIED_THRESHOLD) {
        qualified++;
        qualifiedLeads.push({ ...lead, ...updated } as Lead);
      }

      // pace API calls
      await new Promise((res) => setTimeout(res, 600));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db()
        .from("leads")
        .update({ research_status: "failed", research_summary: `Error: ${msg}` })
        .eq("id", lead.id);
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
  await db()
    .from("generation_runs")
    .update({
      completed_at: new Date().toISOString(),
      status: "completed",
      sources_succeeded: sourcesSucceeded,
      raw_signals_found: allSignals.length,
      leads_created: inserted.length,
      leads_researched: researched,
      leads_qualified: qualified,
      notification_sent: notifiedCount > 0,
      errors: Object.keys(sourceErrors).length ? sourceErrors : null,
    })
    .eq("id", runId);

  await log("info", "run_completed", `Cycle done: ${inserted.length} new, ${researched} researched, ${qualified} qualified, ${notifiedCount} notified`);

  return {
    runId,
    leadsCreated: inserted.length,
    leadsResearched: researched,
    leadsQualified: qualified,
    leadsNotified: notifiedCount,
  };
}

/**
 * Between 4-hour batches, continuously research any leads still pending.
 * Runs every 30 minutes.
 */
export async function runDeepResearchCycle(): Promise<{ researched: number }> {
  const { data: pending, error } = await db()
    .from("leads")
    .select("*")
    .eq("research_status", "pending")
    .order("lead_score", { ascending: false })
    .limit(5);
  if (error || !pending || pending.length === 0) return { researched: 0 };

  let researched = 0;
  for (const lead of pending as Lead[]) {
    try {
      await db().from("leads").update({ research_status: "in_progress" }).eq("id", lead.id);
      const r = await researchLead(lead);
      await db()
        .from("leads")
        .update({
          company_name: r.company_name ?? lead.company_name,
          person_name: r.person_name ?? lead.person_name,
          website: r.website ?? lead.website,
          industry: r.industry ?? lead.industry,
          state: r.state ?? lead.state,
          is_east_coast: isEastCoast(r.state ?? lead.state),
          research_status: "completed",
          research_summary: r.summary,
          research_data: r as unknown as Record<string, unknown>,
          pain_points: r.pain_points,
          buying_signals: r.buying_signals,
          recommended_services: r.recommended_services,
          outreach_angle: r.outreach_angle,
          lead_score: r.lead_score,
          score_breakdown: r.score_breakdown as unknown as Record<string, unknown>,
          last_researched_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
      await db().from("lead_activities").insert({
        lead_id: lead.id,
        type: "research_update",
        title: "Background research completed",
        content: r.summary,
      });
      researched++;
      await new Promise((res) => setTimeout(res, 800));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db()
        .from("leads")
        .update({ research_status: "failed", research_summary: `Error: ${msg}` })
        .eq("id", lead.id);
      await log("error", "deep_research_failed", msg, { lead_id: lead.id });
    }
  }
  await log("info", "deep_research_done", `Researched ${researched} leads in background tick`);
  return { researched };
}
