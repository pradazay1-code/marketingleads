import { db } from "@/lib/db";
import dynamicImport from "next/dynamic";
import type { MapLead } from "@/components/LeadMap";

export const dynamic = "force-dynamic";

// Mapbox GL requires window — load client-side only
const LeadMap = dynamicImport(() => import("@/components/LeadMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-14rem)] min-h-[420px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

export default async function MapPage() {
  const sql = db();
  const rows = (await sql`
    SELECT id, company_name, person_name, vertical, latitude, longitude,
           lead_score, contactability_score, status, location, phone, email,
           website, intent_signal, estimated_monthly_value
    FROM leads
    WHERE latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND status <> 'archived'
    ORDER BY lead_score DESC
    LIMIT 800
  `) as unknown as MapLead[];

  const totalValue = rows.reduce((acc, r) => acc + (Number(r.estimated_monthly_value) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Territory Map</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Every geocoded lead across the East Coast. Junk removal in amber, real estate in blue.
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-xs text-slate-500 uppercase">Mapped</div>
            <div className="text-xl font-bold text-slate-900">{rows.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase">Pipeline value</div>
            <div className="text-xl font-bold text-emerald-600">
              ${totalValue.toLocaleString()}/mo
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-600 font-medium">No geocoded leads yet.</p>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
            Leads get coordinates when they have an address and{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">MAPBOX_TOKEN</code> is set. Google
            Maps-sourced leads are geocoded automatically. Run a cycle from Settings to populate the map.
          </p>
        </div>
      ) : (
        <LeadMap leads={rows} />
      )}
    </div>
  );
}
