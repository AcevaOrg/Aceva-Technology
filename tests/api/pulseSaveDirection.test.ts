import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

// The direction store talks to Neon. Tests must never need a live database; the
// flags let individual cases exercise the read/write failure and ownership paths.
type StoredLead = { name: string; contact: string; method: string };
const store = vi.hoisted(() => ({
  failNextWrite: false,
  failNextRead: false,
  writes: 0,
  existing: null as null | { pulseId: string; lead: StoredLead; createdAt: string },
}));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => {
    if (store.failNextWrite) throw new Error("neon: connection terminated unexpectedly");
    store.writes += 1;
  },
  getDirection: async () => {
    if (store.failNextRead) throw new Error("neon: connection terminated unexpectedly");
    return store.existing;
  },
}));

import { POST } from "@/app/api/pulse/save-direction/route";

function createSaveDirectionRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/pulse/save-direction", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  pulseId: "PLS-260826-883",
  lead: {
    name: "Jordan Ellis",
    contact: "jordan@example.com",
    method: "Email",
  },
  context: {
    intent: "Automate something",
    industry: "Logistics",
    business: "Distributed operation",
    friction: ["Dispatch visibility"],
    goals: ["Live operations"],
  },
  recommendedModules: ["Dispatch control tower", "Fleet tracking & visibility"],
};

describe("POST /api/pulse/save-direction Route Handler", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    store.failNextWrite = false;
    store.failNextRead = false;
    store.writes = 0;
    store.existing = null;
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_TO_EMAIL", "acevatech.official@gmail.com");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  it("submits direction successfully and emails ACEVA team", async () => {
    const response = await POST(createSaveDirectionRequest(validPayload));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.pulseId).toBe("PLS-260826-883");
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "acevatech.official@gmail.com",
        subject: expect.stringContaining("Jordan Ellis"),
        replyTo: "jordan@example.com",
      })
    );
  });

  it("carries the qualification fields the team acts on into the lead email", async () => {
    // The wizard has always inferred budget, scale and market, and the route has
    // always whitelisted scale and market — but the email listed neither, and
    // budget was dropped from the payload entirely, so the single field the team
    // most needs never left the browser.
    const response = await POST(
      createSaveDirectionRequest({
        ...validPayload,
        context: {
          ...validPayload.context,
          scale: "3 depots, 45 drivers",
          market: "New York",
          timeline: "6 weeks",
          budget: "Around $15k",
        },
      })
    );

    expect(response.status).toBe(200);
    const emailText = send.mock.calls[0][0].text as string;
    expect(emailText).toContain("Budget: Around $15k");
    expect(emailText).toContain("Operation Scale: 3 depots, 45 drivers");
    expect(emailText).toContain("Market: New York");
    expect(emailText).toContain("Timeline: 6 weeks");
  });

  it("still sends a readable email when those fields were never collected", async () => {
    const response = await POST(createSaveDirectionRequest(validPayload));

    expect(response.status).toBe(200);
    const emailText = send.mock.calls[0][0].text as string;
    expect(emailText).toContain("Budget: To be discussed");
    expect(emailText).toContain("Operation Scale: Not specified");
  });

  it("returns ok:false and does not email when the direction store write fails", async () => {
    store.failNextWrite = true;

    const response = await POST(createSaveDirectionRequest(validPayload));
    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.code).toBe("SERVICE_UNAVAILABLE");
    expect(data.pulseId).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects request missing lead name or contact", async () => {
    const response = await POST(
      createSaveDirectionRequest({ ...validPayload, lead: { name: "", contact: "" } })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Please check your details");
    expect(send).not.toHaveBeenCalled();
  });

  describe("PULSE ID format", () => {
    const malformed = [
      ["empty", ""],
      ["missing", undefined],
      ["short date", "PLS-26082-883"],
      ["long date", "PLS-2608266-883"],
      ["short suffix", "PLS-260826-88"],
      ["long suffix", "PLS-260826-8833"],
      ["wrong prefix", "XPLS-260826-883"],
      ["trailing text", "PLS-260826-883 extra"],
      ["sql-ish payload", "PLS-260826-883; DROP TABLE directions"],
      ["non-numeric", "PLS-ABCDEF-XYZ"],
    ] as const;

    for (const [label, value] of malformed) {
      it(`rejects a ${label} pulseId without writing or emailing`, async () => {
        const response = await POST(createSaveDirectionRequest({ ...validPayload, pulseId: value }));
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.ok).toBe(false);
        expect(data.code).toBe("VALIDATION_FAILED");
        expect(store.writes).toBe(0);
        expect(send).not.toHaveBeenCalled();
      });
    }

    it("accepts a lowercase pulseId and normalises it to upper case", async () => {
      const response = await POST(
        createSaveDirectionRequest({ ...validPayload, pulseId: "pls-260826-883" })
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ok).toBe(true);
      expect(data.pulseId).toBe("PLS-260826-883");
      expect(store.writes).toBe(1);
    });
  });

  describe("PULSE ID ownership", () => {
    it("lets the same lead re-save their own direction", async () => {
      store.existing = {
        pulseId: "PLS-260826-883",
        lead: { name: "Jordan Ellis", contact: "jordan@example.com", method: "Email" },
        createdAt: "2026-09-02T16:43:05.666Z",
      };

      const response = await POST(createSaveDirectionRequest(validPayload));
      expect(response.status).toBe(200);
      expect((await response.json()).ok).toBe(true);
      expect(store.writes).toBe(1);
    });

    it("matches the owning contact case-insensitively", async () => {
      store.existing = {
        pulseId: "PLS-260826-883",
        lead: { name: "Jordan Ellis", contact: "  Jordan@Example.COM  ", method: "Email" },
        createdAt: "2026-09-02T16:43:05.666Z",
      };

      const response = await POST(createSaveDirectionRequest(validPayload));
      expect(response.status).toBe(200);
      expect(store.writes).toBe(1);
    });

    it("refuses to overwrite a record owned by a different lead", async () => {
      store.existing = {
        pulseId: "PLS-260826-883",
        lead: { name: "Jordan Ellis", contact: "jordan@example.com", method: "Email" },
        createdAt: "2026-09-02T16:43:05.666Z",
      };

      const response = await POST(
        createSaveDirectionRequest({
          ...validPayload,
          lead: { name: "Someone Else", contact: "attacker@example.com", method: "Email" },
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe("VALIDATION_FAILED");
      // The reply must not reveal that this id exists or who owns it.
      expect(JSON.stringify(data)).not.toContain("jordan@example.com");
      expect(JSON.stringify(data)).not.toContain("Jordan Ellis");
      expect(store.writes).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });

    it("returns ok:false when the ownership check cannot read the store", async () => {
      store.failNextRead = true;

      const response = await POST(createSaveDirectionRequest(validPayload));
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe("SERVICE_UNAVAILABLE");
      expect(store.writes).toBe(0);
      expect(send).not.toHaveBeenCalled();
    });
  });
  it("rejects disposable email addresses", async () => {
    const response = await POST(
      createSaveDirectionRequest({
        ...validPayload,
        lead: { ...validPayload.lead, contact: "fake@mailinator.com" },
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("Please use your real work email address");
    expect(send).not.toHaveBeenCalled();
  });
});
