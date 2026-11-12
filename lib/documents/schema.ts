import { getSql, type SqlClient } from "@/lib/db";

/**
 * Creates the document registry's tables on first use.
 *
 * Idempotent (`IF NOT EXISTS` throughout), so it is safe to run on every cold start, from
 * `npm run migrate:documents` and from the store at the same time. Each statement is its own
 * `sql` call because Neon's HTTP endpoint accepts exactly one statement per request.
 *
 * Bytes live in `document_files.data` (BYTEA): Vercel's filesystem is read-only and request
 * bodies are capped near 4.5 MB, so Postgres is the one place an upload can be kept.
 */

async function createTables(sql: SqlClient): Promise<void> {
  // The category list mirrors DOCUMENT_CATEGORY_KEYS. An 'id_card' category once existed and was removed
  // before any such row was ever created, so there is deliberately no migration: a database created earlier
  // still carries the wider CHECK (it also allows 'id_card'), which is harmless because the API validates
  // the category against DOCUMENT_CATEGORY_KEYS before anything is written. Only new installs get five keys.
  await sql`
    CREATE TABLE IF NOT EXISTS documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category text NOT NULL CHECK (category IN (
        'financial_report', 'company_identity', 'certification', 'program_record', 'experience_letter'
      )),
      title text NOT NULL,
      summary text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      visibility text NOT NULL CHECK (visibility IN ('public', 'unlisted', 'private')),
      allow_download boolean NOT NULL DEFAULT false,
      featured boolean NOT NULL DEFAULT false,
      sort_order int NOT NULL DEFAULT 0,
      holder_name text NOT NULL DEFAULT '',
      reference_no text NOT NULL DEFAULT '',
      issued_on date,
      expires_on date,
      verification_code text,
      revoked_at timestamptz,
      revoked_reason text NOT NULL DEFAULT '',
      data jsonb NOT NULL DEFAULT '{}',
      verify_count int NOT NULL DEFAULT 0,
      last_verified_at timestamptz,
      published_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS document_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('primary', 'photo')),
      filename text NOT NULL,
      mime_type text NOT NULL,
      size_bytes int NOT NULL,
      sha256 text NOT NULL,
      data bytea NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (document_id, role)
    )`;

  // Deliberately not a foreign key with cascade: deleting a document keeps its history as an
  // anonymous event (document_id becomes NULL) so the lookup counts do not shrink.
  await sql`
    CREATE TABLE IF NOT EXISTS verification_events (
      id bigserial PRIMARY KEY,
      at timestamptz NOT NULL DEFAULT now(),
      document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
      result text NOT NULL,
      ip_hash text NOT NULL DEFAULT '',
      code_suffix text NOT NULL DEFAULT ''
    )`;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS documents_verification_code_uidx
      ON documents (verification_code) WHERE verification_code IS NOT NULL`;
  await sql`
    CREATE INDEX IF NOT EXISTS documents_category_status_visibility_idx
      ON documents (category, status, visibility)`;
  await sql`CREATE INDEX IF NOT EXISTS documents_issued_on_idx ON documents (issued_on DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS verification_events_at_idx ON verification_events (at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS verification_events_document_idx ON verification_events (document_id)`;

  // The verification stamp. `data` holds the file as served (stamped when it carries the QR); `source_data` keeps the
  // untouched upload next to it, so a new code or a new placement is applied to the original and never stacked on a
  // stamped file. `stamp` records what was drawn ({code, position, size, pages, at}); NULL means not stamped.
  await sql`ALTER TABLE document_files ADD COLUMN IF NOT EXISTS source_data bytea`;
  await sql`ALTER TABLE document_files ADD COLUMN IF NOT EXISTS stamp jsonb`;

  await createReferenceIndex(sql);
}

/**
 * Two records of a category that numbers its papers may not share a reference number, ignoring case and
 * surrounding spaces. The store checks this before every write (and says which record has the number); this
 * index is the backstop for two saves racing each other.
 *
 * The list of categories is the set with `uniqueReference: true` in categories.ts (a test keeps the two in
 * step). It is spelled out because an index predicate cannot take parameters. A database that ALREADY holds a
 * duplicate cannot build the index; that must not take the whole registry down, so it is reported once and
 * skipped, and the store's own check still protects everything saved from now on.
 */
async function createReferenceIndex(sql: SqlClient): Promise<void> {
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS documents_category_reference_uidx
        ON documents (category, lower(btrim(reference_no)))
        WHERE btrim(reference_no) <> ''
          AND category IN ('certification', 'experience_letter', 'financial_report', 'program_record')`;
  } catch (error) {
    console.warn(
      `[documents] reference-number index not created (${error instanceof Error ? error.name : typeof error}): ` +
        "existing records share a reference number. Fix the duplicates and restart; new saves are still checked.",
    );
  }
}

let ready: Promise<void> | null = null;
let readyFor: SqlClient | null = null;

/**
 * Resolves once the tables exist. The promise is cached per client, so concurrent requests share
 * one migration, but a REJECTION is dropped: a transient Neon error on a cold start must not leave
 * every later request failing until the process restarts. Keying on the client lets tests swap in
 * a fresh in-memory database without a manual reset.
 */
export async function ensureDocumentTables(): Promise<void> {
  const sql = getSql();
  if (ready && readyFor === sql) return ready;

  readyFor = sql;
  const attempt: Promise<void> = createTables(sql).catch((error: unknown) => {
    if (ready === attempt) {
      ready = null;
      readyFor = null;
    }
    throw error;
  });
  ready = attempt;
  return attempt;
}

/** Test seam: forget that the tables were created. */
export function resetDocumentTablesCache(): void {
  ready = null;
  readyFor = null;
}
