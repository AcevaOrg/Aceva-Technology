/**
 * Creates (or verifies) the `directions` table backing lib/pulse/directionStore.
 *
 *   npm run migrate:directions
 *
 * Safe to re-run — the DDL is CREATE TABLE IF NOT EXISTS. The app also calls
 * ensureDirectionsTable() lazily on first query, so this script exists mainly to
 * provision the schema ahead of a deploy and to fail loudly if it cannot.
 */
import { ensureDirectionsTable } from "../lib/pulse/directionStore";
import { getDatabaseUrl } from "../lib/pulse/env";

async function main(): Promise<void> {
  if (!getDatabaseUrl()) {
    console.error("[migrate-directions] DATABASE_URL is not set. Add it to .env.local or the environment and re-run.");
    process.exit(1);
  }

  await ensureDirectionsTable();
  console.log("[migrate-directions] `directions` table is present.");
}

main().catch((error: unknown) => {
  console.error("[migrate-directions] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
