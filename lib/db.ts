import { createClient, SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Service-role client — used by background workers (cron functions).
 * Bypasses RLS. NEVER expose to the browser.
 */
export function db(): SupabaseClient {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/**
 * Anon-key client — safe to use from the browser / UI.
 */
export function dbAnon(): SupabaseClient {
  if (anonClient) return anonClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing public Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  anonClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return anonClient;
}

/**
 * Structured logger that writes to Supabase + stdout.
 */
export async function log(
  level: "info" | "warn" | "error",
  event: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  const line = `[${level.toUpperCase()}] ${event}: ${message}`;
  if (level === "error") console.error(line, metadata ?? "");
  else console.log(line, metadata ?? "");

  try {
    await db().from("system_log").insert({
      level,
      event,
      message,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("log() failed to write to Supabase", err);
  }
}
