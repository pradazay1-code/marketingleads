"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";

const SOURCES = [
  "googlemaps",
  "newsfunding",
  "indeed",
  "ycombinator",
  "producthunt",
  "businessregistry",
  "github",
  "reddit",
  "indiehackers",
  "twitter",
  "google",
];
const STATUSES = ["new", "contacted", "qualified", "opportunity", "won", "lost", "archived"];

export default function LeadsFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  const update = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`/leads?${sp.toString()}`);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: q || null });
        }}
        className="flex-1 min-w-[200px] relative"
      >
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, name, or intent..."
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>
      <select
        value={params.get("source") ?? ""}
        onChange={(e) => update({ source: e.target.value || null })}
        className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
      >
        <option value="">All sources</option>
        {SOURCES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select
        value={params.get("status") ?? ""}
        onChange={(e) => update({ status: e.target.value || null })}
        className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select
        value={params.get("min_score") ?? ""}
        onChange={(e) => update({ min_score: e.target.value || null })}
        className="border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
      >
        <option value="">Any score</option>
        <option value="80">80+</option>
        <option value="65">65+</option>
        <option value="45">45+</option>
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={params.get("contactable") !== "0"}
          onChange={(e) => update({ contactable: e.target.checked ? null : "0" })}
        />
        Contactable only
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={params.get("east") === "1"}
          onChange={(e) => update({ east: e.target.checked ? "1" : null })}
        />
        East Coast
      </label>
    </div>
  );
}
