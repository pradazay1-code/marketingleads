"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Mail, Phone, Globe, Linkedin, MapPin, CheckCircle2 } from "lucide-react";
import type { Lead } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-brand-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(s: string): string {
  switch (s) {
    case "new": return "bg-blue-50 text-blue-700";
    case "contacted": return "bg-amber-50 text-amber-700";
    case "qualified": return "bg-emerald-50 text-emerald-700";
    case "opportunity": return "bg-violet-50 text-violet-700";
    case "won": return "bg-green-100 text-green-800";
    case "lost": return "bg-slate-200 text-slate-700";
    case "archived": return "bg-slate-100 text-slate-500";
    default: return "bg-slate-100 text-slate-600";
  }
}

const BULK_STATUS_OPTIONS = ["new", "contacted", "qualified", "opportunity", "won", "lost", "archived"];

function ContactChips({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {lead.has_email && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          <Mail className="w-2.5 h-2.5" /> email
        </span>
      )}
      {lead.has_phone && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          <Phone className="w-2.5 h-2.5" /> phone
        </span>
      )}
      {lead.has_website && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          <Globe className="w-2.5 h-2.5" /> site
        </span>
      )}
      {lead.has_linkedin && (
        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
          <Linkedin className="w-2.5 h-2.5" /> linkedin
        </span>
      )}
    </div>
  );
}

export default function LeadsTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(leads.map((l) => l.id)));
  }

  async function bulkSetStatus(status: string) {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), action: "set_status", value: status }),
      });
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    } finally {
      setBulkLoading(false);
    }
  }

  function downloadCsv() {
    const params = new URLSearchParams(searchParams.toString());
    window.open(`/api/leads/export?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-slate-600">
          {selected.size > 0 ? (
            <span className="font-medium">{selected.size} selected</span>
          ) : (
            <span>
              {leads.length} lead{leads.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    bulkSetStatus(e.target.value);
                    e.target.value = "";
                  }
                }}
                disabled={bulkLoading}
                className="text-sm border border-slate-200 rounded-md px-2 py-2 bg-white"
                defaultValue=""
              >
                <option value="" disabled>{bulkLoading ? "Updating..." : "Bulk set status…"}</option>
                {BULK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>Set status: {s}</option>
                ))}
              </select>
              <button onClick={() => setSelected(new Set())} className="text-sm text-slate-600 hover:text-slate-900 px-3 py-2">
                Clear
              </button>
            </>
          )}
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 text-sm border border-slate-200 hover:border-brand-400 rounded-md px-3 py-2 bg-white"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Mobile: card view */}
      <ul className="md:hidden space-y-2">
        {leads.length === 0 ? (
          <li className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
            No leads match these filters yet.
          </li>
        ) : (
          leads.map((l) => (
            <li
              key={l.id}
              className={`bg-white rounded-xl border ${selected.has(l.id) ? "border-brand-400" : "border-slate-200"} p-3`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="mt-1 w-5 h-5 rounded"
                  aria-label={`Select ${l.company_name ?? l.person_name ?? "lead"}`}
                />
                <div className={`score-pill ${scoreColor(l.lead_score)} shrink-0`}>{l.lead_score}</div>
                <div className="flex-1 min-w-0">
                  <Link href={`/leads/${l.id}`} className="block">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-slate-900 truncate">
                        {l.company_name || l.person_name || "Unknown"}
                      </span>
                      {l.is_east_coast && <span className="status-badge bg-blue-50 text-blue-700">EC</span>}
                      <span className={`status-badge ${statusColor(l.status)}`}>{l.status}</span>
                    </div>
                    {l.location && (
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {l.location}
                      </div>
                    )}
                    <div className="text-xs text-slate-600 mt-1.5 line-clamp-2">{l.intent_signal ?? "—"}</div>
                    <div className="mt-2"><ContactChips lead={l} /></div>
                    <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-2">
                      <span>{l.source}</span>
                      <span>·</span>
                      <span>{timeAgo(l.created_at)}</span>
                    </div>
                  </Link>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>

      {/* Desktop: table view */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 w-16">Score</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 whitespace-nowrap">Found</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-sm text-slate-500">
                    No leads match these filters yet.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr key={l.id} className={`hover:bg-slate-50 ${selected.has(l.id) ? "bg-brand-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggle(l.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className={`score-pill ${scoreColor(l.lead_score)}`}>{l.lead_score}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.id}`} className="block">
                        <div className="font-medium text-slate-900 hover:text-brand-600">
                          {l.company_name || l.person_name || "Unknown"}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          {l.location && <span>{l.location}</span>}
                          {l.is_east_coast && <span className="status-badge bg-blue-50 text-blue-700">East Coast</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {l.contactability_score >= 70 && (
                        <div className="flex items-center gap-1 text-emerald-700 text-xs font-medium mb-1">
                          <CheckCircle2 className="w-3 h-3" /> Contactable
                        </div>
                      )}
                      <ContactChips lead={l} />
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-sm text-slate-700 truncate">{l.intent_signal ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="status-badge bg-slate-100 text-slate-700">{l.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-badge ${statusColor(l.status)}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{timeAgo(l.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
