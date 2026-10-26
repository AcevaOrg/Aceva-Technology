import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getClientIp,
  resetRateLimitStore,
  RATE_LIMIT_RULES,
} from "@/lib/rateLimit";

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("extracts the first forwarded client IP", () => {
    const request = new Request("https://example.com/api/contact", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("203.0.113.7");
  });

  describe("per-endpoint budgets", () => {
    it("allows 20 chat requests a minute and blocks the 21st", () => {
      const ip = `test-${crypto.randomUUID()}`;

      expect(RATE_LIMIT_RULES.chat).toBe(20);
      for (let i = 0; i < 20; i += 1) {
        expect(checkRateLimit("chat", ip).allowed).toBe(true);
      }

      const blocked = checkRateLimit("chat", ip);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(60);
    });

    it("allows five contact submissions a minute and blocks the sixth", () => {
      const ip = `test-${crypto.randomUUID()}`;

      expect(RATE_LIMIT_RULES.contact).toBe(5);
      for (let i = 0; i < 5; i += 1) {
        expect(checkRateLimit("contact", ip).allowed).toBe(true);
      }
      expect(checkRateLimit("contact", ip).allowed).toBe(false);
    });

    it("counts down remaining against the scope's own limit", () => {
      const ip = `test-${crypto.randomUUID()}`;

      expect(checkRateLimit("chat", ip).remaining).toBe(19);
      expect(checkRateLimit("contact", ip).remaining).toBe(4);
    });

    it("reports retryAfter 0 while still under budget", () => {
      const ip = `test-${crypto.randomUUID()}`;
      expect(checkRateLimit("chat", ip).retryAfter).toBe(0);
    });
  });

  describe("scopes do not share a bucket", () => {
    // Both endpoints used to call checkRateLimit(ip) with the bare IP, so five
    // chat messages left the visitor unable to submit the contact form.
    it("exhausting chat leaves the contact form usable", () => {
      const ip = `test-${crypto.randomUUID()}`;

      for (let i = 0; i < 25; i += 1) checkRateLimit("chat", ip);
      expect(checkRateLimit("chat", ip).allowed).toBe(false);

      expect(checkRateLimit("contact", ip).allowed).toBe(true);
      expect(checkRateLimit("pulse-save-direction", ip).allowed).toBe(true);
    });

    it("exhausting the contact form leaves chat usable", () => {
      const ip = `test-${crypto.randomUUID()}`;

      for (let i = 0; i < 10; i += 1) checkRateLimit("contact", ip);
      expect(checkRateLimit("contact", ip).allowed).toBe(false);

      expect(checkRateLimit("chat", ip).allowed).toBe(true);
    });

    it("keeps separate IPs independent within one scope", () => {
      const a = `test-${crypto.randomUUID()}`;
      const b = `test-${crypto.randomUUID()}`;

      for (let i = 0; i < 20; i += 1) checkRateLimit("chat", a);
      expect(checkRateLimit("chat", a).allowed).toBe(false);
      expect(checkRateLimit("chat", b).allowed).toBe(true);
    });
  });
});
