import { describe, expect, it, vi } from "vitest";

/**
 * The Neon driver is mocked for the whole file so no assertion here can reach a
 * real database. That is the point of the isolation tests below.
 */
const sqlMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
const neonMock = vi.hoisted(() => vi.fn(() => sqlMock));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
import {
  redactPii,
  stripUnstorableCharacters,
  isTurnLogSuppressed,
  logChatTurn,
  recordChatTurn,
} from "@/lib/pulse/turnLog";
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);
const ESC = String.fromCharCode(27);
const DEL = String.fromCharCode(127);
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);


describe("redactPii", () => {
  describe("removes contact details a visitor may type into the chat", () => {
    const cases = [
      ["email", "Reach me at jordan@example.com tomorrow", "jordan@example.com", "[email]"],
      ["email with plus tag", "use jordan+pulse@example.co.uk", "jordan+pulse@example.co.uk", "[email]"],
      ["spaced phone", "Call 0161 496 0000 after six", "0161 496 0000", "[phone]"],
      ["international phone", "ring +44 7700 900123 please", "+44 7700 900123", "[phone]"],
      ["bracketed phone", "on (0161) 496-0000 weekdays", "0161", "[phone]"],
      ["card-length number", "my card is 4111 1111 1111 1111", "4111 1111 1111 1111", "[number]"],
    ] as const;

    for (const [label, input, secret, marker] of cases) {
      it(label, () => {
        const output = redactPii(input);
        expect(output).not.toContain(secret);
        expect(output).toContain(marker);
      });
    }

    it("handles several in one message", () => {
      const output = redactPii("jordan@example.com or +44 7700 900123");
      expect(output).toContain("[email]");
      expect(output).toContain("[phone]");
      expect(output).not.toMatch(/@example|900123/);
    });
  });

  describe("keeps the sentence usable for analytics", () => {
    it("leaves ordinary business answers untouched", () => {
      const samples = [
        "We run three restaurants and want direct online ordering",
        "Two locations, 15 staff, about 300 orders a day",
        "Target launch in 4-6 weeks",
        "Our budget is around $15k",
      ];

      for (const sample of samples) {
        expect(redactPii(sample)).toBe(sample);
      }
    });

    it("preserves short counts that are not contact details", () => {
      expect(redactPii("we have 3 chairs and 12 staff")).toBe("we have 3 chairs and 12 staff");
    });

    it("keeps the surrounding words when it redacts", () => {
      const output = redactPii("Email me at jordan@example.com about the quote");
      expect(output).toContain("Email me at");
      expect(output).toContain("about the quote");
    });

    it("trims and tolerates an empty message", () => {
      expect(redactPii("   padded   ")).toBe("padded");
      expect(redactPii("")).toBe("");
    });
  });
});

describe("characters Postgres cannot store", () => {
  // A visitor message containing a NUL byte failed the insert with
  // `invalid byte sequence for encoding "UTF8": 0x00`. The write is
  // fire-and-forget, so the visitor still got their answer and the turn was
  // dropped in silence — losing exactly the odd inputs worth keeping.
  it("removes a NUL byte", () => {
    expect(stripUnstorableCharacters("before" + NUL + "after")).toBe("beforeafter");
  });

  it("removes the other control characters Postgres rejects", () => {
    const dirty = "a" + BEL + "b" + ESC + "c" + DEL + "d";
    expect(stripUnstorableCharacters(dirty)).toBe("abcd");
  });

  it("keeps tab, newline and carriage return, which are valid", () => {
    expect(stripUnstorableCharacters("a" + TAB + "b" + LF + "c" + CR + "d")).toBe(
      "a" + TAB + "b" + LF + "c" + CR + "d",
    );
  });

  it("leaves ordinary text and redacted markers untouched", () => {
    expect(stripUnstorableCharacters("We run 3 locations [email]")).toBe("We run 3 locations [email]");
    expect(stripUnstorableCharacters("")).toBe("");
  });

  it("composes with redactPii so a NUL cannot survive the pipeline", () => {
    const written = stripUnstorableCharacters(redactPii("mail me at a@b.com" + NUL));
    expect(written).toBe("mail me at [email]");
  });
});

describe("the analytics table is never written from the test runner", () => {
  // lib/pulse/env.ts reads .env.local off disk whenever process.env.DATABASE_URL
  // is unset, so DATABASE_URL is populated under vitest even though the runner
  // never loads it. Every API test touching the chat route was inserting real
  // rows into the production chat_turns table; a row whose question was
  // "We run three restaurants and want direct online ordering" — a string only
  // tests/api/pulseFallbackAndSteps.test.ts sends — confirmed it.
  it("suppresses writes under the test runner", () => {
    expect(isTurnLogSuppressed()).toBe(true);
  });

  it("suppresses writes in development, which is how the e2e dev server runs", () => {
    // The gap this closes: `npm run test:e2e` starts `next dev`, so NODE_ENV is
    // "development" and the old VITEST/NODE_ENV==="test" check did not apply.
    // vi.stubEnv rather than direct assignment: process.env.NODE_ENV is typed
    // readonly, so assigning to it passes vitest but fails `tsc --noEmit`.
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "development");
    try {
      expect(isTurnLogSuppressed()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("suppresses writes for an ad-hoc script with no NODE_ENV set", () => {
    // Ad-hoc `tsx` harnesses were the other bypass; they inherit no NODE_ENV.
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "");
    try {
      expect(isTurnLogSuppressed()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("honours the explicit PULSE_DISABLE_TURN_LOG opt-out even in production", () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PULSE_DISABLE_TURN_LOG", "1");
    try {
      expect(isTurnLogSuppressed()).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not suppress writes in a normal runtime", () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(isTurnLogSuppressed()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("logChatTurn is a no-op here rather than reaching the database", () => {
    expect(() =>
      logChatTurn({
        sessionId: "unit-test",
        requestId: "req-unit",
        question: "would otherwise be inserted",
        isValid: false,
        isFallback: false,
        streamed: false,
        latencyMs: 1,
      }),
    ).not.toThrow();
  });
});


describe("database isolation, proven against a mocked driver", () => {
  // Never against production: the Neon driver is mocked at the top of this file,
  // so these tests observe whether a query WOULD be issued, without issuing one.
  it("issues no query at all when running under the test runner", async () => {
    sqlMock.mockClear();
    neonMock.mockClear();

    logChatTurn({
      sessionId: "isolation-check",
      requestId: "req-isolation",
      question: "this must never reach a database",
      isValid: false,
      isFallback: false,
      streamed: false,
      latencyMs: 3,
    });
    // Give any accidental fire-and-forget promise a turn to run.
    await Promise.resolve();

    expect(sqlMock, "a query was issued from the test runner").not.toHaveBeenCalled();
    expect(neonMock, "a database client was created from the test runner").not.toHaveBeenCalled();
  });

  it("still writes when the application runs normally", async () => {
    // Proves the guard suppresses the test runner specifically, and has not
    // disabled production logging.
    sqlMock.mockClear();
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(isTurnLogSuppressed()).toBe(false);

      await recordChatTurn({
        sessionId: "prod-path",
        requestId: "req-prod",
        question: "ordinary question",
        isValid: true,
        isFallback: false,
        streamed: true,
        latencyMs: 42,
      });

      // ensureChatTurnsTable + the INSERT.
      expect(sqlMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sanitises a NUL byte out of the values it would insert", async () => {
    sqlMock.mockClear();
    vi.stubEnv("VITEST", "");
    vi.stubEnv("NODE_ENV", "production");
    try {
      await recordChatTurn({
        sessionId: "sess" + NUL + "ion",
        requestId: "req-nul",
        question: "before" + NUL + "after",
        isValid: false,
        isFallback: false,
        streamed: false,
        latencyMs: 1,
      });

      // The INSERT is the last call; its interpolated values must be clean.
      const lastCall: unknown[] = sqlMock.mock.calls.at(-1) ?? [];
      const text = lastCall
        .slice(1)
        .filter((value): value is string => typeof value === "string")
        .join("|");
      expect(text).not.toContain(NUL);
      expect(text).toContain("beforeafter");
      expect(text).toContain("session");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
