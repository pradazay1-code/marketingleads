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
  const sql = db();
  const [keywordsRaw, sourcesRaw] = await Promise.all([
    sql`SELECT * FROM keywords ORDER BY category, weight DESC`,
    sql`SELECT * FROM sources ORDER BY name`,
  ]);

  return (
    <SettingsClient
      keywords={keywordsRaw as unknown as Keyword[]}
      sources={sourcesRaw as unknown as DbSource[]}
    />
  );
}
