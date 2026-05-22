import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Returns the Neon SQL client (memoized).
 *
 * Use it as a tagged template literal for safe parameterized queries:
 *   const sql = db();
 *   const rows = await sql`SELECT * FROM leads WHERE id = ${id}`;
 *
 * For dynamic SQL (e.g. variable column lists), call as sql(text, params).
 */
export function db(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not set. Get a free Postgres URL at https://neon.tech and paste it into Netlify env vars."
    );
  }
  _sql = neon(url);
  return _sql;
}

// ---------------------------------------------------------------------------
// Small helpers that cover the patterns we used with Supabase (.insert,
// .update, .upsert). They keep call sites concise without pulling in an ORM.
// ---------------------------------------------------------------------------

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  // Date → ISO
  if (v instanceof Date) return v.toISOString();
  // Plain object → JSON string for jsonb columns
  if (typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
  return v;
}

/**
 * Insert one row and return it.
 */
export async function insertRow<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>
): Promise<T> {
  const sql = db();
  const entries = Object.entries(data);
  const cols = entries.map(([k]) => `"${k}"`).join(", ");
  const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
  const params = entries.map(([, v]) => serializeValue(v));
  const result = (await sql(
    `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
    params
  )) as unknown as T[];
  return result[0];
}

/**
 * Update one row by id, return the updated row.
 */
export async function updateRow<T = Record<string, unknown>>(
  table: string,
  id: string,
  patch: Record<string, unknown>
): Promise<T | null> {
  const sql = db();
  const entries = Object.entries(patch);
  if (entries.length === 0) {
    const existing = (await sql(
      `SELECT * FROM "${table}" WHERE id = $1`,
      [id]
    )) as unknown as T[];
    return existing[0] ?? null;
  }
  const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
  const params = entries.map(([, v]) => serializeValue(v));
  params.push(id);
  const result = (await sql(
    `UPDATE "${table}" SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
    params
  )) as unknown as T[];
  return result[0] ?? null;
}

/**
 * Update many rows matching an `IN (…ids)` filter.
 */
export async function updateRowsByIds(
  table: string,
  ids: string[],
  patch: Record<string, unknown>
): Promise<void> {
  if (ids.length === 0) return;
  const sql = db();
  const entries = Object.entries(patch);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
  const params = entries.map(([, v]) => serializeValue(v));
  const idPlaceholders = ids.map((_, i) => `$${params.length + i + 1}`).join(", ");
  params.push(...ids);
  await sql(
    `UPDATE "${table}" SET ${setClauses} WHERE id IN (${idPlaceholders})`,
    params
  );
}

/**
 * Bulk insert with ON CONFLICT DO UPDATE (mirrors Supabase upsert).
 * Returns every row (inserted or updated).
 */
export async function bulkUpsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string,
  updateColumns?: string[]
): Promise<T[]> {
  if (rows.length === 0) return [];
  const sql = db();
  const columns = Object.keys(rows[0]);
  const placeholders = rows
    .map((_, ri) =>
      `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(", ")})`
    )
    .join(", ");
  const params = rows.flatMap((row) => columns.map((c) => serializeValue(row[c])));
  const colsToUpdate =
    updateColumns ?? columns.filter((c) => c !== conflictColumn && c !== "id" && c !== "created_at");
  const updateClause = colsToUpdate.length
    ? colsToUpdate.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")
    : null;
  const conflictAction = updateClause
    ? `ON CONFLICT ("${conflictColumn}") DO UPDATE SET ${updateClause}`
    : `ON CONFLICT ("${conflictColumn}") DO NOTHING`;
  const cols = columns.map((c) => `"${c}"`).join(", ");
  const result = (await sql(
    `INSERT INTO "${table}" (${cols}) VALUES ${placeholders} ${conflictAction} RETURNING *`,
    params
  )) as unknown as T[];
  return result;
}

/**
 * Count rows with an optional WHERE clause.
 * Pass `where` as plain SQL (e.g. "WHERE created_at >= $1") and matching params.
 */
export async function countRows(
  table: string,
  where: string = "",
  params: unknown[] = []
): Promise<number> {
  const sql = db();
  const r = (await sql(
    `SELECT COUNT(*)::text AS count FROM "${table}" ${where}`,
    params
  )) as Array<{ count: string }>;
  return parseInt(r[0]?.count ?? "0", 10);
}

/**
 * Structured logger that writes to system_log + stdout.
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
    const sql = db();
    await sql`
      INSERT INTO system_log (level, event, message, metadata)
      VALUES (${level}, ${event}, ${message}, ${metadata ? JSON.stringify(metadata) : null})
    `;
  } catch (err) {
    console.error("log() failed to write to DB", err);
  }
}
