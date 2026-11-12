import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  generateVerificationCode,
  isVerificationCode,
  normalizeVerificationCode,
  type RandomSource,
} from "@/lib/documents/codes";

const CANONICAL_PATTERN = /^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const char = (code: number) => String.fromCharCode(code);

describe("CODE_ALPHABET", () => {
  it("is the 32-symbol Crockford set without the ambiguous letters", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    for (const banned of ["I", "L", "O", "U"]) expect(CODE_ALPHABET).not.toContain(banned);
  });
});

describe("generateVerificationCode", () => {
  it("produces ACV-XXXX-XXXX-XXXX from the alphabet", () => {
    for (let i = 0; i < 200; i += 1) expect(generateVerificationCode()).toMatch(CANONICAL_PATTERN);
  });

  it("is unique across 10,000 generations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) seen.add(generateVerificationCode());
    expect(seen.size).toBe(10_000);
  });

  it("uses every symbol with roughly equal frequency (no modulo bias)", () => {
    const counts = new Map<string, number>();
    const draws = 4000;
    for (let i = 0; i < draws; i += 1) {
      for (const symbol of generateVerificationCode().slice(4).replace(/-/g, "")) {
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      }
    }
    const expected = (draws * 12) / 32;
    expect(counts.size).toBe(32);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });

  it("maps random bytes onto the alphabet deterministically", () => {
    const zeros: RandomSource = (size) => new Uint8Array(size);
    expect(generateVerificationCode(zeros)).toBe("ACV-0000-0000-0000");

    const ramp: RandomSource = (size) => Uint8Array.from({ length: size }, (_, i) => i);
    // bytes 0..11 -> first twelve symbols of the alphabet
    expect(generateVerificationCode(ramp)).toBe("ACV-0123-4567-89AB");

    // 255 % 32 = 31 -> the last symbol, and it is accepted because 32 divides 256
    const max: RandomSource = (size) => new Uint8Array(size).fill(255);
    expect(generateVerificationCode(max)).toBe("ACV-ZZZZ-ZZZZ-ZZZZ");
  });

  it("refuses to return a short code when the random source is exhausted", () => {
    const empty: RandomSource = () => new Uint8Array(0);
    expect(() => generateVerificationCode(empty)).toThrow();
  });
});

describe("normalizeVerificationCode", () => {
  const canonical = "ACV-7K3M-9QXD-4TRH";

  const accepted: Array<[string, string]> = [
    ["canonical", canonical],
    ["lower case", canonical.toLowerCase()],
    ["no hyphens", "ACV7K3M9QXD4TRH"],
    ["spaces for hyphens", "ACV 7K3M 9QXD 4TRH"],
    ["mixed spaces, hyphens and case", "  acv-7k3m 9qxd-4trh  "],
    ["tabs and newlines", "ACV\t7K3M\n9QXD\r\n4TRH"],
    ["non-breaking spaces", ["ACV", "7K3M", "9QXD", "4TRH"].join(char(0xa0))],
    ["en dashes", ["ACV", "7K3M", "9QXD", "4TRH"].join(char(0x2013))],
    ["minus signs", ["ACV", "7K3M", "9QXD", "4TRH"].join(char(0x2212))],
    ["zero-width characters pasted in", `ACV-7K3M${char(0x200b)}-9QXD-${char(0xfeff)}4TRH`],
    ["full-width characters", "ＡＣＶ－７Ｋ３Ｍ－９ＱＸＤ－４ＴＲＨ"],
  ];
  it.each(accepted)("accepts %s", (_label, input) => {
    expect(normalizeVerificationCode(input)).toBe(canonical);
  });

  const lookAlikes: Array<[string, string]> = [
    ["O is read as 0", "ACV-O000-0000-0000"],
    ["lower-case o is read as 0", "acv-o000-0000-0000"],
    ["I is read as 1", "ACV-I111-1111-1111"],
    ["L is read as 1", "ACV-L111-1111-1111"],
    ["mixed look-alikes", "ACV-OIL0-1L1O-0I1L"],
  ];
  it.each(lookAlikes)("%s", (_label, input) => {
    const result = normalizeVerificationCode(input);
    expect(result).not.toBeNull();
    expect(result).toMatch(CANONICAL_PATTERN);
    expect(result).not.toMatch(/[ILOU]/);
  });

  it("corrects look-alikes to the exact canonical symbols", () => {
    expect(normalizeVerificationCode("ACV-OIL0-1L1O-0I1L")).toBe("ACV-0110-1110-0111");
  });

  const rejected: Array<[string, unknown]> = [
    ["empty string", ""],
    ["whitespace only", "   "],
    ["too short", "ACV-7K3M-9QXD"],
    ["too long", "ACV-7K3M-9QXD-4TRH-5555"],
    ["missing prefix", "7K3M-9QXD-4TRH"],
    ["wrong prefix", "XYZ-7K3M-9QXD-4TRH"],
    ["U is not in the alphabet", "ACV-7K3U-9QXD-4TRH"],
    ["punctuation inside", "ACV-7K3M-9QX!-4TRH"],
    ["underscore", "ACV_7K3M_9QXD_4TRH"],
    ["sql injection", "ACV-7K3M'; DROP TABLE documents;--"],
    ["a very long string", "A".repeat(5000)],
    ["null", null],
    ["undefined", undefined],
    ["a number", 123456789012345],
    ["an object", { code: canonical }],
    ["an array", [canonical]],
  ];
  it.each(rejected)("rejects %s", (_label, input) => {
    expect(normalizeVerificationCode(input)).toBeNull();
  });

  it("is idempotent and round-trips freshly generated codes", () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateVerificationCode();
      expect(normalizeVerificationCode(code)).toBe(code);
      expect(normalizeVerificationCode(code.toLowerCase().replace(/-/g, " "))).toBe(code);
    }
  });
});

describe("isVerificationCode", () => {
  it("accepts only the canonical form", () => {
    expect(isVerificationCode("ACV-7K3M-9QXD-4TRH")).toBe(true);
    expect(isVerificationCode(generateVerificationCode())).toBe(true);
  });

  const notCanonical: unknown[] = [
    "acv-7k3m-9qxd-4trh",
    "ACV7K3M9QXD4TRH",
    "ACV-7K3M-9QXD-4TR",
    "ACV-7K3M-9QXD-4TRHH",
    "ACV-7K3I-9QXD-4TRH",
    "ACV-7K3M-9QXD-4TRH\n",
    " ACV-7K3M-9QXD-4TRH",
    "",
    null,
    undefined,
    42,
    {},
  ];
  it.each(notCanonical.map((value) => [String(JSON.stringify(value)), value] as const))("rejects %s", (_label, value) => {
    expect(isVerificationCode(value)).toBe(false);
  });
});
