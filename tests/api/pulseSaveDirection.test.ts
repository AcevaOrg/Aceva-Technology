import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /api/pulse/save-direction after the P1 hardening (30 October 2026).
 *
 * References are generated on the server, writes are insert-only, every field
 * is validated, Turnstile is verified server-side and rate limits are shared.
 * The store is an in-memory, insert-only mock with the same contract as
 * `createDirection`; Resend is a spy; the rate-limit store is an injected
 * in-memory store. All data is synthetic and nothing reaches a database.
 */

const send = vi.fn();
vi.mock("resend", () => ({ Resend: class { emails = { send }; } }));

type Row = { pulseId: string; lead: { name: string; contact: string; method: string }; [key: string]: unknown };
const store = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  failWrites: false,
  /** When set, the next inserts throw this instead of the generic outage. */
  failWith: null as unknown,
  /** Number of upcoming inserts to report as a reference clash. */
  conflicts: 0,
  inserts: 0,
}));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => {
    throw new Error("the save route must never call the overwriting upsert");
  },
  createDirection: async (direction: { pulseId: string }) => {
    store.inserts += 1;
    if (store.failWith) throw store.failWith;
    if (store.failWrites) throw new Error("neon: connection terminated unexpectedly at 10.0.0.12:5432");
    if (store.conflicts > 0) {
      store.conflicts -= 1;
      return false;
    }
    if (store.rows.has(direction.pulseId)) return false;
    store.rows.set(direction.pulseId, structuredClone(direction));
    return true;
  },
  getDirection: async (id: string) => store.rows.get(id) ?? null,
}));

import { POST } from "@/app/api/pulse/save-direction/route";
import { PULSE_ID_PATTERN } from "@/lib/pulse/pulseId";
import { DatabaseOperationError, DatabaseUnavailableError } from "@/lib/pulse/db";
import { MemoryRateLimitStore, setRateLimitStoreForTests } from "@/lib/security/sharedRateLimit";

const TEAM = "contact@acevatech.com";

function saveRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/pulse/save-direction", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `198.51.100.${Math.floor(Math.random() * 250)}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let contactCounter = 0;
function payload(overrides: Record<string, unknown> = {}) {
  contactCounter += 1;
  return {
    lead: { name: "Synthetic Visitor", contact: `visitor${contactCounter}@example.test`, method: "Email" },
    context: {
      intent: "Automate something",
      industry: "Logistics",
      business: "Distributed operation",
      friction: ["Dispatch visibility"],
      goals: ["Live operations"],
      scale: "3 depots, 45 drivers",
      market: "New York",
      timeline: "6 weeks",
      budget: "Around $15k",
    },
    answers: ["We run a courier business", "Dispatch is all phone calls"],
    ...overrides,
  };
}

function rows(): Row[] {
  return [...store.rows.values()] as Row[];
}

describe("POST /api/pulse/save-direction", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
    store.rows.clear();
    store.failWrites = false;
    store.failWith = null;
    store.conflicts = 0;
    store.inserts = 0;
    setRateLimitStoreForTests(new MemoryRateLimitStore());
    // Trust x-real-ip, as on Vercel, so each request can be its own client.
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_TO_EMAIL", TEAM);
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("server-generated references", () => {
    it("saves under a reference it generated, ignoring any the browser sends", async () => {
      const response = await POST(saveRequest(payload({ pulseId: "PLS-261030-502" })));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.pulseId).toMatch(PULSE_ID_PATTERN);
      expect(body.pulseId).not.toBe("PLS-261030-502");
      expect(rows().map((row) => row.pulseId)).toEqual([body.pulseId]);
    });

    it("R2: a reference pre-claimed by someone else cannot block or touch a real visitor's save", async () => {
      const squatter = await (await POST(saveRequest(payload({ pulseId: "PLS-261030-502" })))).json();
      const visitorPayload = payload({ pulseId: "PLS-261030-502" });
      const visitor = await POST(saveRequest(visitorPayload));
      const visitorBody = await visitor.json();

      expect(visitor.status).toBe(200);
      expect(visitorBody.pulseId).not.toBe(squatter.pulseId);
      const squatterRow = store.rows.get(squatter.pulseId) as Row;
      expect(squatterRow.lead.contact).not.toBe(visitorPayload.lead.contact);
    });

    it("R3: a future-dated reference from the browser is simply ignored", async () => {
      const body = await (await POST(saveRequest(payload({ pulseId: "PLS-991231-999" })))).json();
      expect(body.pulseId).toMatch(PULSE_ID_PATTERN);
      expect(store.rows.has("PLS-991231-999")).toBe(false);
    });

    it("creates distinct references for concurrent saves, with no lost or merged records", async () => {
      const responses = await Promise.all(Array.from({ length: 20 }, () => POST(saveRequest(payload()))));
      const ids = await Promise.all(responses.map(async (response) => (await response.json()).pulseId as string));

      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(new Set(ids).size).toBe(20);
      expect(store.rows.size).toBe(20);
    });

    it("never overwrites: a duplicate submission becomes a second record", async () => {
      const same = payload();
      const first = await (await POST(saveRequest(same))).json();
      const firstRow = structuredClone(store.rows.get(first.pulseId));
      const second = await (await POST(saveRequest({ ...same, lead: { ...same.lead, name: "Changed Name" } }))).json();

      expect(second.pulseId).not.toBe(first.pulseId);
      expect(store.rows.get(first.pulseId)).toEqual(firstRow);
    });

    it("draws a fresh reference when an insert clashes", async () => {
      store.conflicts = 2;
      const response = await POST(saveRequest(payload()));
      expect(response.status).toBe(200);
      expect(store.inserts).toBe(3);
      expect(store.rows.size).toBe(1);
    });

    it("gives up generically after three clashes, writing nothing", async () => {
      store.conflicts = 3;
      const response = await POST(saveRequest(payload()));
      expect(response.status).toBe(503);
      expect(store.rows.size).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("input limits", () => {
    const invalid: [string, Record<string, unknown>, string][] = [
      ["R4: a 12,000-character answer", { answers: ["A".repeat(12_000)] }, "answers"],
      ["21 answers", { answers: Array.from({ length: 21 }, (_, i) => `answer ${i}`) }, "answers"],
      ["a non-string answer", { answers: [{ html: "<b>x</b>" }] }, "answers"],
      ["context.business over 500", { context: { business: "B".repeat(501) } }, "context.business"],
      ["11 friction items", { context: { friction: Array.from({ length: 11 }, () => "x") } }, "context.friction"],
      ["a name over 120", { lead: { name: "N".repeat(121), contact: "a@example.test" } }, "name"],
      ["an invalid contact", { lead: { name: "N", contact: "not an address" } }, "contact"],
      ["two addresses in one contact", { lead: { name: "N", contact: "a@example.test,b@example.test" } }, "contact"],
      ["an unknown method", { lead: { name: "N", contact: "a@example.test", method: "Carrier pigeon" } }, "method"],
      ["an unexpected top-level field", { isAdmin: true }, "body"],
    ];

    for (const [label, overrides, field] of invalid) {
      it(`rejects ${label}, storing and emailing nothing`, async () => {
        const response = await POST(saveRequest(payload(overrides)));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.code).toBe("VALIDATION_FAILED");
        expect(body.errors?.[field]).toBe(true);
        expect(store.rows.size).toBe(0);
        expect(send).not.toHaveBeenCalled();
      });
    }

    it("accepts a phone number as the contact", async () => {
      const response = await POST(saveRequest(payload({ lead: { name: "N", contact: "+44 7700 900456", method: "Phone" } })));
      expect(response.status).toBe(200);
    });

    it("rejects malformed JSON", async () => {
      const response = await POST(saveRequest("{not json"));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_JSON");
    });

    it("rejects an oversized body before parsing it", async () => {
      const response = await POST(saveRequest(JSON.stringify(payload({ padding: "x".repeat(20_000) }))));
      expect(response.status).toBe(413);
    });

    it("rejects a foreign origin and a non-JSON body", async () => {
      expect((await POST(saveRequest(payload(), { origin: "https://evil.example" }))).status).toBe(403);
      expect((await POST(saveRequest("x", { "content-type": "text/plain" }))).status).toBe(415);
    });
  });

  describe("privacy and failure handling", () => {
    it("rejects a disposable address without logging it", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await POST(saveRequest(payload({ lead: { name: "N", contact: "throwaway@mailinator.com" } })));

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("DISPOSABLE_EMAIL");
      const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
      expect(logged).not.toContain("throwaway@mailinator.com");
    });

    it("reports a database outage generically, without internal detail, and sends nothing", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      store.failWrites = true;
      const response = await POST(saveRequest(payload()));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toMatch(/neon|10\.0\.0\.12|5432/);
      expect(send).not.toHaveBeenCalled();
    });

    it("logs the operation and failure category of a refused database, but no message, host or visitor data", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      store.failWith = new DatabaseOperationError(
        "prepare-table",
        new DatabaseUnavailableError("Database target refused (endpoint-unconfigured) in the local runtime.", "target-refused:endpoint-unconfigured")
      );
      const response = await POST(saveRequest(payload({ lead: { name: "Log Probe", contact: "log.probe@example.test", method: "Email" } })));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.code).toBe("SERVICE_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toMatch(/endpoint|prepare-table|refused/);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[pulse-save-direction\]\[req_[0-9a-f]+\] SERVICE_UNAVAILABLE$/),
        expect.objectContaining({ reason: "direction-store-write-failed", operation: "prepare-table", category: "target-refused:endpoint-unconfigured" })
      );
      const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
      expect(logged).not.toMatch(/log\.probe@example\.test|Log Probe|Database target refused/);
    });

    it("logs a rejected query's SQLSTATE without the Postgres message, which can quote submitted values", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const rejected = Object.assign(new Error('invalid input syntax for type json: "secret.visitor@example.test"'), {
        name: "NeonDbError",
        code: "22P02",
      });
      store.failWith = new DatabaseOperationError("insert", rejected);
      const response = await POST(saveRequest(payload()));

      expect(response.status).toBe(503);
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ operation: "insert", category: "query-rejected", sqlstate: "22P02" })
      );
      expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain("secret.visitor@example.test");
    });

    it("still succeeds when the team email fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      send.mockRejectedValue(new Error("provider down"));
      expect((await POST(saveRequest(payload()))).status).toBe(200);
    });

    it("still succeeds with no email provider configured", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.stubEnv("RESEND_API_KEY", "");
      expect((await POST(saveRequest(payload()))).status).toBe(200);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("the team notification", () => {
    it("goes only to ACEVA's inbox and carries the qualification fields", async () => {
      const response = await POST(saveRequest(payload()));
      const { pulseId } = await response.json();

      expect(send).toHaveBeenCalledOnce();
      const mail = send.mock.calls[0][0] as { to: string; text: string; replyTo?: string };
      expect(mail.to).toBe(TEAM);
      expect(mail.text).toContain(`PULSE Reference ID: ${pulseId}`);
      expect(mail.text).toContain("Budget: Around $15k");
      expect(mail.text).toContain("Operation Scale: 3 depots, 45 drivers");
      expect(mail.text).toContain("Market: New York");
      expect(mail.text).toContain("Timeline: 6 weeks");
    });

    it("defangs links in visitor text and ignores browser-supplied module names", async () => {
      await POST(
        saveRequest(
          payload({
            context: { business: "Verify your account at https://evil.example/login or www.evil.example" },
            recommendedModules: ["Visit https://evil.example/claim"],
          })
        )
      );
      const text = (send.mock.calls[0][0] as { text: string }).text;

      expect(text).not.toMatch(/https?:\/\/evil/);
      expect(text).not.toContain("evil.example");
      expect(text).toContain("hxxps[://]");
      expect(text).not.toContain("/claim");
    });
  });

  describe("shared rate limits", () => {
    it("limits saves per client address", async () => {
      const statuses: number[] = [];
      for (let n = 0; n < 6; n++) {
        statuses.push((await POST(saveRequest(payload(), { "x-real-ip": "203.0.113.10" }))).status);
      }
      expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
      expect(statuses[5]).toBe(429);
    });

    it("limits saves per contact, across different client addresses", async () => {
      const contact = "busy.person@example.test";
      const statuses: number[] = [];
      for (let n = 0; n < 4; n++) {
        statuses.push((await POST(saveRequest(payload({ lead: { name: "N", contact } }), { "x-real-ip": `203.0.113.${20 + n}` }))).status);
      }
      expect(statuses).toEqual([200, 200, 200, 429]);
    });

    it("refuses rather than allowing unlimited saves when the shared store is down", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      setRateLimitStoreForTests({ hit: async () => { throw new Error("store down"); } });
      const response = await POST(saveRequest(payload()));
      expect(response.status).toBe(503);
      expect(store.rows.size).toBe(0);
    });
  });
});
