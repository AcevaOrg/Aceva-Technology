import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SESSION_SECONDS } from "@/lib/admin/config";
import { constantTimeEqual, createSessionToken, sha256Bytes, toBase64Url, verifySessionToken } from "@/lib/admin/session";

const PASSKEY = "correct-horse-battery-staple";
const SECRET = "x".repeat(40);
const T0 = 1_800_000_000_000;

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
  vi.stubEnv("ADMIN_SESSION_SECRET", "");
  vi.stubEnv("ADMIN_SESSION_HOURS", "8");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Signs an arbitrary payload with the explicit-secret key, so tests can forge odd-but-validly-signed tokens. */
function forge(parts: { version?: string; issuedAt: string; expiresAt: string; nonce?: string }): string {
  const payload = [parts.version ?? "v1", parts.issuedAt, parts.expiresAt, parts.nonce ?? "AAAAAAAAAAAAAAAAAAAAAA"].join(".");
  const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips", async () => {
    const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
    expect(await verifySessionToken(token, { now: T0 + 1000 })).toEqual({
      valid: true,
      issuedAt: T0,
      expiresAt: T0 + 600_000,
    });
  });

  it("has the documented shape and stays short", async () => {
    const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
    const parts = token.split(".");
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe("v1");
    expect(parts[1]).toBe(String(T0));
    expect(parts[2]).toBe(String(T0 + 600_000));
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(parts[4]).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token.length).toBeLessThan(256);
  });

  it("issues a different nonce every time", async () => {
    const [a, b] = await Promise.all([createSessionToken({ now: T0 }), createSessionToken({ now: T0 })]);
    expect(a).not.toBe(b);
  });

  it("defaults to the configured lifetime and the real clock", async () => {
    vi.stubEnv("ADMIN_SESSION_HOURS", "2");
    const before = Date.now();
    const token = await createSessionToken();
    const result = await verifySessionToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.issuedAt).toBeGreaterThanOrEqual(before);
      expect(result.expiresAt - result.issuedAt).toBe(2 * 3600 * 1000);
    }
  });

  it("clamps an over-long or non-positive ttl", async () => {
    const long = await verifySessionToken(await createSessionToken({ now: T0, ttlSeconds: 10 * MAX_SESSION_SECONDS }), { now: T0 });
    expect(long.valid && long.expiresAt - long.issuedAt).toBe(MAX_SESSION_SECONDS * 1000);
    const short = await verifySessionToken(await createSessionToken({ now: T0, ttlSeconds: -50 }), { now: T0 });
    expect(short.valid && short.expiresAt - short.issuedAt).toBe(1000);
  });

  describe("tampering", () => {
    it.each([
      ["version", 0, (s: string) => (s === "v1" ? "v2" : "v1")],
      ["issuedAt", 1, (s: string) => String(Number(s) - 1)],
      ["expiresAt", 2, (s: string) => String(Number(s) + 3_600_000)],
      ["nonce", 3, (s: string) => `${s.slice(0, -1)}${s.endsWith("A") ? "B" : "A"}`],
      ["signature", 4, (s: string) => `${s.slice(0, -1)}${s.endsWith("A") ? "B" : "A"}`],
      ["signature first char", 4, (s: string) => `${s.startsWith("A") ? "B" : "A"}${s.slice(1)}`],
    ])("rejects a changed %s", async (_label, index, change) => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      const parts = token.split(".");
      parts[index] = change(parts[index]);
      expect(await verifySessionToken(parts.join("."), { now: T0 + 1 })).toEqual({ valid: false });
    });

    it("rejects a non-canonical spelling of a correct signature", async () => {
      // The final base64url character carries 2 unused bits, so these decode to identical bytes.
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      const last = token[token.length - 1];
      const sibling = BASE64URL[BASE64URL.indexOf(last) ^ 1];
      expect(sibling).not.toBe(last);
      expect(await verifySessionToken(`${token.slice(0, -1)}${sibling}`, { now: T0 + 1 })).toEqual({ valid: false });
    });

    it("rejects missing, extra and empty segments", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      const parts = token.split(".");
      const bad = [
        parts.slice(0, 4).join("."),
        `${token}.extra`,
        parts.filter((_, i) => i !== 3).join("."),
        parts.map((p, i) => (i === 3 ? "" : p)).join("."),
        "....",
        ".",
        "",
        "v1",
      ];
      for (const candidate of bad) {
        expect(await verifySessionToken(candidate, { now: T0 + 1 }), candidate).toEqual({ valid: false });
      }
    });

    it("rejects a token whose timestamps are not plain digits, even when correctly signed", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const ok = forge({ issuedAt: String(T0), expiresAt: String(T0 + 1000) });
      expect((await verifySessionToken(ok, { now: T0 })).valid).toBe(true);
      for (const [issuedAt, expiresAt] of [
        [`+${T0}`, String(T0 + 1000)],
        [String(T0), `${T0 + 1000}.5`],
        [` ${T0}`, String(T0 + 1000)],
        [`0x${T0.toString(16)}`, String(T0 + 1000)],
        ["1e12", "2e12"],
        ["-1", String(T0 + 1000)],
        ["9".repeat(16), "9".repeat(16)],
      ]) {
        expect((await verifySessionToken(forge({ issuedAt, expiresAt }), { now: T0 })).valid, `${issuedAt}/${expiresAt}`).toBe(false);
      }
    });
  });

  describe("time", () => {
    it("is valid up to, and not at, the expiry instant", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 60 });
      expect((await verifySessionToken(token, { now: T0 + 59_999 })).valid).toBe(true);
      expect((await verifySessionToken(token, { now: T0 + 60_000 })).valid).toBe(false);
      expect((await verifySessionToken(token, { now: T0 + 3_600_000 })).valid).toBe(false);
    });

    it("tolerates 60 s of clock skew but no more", async () => {
      const ahead60 = await createSessionToken({ now: T0 + 60_000, ttlSeconds: 600 });
      expect((await verifySessionToken(ahead60, { now: T0 })).valid).toBe(true);
      const ahead61 = await createSessionToken({ now: T0 + 60_001, ttlSeconds: 600 });
      expect((await verifySessionToken(ahead61, { now: T0 })).valid).toBe(false);
      const farFuture = await createSessionToken({ now: T0 + 86_400_000, ttlSeconds: 600 });
      expect((await verifySessionToken(farFuture, { now: T0 })).valid).toBe(false);
    });

    it("rejects a validly signed token that lives longer than 72 hours, or ends before it starts", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const tooLong = forge({ issuedAt: String(T0), expiresAt: String(T0 + MAX_SESSION_SECONDS * 1000 + 1) });
      expect((await verifySessionToken(tooLong, { now: T0 })).valid).toBe(false);
      const atLimit = forge({ issuedAt: String(T0), expiresAt: String(T0 + MAX_SESSION_SECONDS * 1000) });
      expect((await verifySessionToken(atLimit, { now: T0 })).valid).toBe(true);
      const backwards = forge({ issuedAt: String(T0), expiresAt: String(T0 - 1) });
      expect((await verifySessionToken(backwards, { now: T0 - 5 })).valid).toBe(false);
    });
  });

  describe("version, size and input type", () => {
    it("rejects an unknown version even when correctly signed", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const token = forge({ version: "v2", issuedAt: String(T0), expiresAt: String(T0 + 1000) });
      expect(await verifySessionToken(token, { now: T0 })).toEqual({ valid: false });
    });

    it("rejects anything over 256 characters without doing work", async () => {
      expect(await verifySessionToken("v1.".padEnd(257, "a"), { now: T0 })).toEqual({ valid: false });
      const token = await createSessionToken({ now: T0 });
      expect(await verifySessionToken(`${token}${"a".repeat(256)}`, { now: T0 })).toEqual({ valid: false });
    });

    it("never throws on garbage and returns exactly { valid: false }", async () => {
      const inputs: unknown[] = [undefined, null, 0, 1, true, {}, [], ["a"], () => 1, "\u0000", "💥".repeat(10), "a.b.c.d.e", "%%%"];
      for (const input of inputs) {
        await expect(verifySessionToken(input as string)).resolves.toEqual({ valid: false });
      }
    });
  });

  describe("keys", () => {
    it("stops accepting tokens after the pass key changes", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(true);
      vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(false);
      vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(true);
    });

    it("derives the key from the pass key when no 32+ character secret is set", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      // A too-short secret is ignored, so the token still verifies against the derived key.
      vi.stubEnv("ADMIN_SESSION_SECRET", "too-short");
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(true);
    });

    it("signs with ADMIN_SESSION_SECRET when it is long enough, independent of the pass key", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      // Independent: rotating the pass key does not invalidate it...
      vi.stubEnv("ADMIN_PASSKEY", "a-completely-different-pass-key");
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(true);
      // ...but rotating the secret does.
      vi.stubEnv("ADMIN_SESSION_SECRET", "y".repeat(40));
      expect((await verifySessionToken(token, { now: T0 })).valid).toBe(false);
      // And it is not the derived key: a token made with the secret fails once the secret is dropped.
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const secretToken = await createSessionToken({ now: T0, ttlSeconds: 600 });
      vi.stubEnv("ADMIN_SESSION_SECRET", "");
      expect((await verifySessionToken(secretToken, { now: T0 })).valid).toBe(false);
    });

    it("matches an independent HMAC-SHA256 implementation", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      const [version, issuedAt, expiresAt, nonce, signature] = token.split(".");
      const expected = createHmac("sha256", SECRET).update(`${version}.${issuedAt}.${expiresAt}.${nonce}`).digest("base64url");
      expect(signature).toBe(expected);
    });

    it("derives the pass-key key as HMAC(passkey, label)", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      const [version, issuedAt, expiresAt, nonce, signature] = token.split(".");
      const derived = createHmac("sha256", PASSKEY).update("aceva-admin-session-key-v1").digest();
      const expected = createHmac("sha256", derived).update(`${version}.${issuedAt}.${expiresAt}.${nonce}`).digest("base64url");
      expect(signature).toBe(expected);
    });
  });

  describe("disabled console", () => {
    it("refuses to issue and to verify", async () => {
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      vi.stubEnv("ADMIN_PASSKEY", "");
      expect(await verifySessionToken(token, { now: T0 })).toEqual({ valid: false });
      await expect(createSessionToken({ now: T0 })).rejects.toThrow();
    });

    it("refuses when only a too-short pass key remains, even with a valid secret", async () => {
      vi.stubEnv("ADMIN_SESSION_SECRET", SECRET);
      const token = await createSessionToken({ now: T0, ttlSeconds: 600 });
      vi.stubEnv("ADMIN_PASSKEY", "short");
      expect(await verifySessionToken(token, { now: T0 })).toEqual({ valid: false });
    });
  });
});

describe("primitives", () => {
  it("constantTimeEqual compares by value, length included", () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([0]), new Uint8Array([0, 0]))).toBe(false);
    expect(constantTimeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
  });

  it("sha256Bytes matches node's SHA-256", async () => {
    const { createHash } = await import("node:crypto");
    expect(Buffer.from(await sha256Bytes("aceva")).toString("hex")).toBe(createHash("sha256").update("aceva").digest("hex"));
  });

  it("toBase64Url is unpadded and URL safe", () => {
    expect(toBase64Url(new Uint8Array([251, 255, 254]))).toBe("-__-");
    expect(toBase64Url(new Uint8Array([1]))).toBe("AQ");
    expect(toBase64Url(new Uint8Array([]))).toBe("");
  });
});
