import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const store = vi.hoisted(() => ({
  direction: null as null | Record<string, unknown>,
  failRead: false,
}));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => {
    if (store.failRead) throw new Error("neon: connection terminated unexpectedly");
    return store.direction;
  },
}));

import { POST } from "@/app/api/pulse/email-blueprint/route";
import { renderBlueprintEmail } from "@/lib/pulse/blueprintEmail";
import { resetRateLimitStore, RATE_LIMIT_RULES } from "@/lib/rateLimit";

const PULSE_ID = "PLS-260826-883";
const OWNER = "jordan@example.com";

function savedDirection(overrides: Record<string, unknown> = {}) {
  return {
    pulseId: PULSE_ID,
    lead: { name: "Jordan Ellis", contact: OWNER, method: "Email" },
    context: { intent: "Automate something", industry: "Logistics", goals: ["Live operations"] },
    answers: ["We run a courier fleet", "Dispatch is on paper"],
    recommendedModules: ["Dispatch control tower"],
    createdAt: "2026-09-02T16:43:05.666Z",
    ...overrides,
  };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/pulse/email-blueprint", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/pulse/email-blueprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    resetRateLimitStore();
    store.direction = savedDirection();
    store.failRead = false;
    vi.stubEnv("RESEND_API_KEY", "test-key");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  it("emails the blueprint to the address the direction was saved under", async () => {
    const response = await POST(request({ pulseId: PULSE_ID, contact: OWNER }));

    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
    expect(send).toHaveBeenCalledOnce();

    const sent = send.mock.calls[0][0];
    expect(sent.to).toBe(OWNER);
    expect(sent.subject).toContain(PULSE_ID);
    expect(sent.text).toContain("Jordan");
    expect(sent.text).toContain("Dispatch control tower");
  });

  it("accepts the owning contact case- and whitespace-insensitively", async () => {
    const response = await POST(request({ pulseId: PULSE_ID, contact: "  Jordan@Example.COM " }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("accepts a lowercase pulse id", async () => {
    const response = await POST(request({ pulseId: "pls-260826-883", contact: OWNER }));
    expect(response.status).toBe(200);
  });

  describe("ownership", () => {
    // A PULSE ID is short and guessable, so without proof the caller already
    // knows the stored address this endpoint would mail arbitrary strangers.
    it("refuses when the contact does not match the stored one", async () => {
      const response = await POST(request({ pulseId: PULSE_ID, contact: "attacker@example.com" }));

      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
      expect(send).not.toHaveBeenCalled();
    });

    it("refuses an unknown pulse id", async () => {
      store.direction = null;

      const response = await POST(request({ pulseId: "PLS-260826-999", contact: OWNER }));
      expect(response.status).toBe(400);
      expect(send).not.toHaveBeenCalled();
    });

    it("gives byte-identical refusals for a wrong contact and an unknown id", async () => {
      const wrongContact = await (await POST(request({ pulseId: PULSE_ID, contact: "nope@example.com" }))).json();

      store.direction = null;
      const unknownId = await (await POST(request({ pulseId: "PLS-260826-999", contact: OWNER }))).json();

      // Differing copy would turn this endpoint into an oracle for which ids exist.
      expect(wrongContact.error).toBe(unknownId.error);
      expect(wrongContact.code).toBe(unknownId.code);
    });

    it("never echoes the stored address back", async () => {
      const response = await POST(request({ pulseId: PULSE_ID, contact: OWNER }));
      const body = JSON.stringify(await response.json());

      expect(body).not.toContain(OWNER);
      expect(body).not.toContain("Jordan Ellis");
    });
  });

  describe("input validation", () => {
    const malformed = [
      ["missing contact", { pulseId: PULSE_ID }],
      ["empty contact", { pulseId: PULSE_ID, contact: "" }],
      ["missing pulseId", { contact: OWNER }],
      ["malformed pulseId", { pulseId: "PLS-123", contact: OWNER }],
      ["sql-ish pulseId", { pulseId: "PLS-260826-883; DROP TABLE directions", contact: OWNER }],
    ] as const;

    for (const [label, body] of malformed) {
      it(`rejects ${label} without sending`, async () => {
        const response = await POST(request(body));
        expect(response.status).toBe(400);
        expect(send).not.toHaveBeenCalled();
      });
    }

    it("rejects a foreign origin", async () => {
      const response = await POST(
        request({ pulseId: PULSE_ID, contact: OWNER }, { origin: "https://evil.example" })
      );
      expect(response.status).toBe(403);
      expect(send).not.toHaveBeenCalled();
    });

    it("rejects a non-JSON content type", async () => {
      const response = await POST(
        request({ pulseId: PULSE_ID, contact: OWNER }, { "content-type": "text/plain" })
      );
      expect(response.status).toBe(415);
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("failure paths", () => {
    it("explains when the direction was saved against a phone number", async () => {
      store.direction = savedDirection({
        lead: { name: "Jordan Ellis", contact: "+44 7700 900123", method: "Phone" },
      });

      const response = await POST(request({ pulseId: PULSE_ID, contact: "+44 7700 900123" }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/phone number/i);
      expect(send).not.toHaveBeenCalled();
    });

    it("returns 503 when the direction store cannot be read", async () => {
      store.failRead = true;

      const response = await POST(request({ pulseId: PULSE_ID, contact: OWNER }));
      expect(response.status).toBe(503);
      expect((await response.json()).code).toBe("SERVICE_UNAVAILABLE");
    });

    it("returns 503 when email delivery is not configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "");

      const response = await POST(request({ pulseId: PULSE_ID, contact: OWNER }));
      expect(response.status).toBe(503);
      expect(send).not.toHaveBeenCalled();
    });

    it("reports a provider rejection as an upstream error", async () => {
      send.mockResolvedValue({ data: null, error: { name: "validation_error" } });

      const response = await POST(request({ pulseId: PULSE_ID, contact: OWNER }));
      expect(response.status).toBe(502);
      expect((await response.json()).code).toBe("UPSTREAM_ERROR");
    });

    it("rate limits repeated sends", async () => {
      const ip = crypto.randomUUID();
      const sendOnce = () =>
        POST(
          new Request("https://example.com/api/pulse/email-blueprint", {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": ip },
            body: JSON.stringify({ pulseId: PULSE_ID, contact: OWNER }),
          })
        );

      for (let i = 0; i < RATE_LIMIT_RULES["pulse-email-blueprint"]; i += 1) {
        expect((await sendOnce()).status).toBe(200);
      }

      const limited = await sendOnce();
      expect(limited.status).toBe(429);
      expect((await limited.json()).code).toBe("RATE_LIMITED");
    });
  });
});

describe("renderBlueprintEmail", () => {
  it("addresses the visitor and quotes their reference id", () => {
    const { subject, text } = renderBlueprintEmail(savedDirection() as never);

    expect(subject).toContain(PULSE_ID);
    expect(text).toMatch(/^Hi Jordan,/);
    expect(text).toContain(PULSE_ID);
  });

  it("includes the architecture and what the visitor said", () => {
    const { text } = renderBlueprintEmail(savedDirection() as never);

    expect(text).toContain("RECOMMENDED SYSTEM ARCHITECTURE");
    expect(text).toContain("WHAT YOU TOLD US");
    expect(text).toContain("We run a courier fleet");
  });

  it("omits the answers section when there are none", () => {
    const { text } = renderBlueprintEmail(savedDirection({ answers: [] }) as never);
    expect(text).not.toContain("WHAT YOU TOLD US");
  });

  it("does not present itself as a quote", () => {
    const { text } = renderBlueprintEmail(savedDirection() as never);
    expect(text).toMatch(/not a quote|nothing here is a quote/i);
  });

  it("copes with a single-word name", () => {
    const { text } = renderBlueprintEmail(
      savedDirection({ lead: { name: "Jordan", contact: OWNER, method: "Email" } }) as never
    );
    expect(text).toMatch(/^Hi Jordan,/);
  });
});
