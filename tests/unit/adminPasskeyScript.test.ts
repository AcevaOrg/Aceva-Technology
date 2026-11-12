import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSKEY_LENGTH, isAdminEnabled } from "@/lib/admin/config";
import {
  PASSKEY_ALPHABET,
  formatInstructions,
  generatePasskey,
  randomPasskeyCharacters,
} from "../../scripts/generate-admin-passkey";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generatePasskey", () => {
  it("is 24 characters in four hyphen-separated groups of six", () => {
    for (let i = 0; i < 50; i += 1) {
      const key = generatePasskey();
      expect(key).toMatch(/^[^-]{6}-[^-]{6}-[^-]{6}-[^-]{6}$/);
      expect(key.replace(/-/g, "")).toHaveLength(24);
    }
  });

  it("uses only the unambiguous alphabet", () => {
    expect(PASSKEY_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz");
    for (const ambiguous of ["0", "1", "O", "I", "l", "o"]) {
      expect(PASSKEY_ALPHABET).not.toContain(ambiguous);
    }
    for (let i = 0; i < 50; i += 1) {
      for (const char of generatePasskey().replace(/-/g, "")) expect(PASSKEY_ALPHABET).toContain(char);
    }
  });

  it("does not repeat", () => {
    const keys = new Set(Array.from({ length: 200 }, () => generatePasskey()));
    expect(keys.size).toBe(200);
  });

  it("satisfies the length the console requires, hyphens included", () => {
    const key = generatePasskey();
    expect(key.length).toBe(27);
    expect(key.length).toBeGreaterThanOrEqual(MIN_PASSKEY_LENGTH);
    vi.stubEnv("ADMIN_PASSKEY", key);
    expect(isAdminEnabled()).toBe(true);
  });
});

describe("rejection sampling", () => {
  const limit = 256 - (256 % PASSKEY_ALPHABET.length);

  it("discards bytes at or above the largest multiple of the alphabet size", () => {
    expect(limit).toBe(220);
    // 255 and 220 are rejected; 219 is the last accepted byte (index 219 % 55 = 54).
    const bytes = new Uint8Array([255, 220, 221, 0, 219, 254, 55]);
    const result = randomPasskeyCharacters(3, PASSKEY_ALPHABET, () => bytes);
    expect(result).toBe(`${PASSKEY_ALPHABET[0]}${PASSKEY_ALPHABET[54]}${PASSKEY_ALPHABET[0]}`);
  });

  it("keeps drawing until it has enough characters", () => {
    let calls = 0;
    const source = (size: number) => {
      calls += 1;
      // Mostly rejected bytes: forces several rounds.
      return new Uint8Array(size).fill(calls < 4 ? 250 : 1);
    };
    const result = randomPasskeyCharacters(10, PASSKEY_ALPHABET, source);
    expect(result).toBe(PASSKEY_ALPHABET[1].repeat(10));
    expect(calls).toBeGreaterThanOrEqual(4);
  });

  it("is uniform over the alphabet for every accepted byte value", () => {
    const counts = new Map<string, number>();
    const all = new Uint8Array(256).map((_, i) => i);
    const result = randomPasskeyCharacters(limit, PASSKEY_ALPHABET, () => all);
    for (const char of result) counts.set(char, (counts.get(char) ?? 0) + 1);
    // 220 accepted bytes over 55 characters: exactly 4 each. Folding with % alone would skew this.
    expect(counts.size).toBe(PASSKEY_ALPHABET.length);
    for (const count of counts.values()) expect(count).toBe(4);
  });
});

describe("instructions", () => {
  const key = "AAAAAA-BBBBBB-CCCCCC-DDDDDD";
  const text = formatInstructions(key);

  it("shows the exact line to add and where", () => {
    expect(text).toContain(`ADMIN_PASSKEY=${key}`);
    expect(text).toContain(".env.local");
    expect(text).toContain("Vercel");
    expect(text).toContain("Project Settings > Environment Variables");
    expect(text).toMatch(/redeploy/i);
  });

  it("recommends Production only, the host lock and a long key, and states the real minimum", () => {
    expect(text).toMatch(/Production environment only/);
    expect(text).toContain("ADMIN_ALLOWED_HOSTS=");
    expect(text).toContain(`${MIN_PASSKEY_LENGTH} or more characters`);
    expect(text).toMatch(/24 random characters/);
    expect(text).not.toMatch(/\b16\b/);
  });

  it("warns that the key is shown once and must never be committed", () => {
    expect(text).toMatch(/NOT shown again/);
    expect(text).toMatch(/Never commit/);
  });

  it("writes nothing to disk", () => {
    const source = readFileSync(path.join(process.cwd(), "scripts", "generate-admin-passkey.ts"), "utf8");
    expect(source).not.toMatch(/from "(node:)?fs(\/promises)?"/);
    expect(source).not.toMatch(/writeFile|appendFile|createWriteStream|mkdir/);
  });
});
