import { db } from "./db";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";

/**
 * Simple password-gated cookie session. Single shared password (APP_PASSWORD)
 * lets Isaiah (and anyone he hands the password to) into the CRM. Sessions
 * are server-side rows so they can be revoked.
 *
 * Skip if APP_PASSWORD isn't set — keeps things friction-free for the
 * initial setup. Once you add a password, all routes require login.
 */

const SESSION_COOKIE = "aventis_session";
const SESSION_DURATION_DAYS = 30;

export function isAuthEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function checkPassword(plain: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // constant-time-ish compare via hash equality
  return hashPassword(plain) === hashPassword(expected);
}

export async function createSession(): Promise<string> {
  const sql = db();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (token, expires_at) VALUES (${token}, ${expiresAt.toISOString()})
  `;
  return token;
}

export async function destroySession(token: string): Promise<void> {
  const sql = db();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function validateSession(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const sql = db();
    const rows = (await sql`
      SELECT id FROM sessions WHERE token = ${token} AND expires_at > now()
    `) as Array<{ id: string }>;
    if (rows.length === 0) return false;
    // Update last_seen (fire and forget)
    sql`UPDATE sessions SET last_seen_at = now() WHERE token = ${token}`.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export async function getSessionToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export async function isLoggedIn(): Promise<boolean> {
  if (!isAuthEnabled()) return true; // no password set → public
  const token = await getSessionToken();
  if (!token) return false;
  return validateSession(token);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_MAX_AGE_SECONDS = SESSION_DURATION_DAYS * 24 * 60 * 60;
