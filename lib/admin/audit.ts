import { getSql } from "@/lib/db";
import { ensureAdminTables, withDatabaseTimeout } from "@/lib/admin/tables";

/**
 * Append-only trail of what happened in the admin console: sign-ins, uploads, publishes, deletes.
 *
 * Recording an event is best effort. A failure to write the log must never turn a successful
 * admin action into an error (or, worse, a failed one into a retry that does it twice), so
 * `logAdminEvent` swallows everything. Reading the log is allowed to fail loudly: the activity
 * page needs to say the database is unavailable rather than show an empty history.
 */

export type AdminAuditEvent = {
  id: string;
  /** ISO 8601, UTC. */
  at: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: string;
  detail: Record<string, unknown> | null;
};

export interface AdminAuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  detail?: Record<string, unknown>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const MAX_ACTION_LENGTH = 64;
const MAX_ENTITY_LENGTH = 128;
const MAX_ACTOR_LENGTH = 128;

/* ------------------------------------------------------------------ *
 * Detail sanitising                                                    *
 * ------------------------------------------------------------------ */

/** Keys whose values must never reach the log, at any depth. */
const SENSITIVE_KEY = /pass|token|secret|cookie|authorization/i;

const MAX_DETAIL_DEPTH = 4;
const MAX_DETAIL_KEYS = 50;
const MAX_DETAIL_ARRAY = 50;
const MAX_DETAIL_STRING = 500;
const MAX_DETAIL_JSON = 8_000;

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value === null) return null;
  switch (typeof value) {
    case "string":
      return value.length > MAX_DETAIL_STRING ? `${value.slice(0, MAX_DETAIL_STRING)}…` : value;
    case "number":
      return Number.isFinite(value) ? value : null;
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "object":
      break;
    default:
      return undefined; // undefined, function, symbol: not representable as JSON
  }

  // File contents must never be logged, only that there were some.
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[binary ${value.byteLength} bytes]`;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (depth >= MAX_DETAIL_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_DETAIL_ARRAY)
      .map((item) => sanitizeValue(item, depth + 1))
      .map((item) => (item === undefined ? null : item));
  }

  const result: Record<string, unknown> = {};
  let kept = 0;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const clean = sanitizeValue(item, depth + 1);
    if (clean === undefined) continue;
    result[key] = clean;
    kept += 1;
    if (kept >= MAX_DETAIL_KEYS) break;
  }
  return result;
}

/**
 * Prepares an event's `detail` for storage: drops keys that look like credentials (at any depth),
 * replaces binary data with its size, bounds depth, width and string length, and collapses
 * anything still over 8 KB to a marker. Returns null when there is nothing to store.
 */
export function sanitizeAuditDetail(detail: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!detail || typeof detail !== "object") return null;
  const clean = sanitizeValue(detail, 0);
  if (!clean || typeof clean !== "object" || Array.isArray(clean)) return null;
  if (Object.keys(clean).length === 0) return null;
  return JSON.stringify(clean).length > MAX_DETAIL_JSON ? { truncated: true } : (clean as Record<string, unknown>);
}

/* ------------------------------------------------------------------ *
 * Writing                                                              *
 * ------------------------------------------------------------------ */

/** Records an event. NEVER throws: a broken log must not break the action being logged. */
export async function logAdminEvent(event: AdminAuditInput): Promise<void> {
  try {
    // Bounded: an unreachable database must not hold up the sign-in or the action being logged.
    await withDatabaseTimeout(
      (async () => {
        await ensureAdminTables();
        const detail = sanitizeAuditDetail(event.detail);
        await getSql()`
          INSERT INTO admin_audit_log (action, entity_type, entity_id, actor, detail)
          VALUES (
            ${String(event.action).slice(0, MAX_ACTION_LENGTH)},
            ${event.entityType ? event.entityType.slice(0, MAX_ENTITY_LENGTH) : null},
            ${event.entityId ? event.entityId.slice(0, MAX_ENTITY_LENGTH) : null},
            ${(event.actor ?? "").slice(0, MAX_ACTOR_LENGTH)},
            ${detail ? JSON.stringify(detail) : null}::jsonb
          )
        `;
      })(),
    );
  } catch (error) {
    // Name only: a driver message can contain the connection string.
    console.warn(`[admin-audit] could not record "${String(event?.action)}" (${error instanceof Error ? error.name : typeof error})`);
  }
}

/* ------------------------------------------------------------------ *
 * Reading                                                              *
 * ------------------------------------------------------------------ */

export interface ListAdminEventsOptions {
  /** 1-200, default 50. */
  limit?: number;
  offset?: number;
  /** Exact match, e.g. "login.failure". */
  action?: string;
  /** Exact match on the affected record's id. */
  entityId?: string;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value ?? "");
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function toDetail(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      // Not JSON: treat as absent.
    }
  }
  return null;
}

/** Newest first. Rejects if the database is unavailable. */
export async function listAdminEvents(
  options: ListAdminEventsOptions = {},
): Promise<{ events: AdminAuditEvent[]; total: number }> {
  await ensureAdminTables();
  const sql = getSql();

  const requestedLimit = Number.isFinite(options.limit) ? Math.floor(options.limit as number) : DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, requestedLimit));
  const requestedOffset = Number.isFinite(options.offset) ? Math.floor(options.offset as number) : 0;
  const offset = Math.max(0, requestedOffset);
  const action = options.action?.trim() ? options.action.trim() : null;
  const entityId = options.entityId?.trim() ? options.entityId.trim() : null;

  const [countRows, rows] = await Promise.all([
    sql`
      SELECT count(*)::int AS total
      FROM admin_audit_log
      WHERE (${action}::text IS NULL OR action = ${action}::text)
        AND (${entityId}::text IS NULL OR entity_id = ${entityId}::text)
    `,
    sql`
      SELECT
        id::text AS id,
        to_char(at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at,
        action, entity_type, entity_id, actor, detail
      FROM admin_audit_log
      WHERE (${action}::text IS NULL OR action = ${action}::text)
        AND (${entityId}::text IS NULL OR entity_id = ${entityId}::text)
      -- Qualified: bare "id" / "at" would sort by the text output columns of the same name.
      ORDER BY admin_audit_log.at DESC, admin_audit_log.id DESC
      LIMIT ${limit}::int OFFSET ${offset}::int
    `,
  ]);

  return {
    total: Number(countRows[0]?.total ?? 0),
    events: rows.map((row) => ({
      id: String(row.id),
      at: toIsoString(row.at),
      action: String(row.action),
      entityType: row.entity_type === null || row.entity_type === undefined ? null : String(row.entity_type),
      entityId: row.entity_id === null || row.entity_id === undefined ? null : String(row.entity_id),
      actor: String(row.actor ?? ""),
      detail: toDetail(row.detail),
    })),
  };
}
