import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: async () => ({ answer: "ok", isFallback: false }),
}));
vi.mock("@/lib/pulse/directionStore", () => ({
  ensureDirectionsTable: async () => undefined,
  saveDirection: async () => undefined,
  getDirection: async () => null,
}));
vi.mock("resend", () => ({ Resend: class { emails = { send: async () => ({ error: null }) } } }));

import { POST as chatPost } from "@/app/api/chat/route";
import { POST as savePost } from "@/app/api/pulse/save-direction/route";
import { POST as contactPost } from "@/app/api/contact/route";
import { describeApiError, isApiErrorBody, API_ERROR_CODES } from "@/lib/api/errorCodes";
import { resetRateLimitStore, RATE_LIMIT_RULES } from "@/lib/rateLimit";

function request(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Every field the contract promises, and the ones it must not still emit. */
function expectCanonicalErrorBody(body: Record<string, unknown>) {
  expect(body.ok).toBe(false);
  expect(typeof body.error).toBe("string");
  expect((body.error as string).length).toBeGreaterThan(0);
  expect(API_ERROR_CODES).toContain(body.code);
  expect(isApiErrorBody(body)).toBe(true);

  // The pre-rename field names must be gone, not duplicated alongside.
  expect(body).not.toHaveProperty("message");
  expect(body).not.toHaveProperty("retryAfterSeconds");
}

describe("every endpoint emits { ok, error, code, retryAfter }", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  const cases = [
    {
      label: "chat validation failure",
      run: () => chatPost(request("https://example.com/api/chat", { nope: 1 })),
      status: 400,
      code: "VALIDATION_FAILED",
    },
    {
      label: "chat wrong content type",
      run: () =>
        chatPost(request("https://example.com/api/chat", { message: "hi there" }, { "content-type": "text/plain" })),
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    },
    {
      label: "chat foreign origin",
      run: () =>
        chatPost(request("https://example.com/api/chat", { message: "hi there" }, { origin: "https://evil.example" })),
      status: 403,
      code: "FORBIDDEN_ORIGIN",
    },
    {
      label: "save-direction validation failure",
      run: () => savePost(request("https://example.com/api/pulse/save-direction", { pulseId: "nope" })),
      status: 400,
      code: "VALIDATION_FAILED",
    },
    {
      // This route was the only write endpoint without the origin guard, so a
      // page on any other origin could post a lead — storing the visitor's
      // name and contact details and mailing the team.
      label: "save-direction foreign origin",
      run: () =>
        savePost(
          request(
            "https://example.com/api/pulse/save-direction",
            { pulseId: "PLS-260826-883" },
            { origin: "https://evil.example" }
          )
        ),
      status: 403,
      code: "FORBIDDEN_ORIGIN",
    },
    {
      label: "contact validation failure",
      run: () => contactPost(request("https://example.com/api/contact", { name: "", email: "", message: "" })),
      status: 400,
      code: "VALIDATION_FAILED",
    },
  ] as const;

  for (const testCase of cases) {
    it(`${testCase.label} uses the canonical shape`, async () => {
      const response = await testCase.run();
      expect(response.status).toBe(testCase.status);

      const body = await response.json();
      expectCanonicalErrorBody(body);
      expect(body.code).toBe(testCase.code);
    });
  }

  it("a method-not-allowed response uses it too", async () => {
    const { GET } = await import("@/app/api/chat/route");
    const response = GET(new Request("https://example.com/api/chat"));
    expect(response.status).toBe(405);
    expectCanonicalErrorBody(await response.json());
  });
});

describe("rate limiting surfaces a countdown", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("chat allows 20 a minute, then returns 429 with retryAfter", async () => {
    const ip = crypto.randomUUID();
    const send = () =>
      chatPost(
        new Request("https://example.com/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ message: "We run three restaurants and want online ordering" }),
        })
      );

    for (let i = 0; i < RATE_LIMIT_RULES.chat; i += 1) {
      expect((await send()).status).toBe(200);
    }

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();

    const body = await limited.json();
    expectCanonicalErrorBody(body);
    expect(body.code).toBe("RATE_LIMITED");
    expect(typeof body.retryAfter).toBe("number");
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(body.retryAfter).toBeLessThanOrEqual(60);
  });

  it("chat and the contact form no longer share a budget", async () => {
    const ip = crypto.randomUUID();

    // Exhaust chat.
    for (let i = 0; i < RATE_LIMIT_RULES.chat + 1; i += 1) {
      await chatPost(
        new Request("https://example.com/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ message: "We run three restaurants and want online ordering" }),
        })
      );
    }

    // The contact form must still accept a submission from the same visitor.
    const contact = await contactPost(
      new Request("https://example.com/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ name: "", email: "", message: "" }),
      })
    );

    // 400 for the empty body, crucially not 429.
    expect(contact.status).toBe(400);
    expect((await contact.json()).code).toBe("VALIDATION_FAILED");
  });
});

describe("describeApiError", () => {
  it("renders a rate limit with the countdown", () => {
    const body = { ok: false, error: "Too many messages.", code: "RATE_LIMITED", retryAfter: 42, retryable: true, requestId: "r" };
    expect(describeApiError(body)).toBe("Too many requests, try again in 42s");
  });

  it("rounds a fractional countdown up", () => {
    const body = { ok: false, error: "x", code: "RATE_LIMITED", retryAfter: 7.2, retryable: true, requestId: "r" };
    expect(describeApiError(body)).toBe("Too many requests, try again in 8s");
  });

  it("falls back to a wording without a number when retryAfter is missing or zero", () => {
    for (const retryAfter of [undefined, 0, -5, Number.NaN, "soon"]) {
      const body = { ok: false, error: "x", code: "RATE_LIMITED", retryAfter, retryable: true, requestId: "r" };
      expect(describeApiError(body)).toBe("Too many requests, try again in a moment");
    }
  });

  it("uses the server's own copy for any other code", () => {
    const body = {
      ok: false,
      error: "Please check your details — some required fields are missing or incorrect.",
      code: "VALIDATION_FAILED",
      retryable: false,
      requestId: "r",
    };
    expect(describeApiError(body)).toBe(body.error);
  });

  it("falls back when the body is not an error envelope at all", () => {
    for (const value of [null, undefined, "nope", 42, {}, { ok: true }]) {
      expect(describeApiError(value, "fallback copy")).toBe("fallback copy");
    }
  });

  it("never returns an empty string", () => {
    expect(describeApiError({ ok: false, code: "RATE_LIMITED" }).length).toBeGreaterThan(0);
  });
});
