import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSKEY_LENGTH } from "@/lib/admin/config";
import { verifyPasskey } from "@/lib/admin/passkey";

const PASSKEY = "Xk7Pq2-mN8vRt4-Wz9Yb3-Hc5Jd6A";

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSKEY", PASSKEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyPasskey", () => {
  it("accepts the configured pass key", async () => {
    expect(await verifyPasskey(PASSKEY)).toBe(true);
  });

  it("ignores surrounding whitespace, as pasted keys often carry some", async () => {
    expect(await verifyPasskey(`  ${PASSKEY}\n`)).toBe(true);
  });

  it("rejects every kind of near miss", async () => {
    const wrong = [
      "",
      " ",
      PASSKEY.slice(0, -1),
      PASSKEY.slice(1),
      `${PASSKEY}x`,
      `x${PASSKEY}`,
      PASSKEY.toLowerCase(),
      PASSKEY.toUpperCase(),
      PASSKEY.replace(/-/g, ""),
      `${PASSKEY.slice(0, -1)}B`,
      "not-the-key-at-all-not-the-key",
      `${PASSKEY}\u0000`,
    ];
    for (const attempt of wrong) {
      expect(await verifyPasskey(attempt), JSON.stringify(attempt)).toBe(false);
    }
  });

  it("rejects input over 256 characters, even when it starts with the right key", async () => {
    expect(await verifyPasskey(`${PASSKEY}${" ".repeat(300)}`)).toBe(false);
    expect(await verifyPasskey("a".repeat(257))).toBe(false);
    expect(await verifyPasskey("a".repeat(100_000))).toBe(false);
  });

  it("rejects anything that is not a string", async () => {
    const inputs: unknown[] = [undefined, null, 0, 123, true, {}, [], [PASSKEY], { toString: () => PASSKEY }, Symbol("x"), () => PASSKEY];
    for (const input of inputs) {
      expect(await verifyPasskey(input)).toBe(false);
    }
  });

  it("is false for every input when the console is disabled", async () => {
    vi.stubEnv("ADMIN_PASSKEY", "");
    expect(await verifyPasskey(PASSKEY)).toBe(false);
    expect(await verifyPasskey("")).toBe(false);
    const tooShort = "x".repeat(MIN_PASSKEY_LENGTH - 1);
    vi.stubEnv("ADMIN_PASSKEY", tooShort);
    expect(await verifyPasskey(tooShort)).toBe(false);
  });

  it("accepts a pass key of exactly the minimum length", async () => {
    const shortest = "q".repeat(MIN_PASSKEY_LENGTH);
    vi.stubEnv("ADMIN_PASSKEY", shortest);
    expect(await verifyPasskey(shortest)).toBe(true);
    expect(await verifyPasskey(shortest.slice(1))).toBe(false);
  });

  it("follows the pass key when it is rotated", async () => {
    vi.stubEnv("ADMIN_PASSKEY", "A-brand-new-rotated-pass-key");
    expect(await verifyPasskey(PASSKEY)).toBe(false);
    expect(await verifyPasskey("A-brand-new-rotated-pass-key")).toBe(true);
  });
});
