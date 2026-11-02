/**
 * One-time import of the legacy file-based lead store into Neon.
 *
 *   npm run import:directions
 *
 * Idempotent and insert-only: createDirection skips a pulse_id that already
 * exists, so re-running neither duplicates nor overwrites a stored lead
 * (changed 30 October 2026; it used to upsert and refresh existing rows). knowledge/savedDirections.json is read only and
 * left on disk untouched — it is no longer tracked in git, so keep a local copy
 * until the import is confirmed.
 */
import fs from "fs";
import path from "path";
import { createDirection, ensureDirectionsTable, type SavedDirection } from "../lib/pulse/directionStore";
import { getDatabaseUrl } from "../lib/pulse/env";

const SOURCE_FILE = path.join(process.cwd(), "knowledge", "savedDirections.json");

async function main(): Promise<void> {
  if (!getDatabaseUrl()) {
    console.error("[import-directions] DATABASE_URL is not set. Add it to .env.local or the environment and re-run.");
    process.exit(1);
  }

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`[import-directions] nothing to import — no file at ${SOURCE_FILE}.`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(SOURCE_FILE, "utf-8")) as Record<string, SavedDirection>;
  const records = Object.values(parsed);

  await ensureDirectionsTable();

  let imported = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const record of records) {
    if (!record?.pulseId || !record?.lead?.name || !record?.lead?.contact) {
      failures.push(`${record?.pulseId || "(no pulseId)"} — missing pulseId or lead details`);
      continue;
    }

    try {
      const inserted = await createDirection({
        ...record,
        pulseId: record.pulseId.trim().toUpperCase(),
        createdAt: record.createdAt || new Date().toISOString(),
      });
      if (inserted) imported += 1;
      else skipped += 1;
    } catch (error: unknown) {
      failures.push(`${record.pulseId} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`[import-directions] imported ${imported}/${records.length} directions; ${skipped} already present and left unchanged.`);

  if (failures.length > 0) {
    console.error(`[import-directions] ${failures.length} record(s) failed:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("[import-directions] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
