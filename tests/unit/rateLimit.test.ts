import { describe, expect, it } from "vitest";
import { checkRateLimit, createRateLimitResponse, getClientIp } from "@/lib/rateLimit";

describe("contact rate limiting", () => {
  it("extracts the first forwarded client IP", () => {
    const request = new Request("https://example.com/api/contact", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  it("allows five requests and blocks the sixth", async () => {
    const ip = `test-${crypto.randomUUID()}`;
    for (let request = 0; request < 5; request += 1) {
      expect(checkRateLimit(ip).allowed).toBe(true);
    }
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);

    const response = createRateLimitResponse(blocked.resetAt);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });
});
