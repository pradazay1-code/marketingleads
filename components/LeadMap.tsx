"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { MapPin, Trash2, Home, X } from "lucide-react";

export interface MapLead {
  id: string;
  company_name: string | null;
  person_name: string | null;
  vertical: string;
  latitude: number;
  longitude: number;
  lead_score: number;
  contactability_score: number;
  status: string;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  intent_signal: string | null;
  estimated_monthly_value: number | null;
}

const VERTICAL_COLOR: Record<string, string> = {
  junk_removal: "#f59e0b", // amber
  real_estate: "#5168fa", // brand blue
  other: "#94a3b8", // slate
};

export default function LeadMap({ leads }: { leads: MapLead[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selected, setSelected] = useState<MapLead | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "junk_removal" | "real_estate">("all");

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token) {
      setError("NEXT_PUBLIC_MAPBOX_TOKEN is not set in Netlify environment variables.");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      // Centered on the mid-Atlantic so the whole East Coast is in frame
      center: [-77.5, 36.5],
      zoom: 4.4,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    mapRef.current = map;
    map.on("load", () => setReady(true));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Render markers whenever leads or the filter change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const markers: mapboxgl.Marker[] = [];
    const visible = leads.filter((l) => filter === "all" || l.vertical === filter);

    for (const lead of visible) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", lead.company_name ?? "Lead");
      const color = VERTICAL_COLOR[lead.vertical] ?? VERTICAL_COLOR.other;
      const size = lead.lead_score >= 80 ? 30 : lead.lead_score >= 65 ? 26 : 20;
      el.style.cssText = `
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};border:2px solid white;cursor:pointer;
        box-shadow:0 1px 4px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:${size >= 26 ? 11 : 9}px;font-weight:700;
        font-family:inherit;padding:0;line-height:1;
      `;
      el.textContent = String(lead.lead_score);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(lead);
        map.flyTo({ center: [lead.longitude, lead.latitude], zoom: 11, duration: 800 });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lead.longitude, lead.latitude])
        .addTo(map);
      markers.push(marker);
    }

    return () => {
      for (const m of markers) m.remove();
    };
  }, [leads, ready, filter]);

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
        <div className="font-medium mb-1">Map unavailable</div>
        <p>{error}</p>
        <p className="mt-2 text-xs">
          Add <code className="bg-white px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
          Netlify → Site configuration → Environment variables, then redeploy.
        </p>
      </div>
    );
  }

  const counts = {
    all: leads.length,
    junk_removal: leads.filter((l) => l.vertical === "junk_removal").length,
    real_estate: leads.filter((l) => l.vertical === "real_estate").length,
  };

  return (
    <div className="relative">
      {/* Vertical filter chips */}
      <div className="absolute top-3 left-3 z-10 flex gap-1.5 bg-white/95 backdrop-blur rounded-lg p-1.5 shadow-sm border border-slate-200">
        {([
          ["all", "All", null],
          ["junk_removal", "Junk removal", Trash2],
          ["real_estate", "Real estate", Home],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setFilter(key as typeof filter)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              filter === key
                ? "bg-brand-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            <span
              className={`text-[10px] px-1 rounded ${
                filter === key ? "bg-white/25" : "bg-slate-100"
              }`}
            >
              {counts[key as keyof typeof counts]}
            </span>
          </button>
        ))}
      </div>

      <div
        ref={containerRef}
        className="w-full h-[calc(100vh-14rem)] min-h-[420px] rounded-xl border border-slate-200 overflow-hidden"
      />

      {/* Selected-lead card */}
      {selected && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:w-96 z-10 bg-white rounded-xl border border-slate-200 shadow-lg p-4">
          <button
            onClick={() => setSelected(null)}
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ background: VERTICAL_COLOR[selected.vertical] ?? VERTICAL_COLOR.other }}
            >
              {selected.lead_score}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {selected.company_name || selected.person_name || "Unknown"}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{selected.location}</span>
              </div>
            </div>
          </div>

          {selected.intent_signal && (
            <p className="text-xs text-slate-600 mt-3 line-clamp-3">{selected.intent_signal}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                📞 {selected.phone}
              </a>
            )}
            {selected.email && (
              <a
                href={`mailto:${selected.email}`}
                className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 truncate max-w-[180px]"
              >
                ✉️ {selected.email}
              </a>
            )}
            {selected.website && (
              <a
                href={selected.website}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                🌐 site
              </a>
            )}
          </div>

          {selected.estimated_monthly_value ? (
            <div className="mt-2 text-xs text-emerald-700 font-medium">
              Est. value: ${selected.estimated_monthly_value.toLocaleString()}/mo
            </div>
          ) : null}

          <Link
            href={`/leads/${selected.id}`}
            className="mt-3 block text-center bg-brand-500 hover:bg-brand-600 text-white text-sm py-2 rounded-md"
          >
            Open lead →
          </Link>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur rounded-lg px-3 py-2 shadow-sm border border-slate-200 text-[11px] space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: VERTICAL_COLOR.junk_removal }} />
          Junk removal
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: VERTICAL_COLOR.real_estate }} />
          Real estate
        </div>
        <div className="text-slate-400 pt-1 border-t border-slate-100">Bigger pin = higher score</div>
      </div>
    </div>
  );
}
