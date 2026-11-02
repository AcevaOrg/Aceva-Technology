import { getSql, tagOperation, withTimeout } from "./db";

export interface SavedDirection {
  pulseId: string;
  lead: {
    name: string;
    contact: string;
    method: string;
  };
  context?: {
    intent?: string;
    industry?: string;
    business?: string;
    current?: string;
    scale?: string;
    market?: string;
    friction?: string[];
    goals?: string[];
    timeline?: string;
    /**
     * The budget half of the step-5 answer. The wizard has always inferred it
     * into `PulseContextData`, but it was missing here and from the
     * save-direction payload, so it never reached the stored record, the lead
     * email or the emailed blueprint — the one field the team most needs.
     */
    budget?: string;
  };
  answers?: string[];
  recommendedModules?: string[];
  createdAt: string;
}

/** A `directions` row as the driver hands it back (JSONB arrives pre-parsed). */
interface DirectionRow {
  pulse_id: string;
  lead: SavedDirection["lead"];
  context: SavedDirection["context"] | null;
  answers: string[] | null;
  recommended_modules: string[] | null;
  created_at: string | Date;
}

let schemaReady: Promise<void> | null = null;

/**
 * Creates the table on first use. The resolved promise is cached so the DDL
 * costs one round trip per process rather than one per query; a rejection is
 * deliberately left uncached so the next caller retries instead of inheriting a
 * permanently broken store.
 */
export async function ensureDirectionsTable(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = withTimeout(
      sql`
      CREATE TABLE IF NOT EXISTS directions (
        pulse_id            TEXT PRIMARY KEY,
        lead                JSONB NOT NULL,
        context             JSONB,
        answers             JSONB,
        recommended_modules JSONB,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `,
      "directions DDL"
    )
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/**
 * Persists a direction in a single upsert statement. Two concurrent writers can
 * no longer clobber each other the way the previous load-modify-write JSON file
 * store did. `created_at` is omitted from the UPDATE list so re-saving an
 * existing PULSE ID preserves its original submission time.
 *
 * Operator use only (scripts/import-directions.ts). It overwrites on conflict,
 * so no route may call it; the save route uses `createDirection`.
 */
export async function saveDirection(direction: SavedDirection): Promise<void> {
  await ensureDirectionsTable();
  const sql = getSql();

  await sql`
    INSERT INTO directions (pulse_id, lead, context, answers, recommended_modules, created_at)
    VALUES (
      ${direction.pulseId.trim().toUpperCase()},
      ${JSON.stringify(direction.lead)}::jsonb,
      ${direction.context ? JSON.stringify(direction.context) : null}::jsonb,
      ${direction.answers ? JSON.stringify(direction.answers) : null}::jsonb,
      ${direction.recommendedModules ? JSON.stringify(direction.recommendedModules) : null}::jsonb,
      ${direction.createdAt}::timestamptz
    )
    ON CONFLICT (pulse_id) DO UPDATE SET
      lead                = EXCLUDED.lead,
      context             = EXCLUDED.context,
      answers             = EXCLUDED.answers,
      recommended_modules = EXCLUDED.recommended_modules
  `;
}

/**
 * Inserts a new direction and never updates an existing one.
 *
 * The save route used to upsert under a reference the browser chose, guarded by
 * a separate read-then-write ownership check that two concurrent requests could
 * both pass. References are now generated on the server and this insert is the
 * only write: `ON CONFLICT DO NOTHING` makes a clash a no-op that returns false,
 * atomically, so no submission can overwrite another visitor's record. The
 * caller generates a fresh reference and tries again.
 */
export async function createDirection(direction: SavedDirection): Promise<boolean> {
  // Each step is tagged so a failure log names the operation that broke.
  await tagOperation("prepare-table", () => ensureDirectionsTable());

  const rows = (await tagOperation("insert", () => withTimeout(
    getSql()`
    INSERT INTO directions (pulse_id, lead, context, answers, recommended_modules, created_at)
    VALUES (
      ${direction.pulseId},
      ${JSON.stringify(direction.lead)}::jsonb,
      ${direction.context ? JSON.stringify(direction.context) : null}::jsonb,
      ${direction.answers ? JSON.stringify(direction.answers) : null}::jsonb,
      ${direction.recommendedModules ? JSON.stringify(direction.recommendedModules) : null}::jsonb,
      ${direction.createdAt}::timestamptz
    )
    ON CONFLICT (pulse_id) DO NOTHING
    RETURNING pulse_id
  `,
    "direction insert"
  ))) as { pulse_id: string }[];

  return rows.length === 1;
}

export async function getDirection(pulseId: string): Promise<SavedDirection | null> {
  await ensureDirectionsTable();
  const sql = getSql();

  const rows = (await withTimeout(
    sql`
    SELECT pulse_id, lead, context, answers, recommended_modules, created_at
    FROM directions
    WHERE pulse_id = ${pulseId.trim().toUpperCase()}
    LIMIT 1
  `,
    "direction read"
  )) as DirectionRow[];

  const row = rows[0];
  if (!row) return null;

  return {
    pulseId: row.pulse_id,
    lead: row.lead,
    context: row.context ?? undefined,
    answers: row.answers ?? undefined,
    recommendedModules: row.recommended_modules ?? undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  };
}
