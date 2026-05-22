import { db } from "@/lib/db";
import SettingsClient from "@/components/SettingsClient";
import type { Keyword } from "@/lib/types";

export const dynamic = "force-dynamic";

interface DbSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export default async function SettingsPage() {
  const supa = db();
  const [kwRes, srcRes] = await Promise.all([
    supa.from("keywords").select("*").order("category").order("weight", { ascending: false }),
    supa.from("sources").select("*").order("name"),
  ]);

  return (
    <SettingsClient
      keywords={(kwRes.data ?? []) as Keyword[]}
      sources={(srcRes.data ?? []) as DbSource[]}
    />
  );
}
