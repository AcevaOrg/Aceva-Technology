import { after } from "next/server";
import { getDatabaseUrl } from "./env";
import { getSql, withTimeout } from "./db";

/**
 * One analytics row per chat turn.
 *
 * Deliberately not a transcript. The only identifier is `sessionId`, an opaque
 * value the browser generates for itself — it is not derived from a name, an
 * email, an IP or anything else that identifies a person. `question` is stored
 * so drop-off can be read in context, with obvious personal data stripped
 * first; see `redactPii`.
 */
export interface ChatTurnLog {
  sessionId: string;
  requestId: string;
  question: string;
  intent?: string;
  step?: number;
  targetField?: string;
  isValid: boolean;
  isFallback: boolean;
  streamed: boolean;
  latencyMs: number;
  errorCode?: string;
}

/** Longest question text kept. Anything past this is analytics noise. */
const MAX_QUESTION_CHARS = 500;

/**
 * Strips the personal data a visitor may type into a chat box.
 *
 * Someone answering "what does your operation look like" will sometimes include
 * their own email or phone number, and this table is for drop-off analytics,
 * not for holding contact details. Each pattern is replaced with a marker so
 * the shape of the sentence survives for analysis.
 */
export function redactPii(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    // Long digit runs: card-like numbers before phone-like ones, so the more
    // specific match wins.
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[number]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .trim();
}

/**
 * Characters Postgres will not accept in a text column.
 *
 * A visitor message containing a NUL byte failed the insert with `invalid byte
 * sequence for encoding "UTF8": 0x00`. The write is fire-and-forget, so the
 * visitor still got their answer and nothing surfaced — but the turn was
 * silently dropped, and an input odd enough to carry control bytes is exactly
 * the one worth keeping. Tab, newline and carriage return are valid and stay.
 */
const UNSTORABLE_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripUnstorableCharacters(text: string): string {
  return text.replace(UNSTORABLE_CHARACTERS, "");
}

/**
 * True when analytics writes must be suppressed.
 *
 * `lib/pulse/env.ts` reads `.env.local` straight off disk whenever
 * `process.env.DATABASE_URL` is unset, so DATABASE_URL is populated under
 * vitest even though the runner never loads it. Every API test that exercised
 * the chat route was therefore inserting real rows into the production
 * `chat_turns` table — confirmed by finding a row whose question was
 * "We run three restaurants and want direct online ordering", a string that
 * exists only in tests/api/pulseFallbackAndSteps.test.ts.
 */
export function isTurnLogSuppressed(): boolean {
  // Explicit opt-out first, so a QA harness can force suppression regardless
  // of how it was launched. playwright.config.ts sets this for its dev server.
  if (process.env.PULSE_DISABLE_TURN_LOG === "1") return true;

  // Then allow-list rather than deny-list. Enumerating test contexts was not
  // reliable: the previous `VITEST || NODE_ENV === "test"` check covered the
  // vitest suites but not `npm run test:e2e` (which runs `next dev`, so
  // NODE_ENV is "development") and not ad-hoc `tsx` scripts — both of which
  // reached the production table. Only a real production build writes; Next
  // sets NODE_ENV=production for `next build`/`next start`, so normal
  // deployment logging is unaffected.
  return process.env.NODE_ENV !== "production";
}

let schemaReady: Promise<void> | null = null;

/**
 * Creates the table on first use. A rejection is left uncached so the next
 * caller retries rather than inheriting a permanently broken log.
 */
export async function ensureChatTurnsTable(): Promise<void> {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = withTimeout(sql`
      CREATE TABLE IF NOT EXISTS chat_turns (
        id            BIGSERIAL PRIMARY KEY,
        session_id    TEXT NOT NULL,
        request_id    TEXT NOT NULL,
        question      TEXT NOT NULL,
        intent        TEXT,
        step          INTEGER,
        target_field  TEXT,
        is_valid      BOOLEAN NOT NULL,
        is_fallback   BOOLEAN NOT NULL,
        streamed      BOOLEAN NOT NULL,
        latency_ms    INTEGER NOT NULL,
        error_code    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `, "chat_turns DDL")
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

/**
 * Writes one turn. Throws on failure; `logChatTurn` is the call most code wants.
 *
 * Idempotent per request: the row is inserted only if no row for the same
 * request id exists, so a retried write or a second call for one request
 * cannot double-count it. (The route also logs each request at most once.)
 * A unique index on request_id would make this airtight under concurrency;
 * adding one is a reviewed migration step, not something done at runtime.
 * Resolves true when a row was written, false when one already existed.
 */
export async function recordChatTurn(turn: ChatTurnLog): Promise<boolean> {
  await ensureChatTurnsTable();
  const sql = getSql();

  const rows = (await withTimeout(sql`
    INSERT INTO chat_turns (
      session_id, request_id, question, intent, step,
      target_field, is_valid, is_fallback, streamed, latency_ms, error_code
    )
    SELECT
      ${stripUnstorableCharacters(turn.sessionId)}::text,
      ${turn.requestId}::text,
      ${stripUnstorableCharacters(redactPii(turn.question)).slice(0, MAX_QUESTION_CHARS)}::text,
      ${turn.intent ?? null}::text,
      ${turn.step ?? null}::integer,
      ${turn.targetField ?? null}::text,
      ${turn.isValid}::boolean,
      ${turn.isFallback}::boolean,
      ${turn.streamed}::boolean,
      ${Math.max(0, Math.round(turn.latencyMs))}::integer,
      ${turn.errorCode ?? null}::text
    WHERE NOT EXISTS (SELECT 1 FROM chat_turns WHERE request_id = ${turn.requestId}::text)
    RETURNING id
  `, "chat_turns insert")) as unknown[];

  return rows.length > 0;
}

/**
 * Fire-and-forget logging.
 *
 * Analytics must never cost a visitor their answer, so a failure here is logged
 * and swallowed: no throw reaches the request, and the write is not awaited by
 * the response path.
 */
export function logChatTurn(turn: ChatTurnLog): void {
  if (!getDatabaseUrl()) return;
  // The test runner must never reach the real analytics table. See
  // isTurnLogSuppressed for why DATABASE_URL is populated under vitest.
  if (isTurnLogSuppressed()) return;

  // One line per outcome, keyed by request id and never carrying the
  // question, so logs can be reconciled against stored rows: every
  // "recorded" line is one row, and "failed" lines are the turns lost.
  const write = recordChatTurn(turn).then(
    (inserted) => {
      console.info(inserted ? "[turnLog] recorded" : "[turnLog] duplicate ignored", { requestId: turn.requestId });
    },
    (error: unknown) => {
      console.error("[turnLog] failed to record chat turn", {
        requestId: turn.requestId,
        reason: error instanceof Error ? error.message : "unknown error",
      });
    }
  );

  // On a serverless host the function can be frozen the moment the response
  // ends, and an un-awaited write is discarded with it. Production showed the
  // symptom: seven completed turns in the logs, five rows in the table. `after`
  // keeps the invocation alive until the write settles, without delaying the
  // response. Outside a request scope — a script, a unit test — `after` throws
  // synchronously; the promise above is already running, so that is harmless.
  try {
    after(write);
  } catch (error: unknown) {
    // No request scope to extend, or a host that offers no `waitUntil`. The
    // write still proceeds, but nothing keeps the invocation alive for it, so
    // say so: this branch is only reachable when writes are not suppressed,
    // and in production it means turns can be lost again.
    console.warn("[turnLog] after() unavailable; the write is not kept alive", {
      requestId: turn.requestId,
      reason: error instanceof Error ? error.message : "unknown error",
    });
  }
}
