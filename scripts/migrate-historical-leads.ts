/**
 * Copies the historical leads from the personal Neon project into the company
 * database. PREPARED 30 October 2026; NOT RUN. Run only with written approval,
 * following the migration plan in the P2 report.
 *
 *   SOURCE_DATABASE_URL=...  DATABASE_URL=...  npx tsx scripts/migrate-historical-leads.ts
 *       Dry run (the default): reads both sides, prints counts and checksums,
 *       writes nothing.
 *
 *   ... MIGRATION_EXPECTED_SOURCE_ROWS=29 MIGRATION_EXCLUDE_IDS=PLS-...,PLS-... \
 *       npx tsx scripts/migrate-historical-leads.ts --execute
 *       Inserts, in one transaction, every source row whose reference is not
 *       already present (INSERT ... ON CONFLICT DO NOTHING), preserving
 *       created_at. Never updates or deletes, never sends email, and verifies
 *       every inserted row's checksum afterwards.
 *
 * Output is aggregate only: counts, checksums and reason codes. No connection
 * string, host, contact detail or answer is printed. Source rows are only read.
 */
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export interface LeadRow {
  pulse_id: string;
  lead: unknown;
  context: unknown;
  answers: unknown;
  recommended_modules: unknown;
  created_at: string | Date;
}

/** Canonical JSON: object keys sorted, so the same row hashes the same on both sides. */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normaliseId(id: string): string {
  return id.trim().toUpperCase();
}

export function rowChecksum(row: LeadRow): string {
  const createdAt = new Date(row.created_at).toISOString();
  return createHash("sha256")
    .update([normaliseId(row.pulse_id), canonical(row.lead), canonical(row.context), canonical(row.answers), canonical(row.recommended_modules), createdAt].join("\u0000"))
    .digest("hex");
}

export function setChecksum(rows: LeadRow[]): string {
  return createHash("sha256").update(rows.map(rowChecksum).sort().join(",")).digest("hex");
}

export interface MigrationPlan {
  toInsert: LeadRow[];
  alreadyPresent: number;
  excluded: number;
  duplicateSourceIds: number;
}

export function planMigration(source: LeadRow[], destinationIds: Iterable<string>, excludeIds: Iterable<string>): MigrationPlan {
  const present = new Set([...destinationIds].map(normaliseId));
  const exclude = new Set([...excludeIds].map(normaliseId).filter(Boolean));
  const seen = new Set<string>();
  const plan: MigrationPlan = { toInsert: [], alreadyPresent: 0, excluded: 0, duplicateSourceIds: 0 };

  for (const row of source) {
    const id = normaliseId(row.pulse_id);
    if (seen.has(id)) {
      plan.duplicateSourceIds += 1;
      continue;
    }
    seen.add(id);
    if (exclude.has(id)) plan.excluded += 1;
    else if (present.has(id)) plan.alreadyPresent += 1;
    else plan.toInsert.push(row);
  }
  return plan;
}

const SELECT_ROWS = "SELECT pulse_id, lead, context, answers, recommended_modules, created_at FROM directions ORDER BY pulse_id";

const INSERT_IF_ABSENT = `
  INSERT INTO directions (pulse_id, lead, context, answers, recommended_modules, created_at)
  VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::timestamptz)
  ON CONFLICT (pulse_id) DO NOTHING`;

function endpointOf(url: string): string {
  return new URL(url).hostname.split(".")[0].replace(/-pooler$/, "");
}

function fail(reason: string): never {
  console.error(`[migrate-historical-leads] refused: ${reason}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const sourceUrl = process.env.SOURCE_DATABASE_URL?.trim();
  const destinationUrl = process.env.DATABASE_URL?.trim();
  if (!sourceUrl || !destinationUrl) fail("set SOURCE_DATABASE_URL and DATABASE_URL in the environment");
  if (endpointOf(sourceUrl) === endpointOf(destinationUrl)) fail("source and destination are the same database");

  const source = neon(sourceUrl);
  const destination = neon(destinationUrl);

  const sourceRows = (await source.query(SELECT_ROWS)) as LeadRow[];
  const destinationRows = (await destination.query(SELECT_ROWS)) as LeadRow[];
  const exclude = (process.env.MIGRATION_EXCLUDE_IDS ?? "").split(",");
  const plan = planMigration(sourceRows, destinationRows.map((row) => row.pulse_id), exclude);

  const report = {
    mode: execute ? "execute" : "dry-run",
    sourceRows: sourceRows.length,
    sourceChecksum: setChecksum(sourceRows),
    destinationRowsBefore: destinationRows.length,
    destinationChecksumBefore: setChecksum(destinationRows),
    toInsert: plan.toInsert.length,
    alreadyPresent: plan.alreadyPresent,
    excluded: plan.excluded,
    duplicateSourceIds: plan.duplicateSourceIds,
    toInsertChecksum: setChecksum(plan.toInsert),
  };
  console.log(JSON.stringify(report, null, 2));

  if (!execute) {
    console.log("[migrate-historical-leads] dry run only; nothing was written.");
    return;
  }

  const expected = Number(process.env.MIGRATION_EXPECTED_SOURCE_ROWS);
  if (!Number.isInteger(expected) || expected !== sourceRows.length) {
    fail("MIGRATION_EXPECTED_SOURCE_ROWS must equal the source row count shown by the dry run");
  }
  if (plan.duplicateSourceIds > 0) fail("the source has duplicate references; resolve them first");

  await destination.transaction(
    plan.toInsert.map((row) =>
      destination.query(INSERT_IF_ABSENT, [
        normaliseId(row.pulse_id),
        JSON.stringify(row.lead),
        row.context === null ? null : JSON.stringify(row.context),
        row.answers === null ? null : JSON.stringify(row.answers),
        row.recommended_modules === null ? null : JSON.stringify(row.recommended_modules),
        new Date(row.created_at).toISOString(),
      ])
    )
  );

  const after = (await destination.query(SELECT_ROWS)) as LeadRow[];
  const afterById = new Map(after.map((row) => [normaliseId(row.pulse_id), rowChecksum(row)]));
  const mismatched = plan.toInsert.filter((row) => afterById.get(normaliseId(row.pulse_id)) !== rowChecksum(row)).length;
  const untouched = destinationRows.filter((row) => afterById.get(normaliseId(row.pulse_id)) !== rowChecksum(row)).length;

  console.log(
    JSON.stringify(
      {
        destinationRowsAfter: after.length,
        expectedRowsAfter: destinationRows.length + plan.toInsert.length,
        insertedRowsWithMismatchedChecksum: mismatched,
        preExistingRowsChanged: untouched,
        destinationChecksumAfter: setChecksum(after),
      },
      null,
      2
    )
  );
  if (mismatched > 0 || untouched > 0 || after.length !== destinationRows.length + plan.toInsert.length) {
    fail("reconciliation failed; restore from the backup branch as the plan describes");
  }
  console.log("[migrate-historical-leads] reconciled. Source left untouched.");
}

if (process.argv[1] && /migrate-historical-leads/.test(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error("[migrate-historical-leads] failed:", error instanceof Error ? error.name : "unknown error");
    process.exit(1);
  });
}
