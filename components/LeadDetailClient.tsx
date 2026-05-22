"use client";

import { useState } from "react";
import type { Lead, Activity, Opportunity } from "@/lib/types";
import {
  ExternalLink,
  Mail,
  Phone,
  Globe,
  MapPin,
  Sparkles,
  RefreshCw,
  Plus,
} from "lucide-react";

const STATUSES = ["new", "contacted", "qualified", "opportunity", "won", "lost", "archived"] as const;

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-brand-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

export default function LeadDetailClient({
  initialLead,
  initialActivities,
  initialOpportunities,
}: {
  initialLead: Lead;
  initialActivities: Activity[];
  initialOpportunities: Opportunity[];
}) {
  const [lead, setLead] = useState<Lead>(initialLead);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(initialOpportunities);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [researching, setResearching] = useState(false);

  async function updateStatus(status: string) {
    setSaving(true);
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const j = await res.json();
      setLead(j.lead);
      setActivities([
        {
          id: crypto.randomUUID(),
          lead_id: lead.id,
          type: "status_change",
          title: `Status changed to ${status}`,
          content: null,
          metadata: { from: lead.status, to: status },
          created_at: new Date().toISOString(),
          created_by: "isaiah",
        },
        ...activities,
      ]);
    }
    setSaving(false);
  }

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note }),
    });
    if (res.ok) {
      const j = await res.json();
      setActivities([j.activity, ...activities]);
      setNote("");
    }
    setSaving(false);
  }

  async function reResearch() {
    setResearching(true);
    const res = await fetch(`/api/leads/${lead.id}/research`, { method: "POST" });
    if (res.ok) {
      const j = await res.json();
      setLead(j.lead);
      setActivities([j.activity, ...activities]);
    }
    setResearching(false);
  }

  async function createOpportunity() {
    const name = prompt(`Opportunity name (default: "${lead.company_name || "Deal"}")`);
    if (name === null) return;
    const value = prompt("Estimated MRR (USD)?", "500");
    if (value === null) return;
    const res = await fetch(`/api/leads/${lead.id}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || lead.company_name || "Deal",
        estimated_mrr: parseFloat(value) || 0,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setOpportunities([j.opportunity, ...opportunities]);
    }
  }

  const breakdown = (lead.score_breakdown as Record<string, unknown> | null) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: lead info + AI research */}
      <div className="lg:col-span-2 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className={`score-pill ${scoreColor(lead.lead_score)} w-16 h-16 text-xl rounded-xl`}>
              {lead.lead_score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">
                  {lead.company_name || lead.person_name || "Unknown"}
                </h1>
                {lead.is_east_coast && (
                  <span className="status-badge bg-blue-50 text-blue-700">East Coast</span>
                )}
                <span className="status-badge bg-slate-100 text-slate-700">{lead.source}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                {lead.person_name && lead.company_name && (
                  <span>{lead.person_name}</span>
                )}
                {lead.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {lead.location}
                  </span>
                )}
                {lead.industry && <span>· {lead.industry}</span>}
                {lead.company_size && <span>· {lead.company_size}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-brand-600 hover:underline">
                    <Mail className="w-3.5 h-3.5" /> {lead.email}
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-brand-600 hover:underline">
                    <Phone className="w-3.5 h-3.5" /> {lead.phone}
                  </a>
                )}
                {lead.website && (
                  <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                    <Globe className="w-3.5 h-3.5" /> {new URL(lead.website).hostname}
                  </a>
                )}
                {lead.source_url && (
                  <a href={lead.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> Original
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 uppercase">Pipeline:</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={saving}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  lead.status === s
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-slate-700 border-slate-200 hover:border-brand-400"
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={createOpportunity}
              className="ml-auto flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
            >
              <Plus className="w-3 h-3" /> Opportunity
            </button>
          </div>
        </div>

        {/* AI Research */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-500" /> AI Research
            </h2>
            <button
              onClick={reResearch}
              disabled={researching}
              className="flex items-center gap-1 text-xs px-3 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${researching ? "animate-spin" : ""}`} />
              {researching ? "Researching..." : "Re-research"}
            </button>
          </div>

          {lead.research_status === "pending" && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              Queued — Claude will research this lead in the next background tick.
            </div>
          )}

          {lead.research_summary && (
            <p className="text-sm text-slate-700 leading-relaxed">{lead.research_summary}</p>
          )}

          {lead.outreach_angle && (
            <div className="mt-4 bg-brand-50 border border-brand-200 rounded-md p-4">
              <div className="text-xs uppercase font-medium text-brand-700 mb-1">Recommended opening</div>
              <div className="text-sm text-slate-800">{lead.outreach_angle}</div>
            </div>
          )}

          {(lead.pain_points?.length ?? 0) > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase font-medium text-slate-500 mb-1">Pain points</div>
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                {lead.pain_points!.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {(lead.recommended_services?.length ?? 0) > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase font-medium text-slate-500 mb-1">Aventis fit</div>
              <div className="flex flex-wrap gap-2">
                {lead.recommended_services!.map((s) => (
                  <span key={s} className="status-badge bg-violet-50 text-violet-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {(lead.buying_signals?.length ?? 0) > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase font-medium text-slate-500 mb-1">Buying signals</div>
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                {lead.buying_signals!.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}

          {breakdown && (
            <details className="mt-4">
              <summary className="text-xs uppercase text-slate-500 cursor-pointer">Score breakdown</summary>
              <pre className="mt-2 text-xs bg-slate-50 p-3 rounded-md overflow-auto">{JSON.stringify(breakdown, null, 2)}</pre>
            </details>
          )}
        </div>

        {/* Original signal */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-2">Original signal</h2>
          <div className="text-xs text-slate-500 mb-2">
            via {lead.source}{lead.source_post_at ? ` · ${new Date(lead.source_post_at).toLocaleString()}` : ""}
          </div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-md p-3 max-h-72 overflow-auto">
            {lead.source_post_content ?? "(no content captured)"}
          </div>
        </div>
      </div>

      {/* RIGHT: activity, opportunities */}
      <div className="space-y-6">
        {/* Add note */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Add note</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened with this lead?"
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addNote}
            disabled={saving || !note.trim()}
            className="mt-2 w-full bg-brand-500 text-white text-sm py-2 rounded-md hover:bg-brand-600 disabled:opacity-50"
          >
            Save note
          </button>
        </div>

        {/* Opportunities */}
        {opportunities.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Opportunities</h3>
            <ul className="space-y-2">
              {opportunities.map((o) => (
                <li key={o.id} className="text-sm border border-slate-100 rounded-md p-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    ${o.estimated_mrr ?? 0}/mo · {o.stage} · {o.probability}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Activity timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Activity</h3>
          {activities.length === 0 ? (
            <div className="text-sm text-slate-500">No activity yet.</div>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="text-sm border-l-2 border-slate-200 pl-3">
                  <div className="text-xs text-slate-500">
                    {new Date(a.created_at).toLocaleString()} · {a.type}
                  </div>
                  {a.title && <div className="font-medium text-slate-900">{a.title}</div>}
                  {a.content && <div className="text-slate-700 whitespace-pre-wrap">{a.content}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
