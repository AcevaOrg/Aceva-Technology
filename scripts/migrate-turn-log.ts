/**
 * Creates (or verifies) the `chat_turns` analytics table.
 *
 *   npm run migrate:turn-log
 *
 * Safe to re-run: the DDL is CREATE TABLE IF NOT EXISTS. The route also calls
 * ensureChatTurnsTable() lazily on first write, so this exists to provision the
 * schema ahead of a deploy and to fail loudly if it cannot.
 */
import { ensureChatTurnsTable } from "../lib/pulse/turnLog";
import { getDatabaseUrl } from "../lib/pulse/env";

async function main(): Promise<void> {
  if (!getDatabaseUrl()) {
    console.error("[migrate-turn-log] DATABASE_URL is not set. Add it to .env.local or the environment and re-run.");
    process.exit(1);
  }

  await ensureChatTurnsTable();
  console.log("[migrate-turn-log] `chat_turns` table is present.");
}

main().catch((error: unknown) => {
  console.error("[migrate-turn-log] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
