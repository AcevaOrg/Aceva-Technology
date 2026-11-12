import { describe, expect, it } from "vitest";
import { MAX_CODE_INPUT, charactersRemaining, formatCodeInput, normalizeCodeInput } from "@/components/documents/codeInput";
import { EMPTY_BODY, LISTED_CATEGORIES, QR_PANELS, UNLISTED_CATEGORIES, VERDICTS, isListedCategory } from "@/components/documents/content";
import {
  describeVerifierView,
  fieldString,
  fieldTags,
  fileHref,
  fileKindLabel,
  formatBytes,
  formatDate,
  formatDateRange,
  formatUtcTimestamp,
  initials,
  periodLabel,
  publicFieldRows,
  reportProblemHref,
  safeHref,
} from "@/components/documents/format";
import { groupListed } from "@/components/documents/registry";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import { generateVerificationCode, normalizeVerificationCode } from "@/lib/documents/codes";
import { toPublicDocument, type PublicDocument } from "@/lib/documents/public";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";

function record(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category,
    title: "Title",
    summary: "",
    status: "published",
    visibility: "public",
    allowDownload: true,
    featured: false,
    sortOrder: 0,
    holderName: "Holder",
    referenceNo: "REF-1",
    issuedOn: "2026-01-01",
    expiresOn: null,
    verificationCode: "ACV-7K3M-9QXD-4TRH",
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function publicDoc(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): PublicDocument {
  const projected = toPublicDocument(record(category, overrides), "verify", new Date("2026-11-04T12:00:00Z"));
  if (!projected) throw new Error("fixture not visible");
  return projected;
}

describe("dates and sizes", () => {
  it("formats a date from its characters, never through the local time zone", () => {
    expect(formatDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDate("2026-12-31T23:59:59.000Z")).toBe("31 Dec 2026");
    for (const bad of [null, undefined, "", "soon", "2026-13-01", "2026-00-10", "12/03/2026"]) expect(formatDate(bad), String(bad)).toBe("");
  });

  it("formats an instant in UTC", () => {
    expect(formatUtcTimestamp("2026-11-04T14:03:09.000Z")).toBe("4 Nov 2026, 14:03 UTC");
    expect(formatUtcTimestamp("2026-01-05T00:07:00.000Z")).toBe("5 Jan 2026, 00:07 UTC");
    expect(formatUtcTimestamp("not a date")).toBe("");
  });

  it("formats ranges, open ranges and empty ones", () => {
    expect(formatDateRange("2026-06-01", "2026-09-01")).toBe("1 Jun 2026 – 1 Sep 2026");
    expect(formatDateRange("2026-06-01", undefined)).toBe("1 Jun 2026 – Present");
    expect(formatDateRange("2026-06-01", null, "Now")).toBe("1 Jun 2026 – Now");
    expect(formatDateRange(undefined, "2026-09-01")).toBe("1 Sep 2026");
    expect(formatDateRange(undefined, undefined)).toBe("");
    expect(formatDateRange(5, true)).toBe("");
  });

  it("formats byte sizes in decimal units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1500)).toBe("2 KB");
    expect(formatBytes(1_250_000)).toBe("1.3 MB");
    expect(formatBytes(4_000_000)).toBe("4 MB");
    expect(formatBytes(-1)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });

  it("names file kinds", () => {
    expect(fileKindLabel("application/pdf")).toBe("PDF");
    expect(fileKindLabel("image/jpeg")).toBe("JPEG image");
    expect(fileKindLabel("application/x-unknown")).toBe("File");
  });
});

describe("names, links and field access", () => {
  it("takes initials by code point and tolerates odd input", () => {
    expect(initials("Aisha Khan")).toBe("AK");
    expect(initials("  bilal   ahmed  malik ")).toBe("BM");
    expect(initials("Sara")).toBe("S");
    expect(initials("Åsa Öberg")).toBe("ÅÖ");
    expect(initials("𝒜da Lovelace")).toBe("𝒜L");
    expect(initials("")).toBe("");
    expect(initials("   ")).toBe("");
  });

  it("builds a file URL that cannot change its own structure", () => {
    expect(fileHref("abc", "primary")).toBe("/api/documents/abc/file?role=primary");
    expect(fileHref("abc", "photo", { code: "ACV-7K3M-9QXD-4TRH", download: true })).toBe(
      "/api/documents/abc/file?role=photo&code=ACV-7K3M-9QXD-4TRH&download=1",
    );
    expect(fileHref("a/b?c", "primary", { code: "x&role=photo" })).toBe("/api/documents/a%2Fb%3Fc/file?role=primary&code=x%26role%3Dphoto");
    expect(fileHref("abc", "primary", { code: null })).not.toContain("code=");
  });

  it("lets only real http(s) addresses become links", () => {
    expect(safeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHref(" http://example.com ")).toBe("http://example.com/");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//example.com", "example.com", "https://user:pw@example.com", "", null, 5, {}]) {
      expect(safeHref(bad), String(bad)).toBeNull();
    }
  });

  it("reads strings and tags defensively", () => {
    expect(fieldString({ a: "x", b: 5 }, "a")).toBe("x");
    expect(fieldString({ a: "x", b: 5 }, "b")).toBe("");
    expect(fieldString({}, "missing")).toBe("");
    expect(fieldTags({ t: ["a", " ", "b"] }, "t")).toEqual(["a", "b"]);
    expect(fieldTags({ t: "a" }, "t")).toEqual([]);
  });

  it("builds the report-a-problem link without copying arbitrary text into a mail header", () => {
    const withCode = reportProblemHref("ACV-7K3M-9QXD-4TRH");
    expect(withCode.startsWith("mailto:contact@acevatech.com?subject=")).toBe(true);
    expect(decodeURIComponent(withCode)).toContain("Verification problem: ACV-7K3M-9QXD-4TRH");
    const without = reportProblemHref(null);
    expect(decodeURIComponent(without)).toContain("subject=Verification problem&");
    expect(without).not.toMatch(/[\r\n]/);
  });
});

describe("publicFieldRows", () => {
  it("labels selects, dates, booleans, tags and links, in the category's own order", () => {
    const doc = publicDoc("certification", {
      data: {
        direction: "issued",
        issuing_body: "ACEVA Technology",
        level: "Distinction",
        skills: ["React", "Testing"],
        credential_url: "https://example.com/c/1",
        internal_notes: "must never appear",
      },
    });
    const rows = publicFieldRows(doc);
    expect(rows.map((row) => row.key)).toEqual(["direction", "issuing_body", "level", "skills", "credential_url"]);
    expect(rows[0]).toMatchObject({ label: "Held or issued", kind: "text", text: "Issued by ACEVA" });
    expect(rows[3]).toMatchObject({ kind: "tags", tags: ["React", "Testing"] });
    expect(rows[4]).toMatchObject({ kind: "link", href: "https://example.com/c/1", text: "example.com/c/1" });
    expect(JSON.stringify(rows)).not.toContain("must never appear");
  });

  it("formats dates and Yes/No, and skips empty and non-public values", () => {
    const doc = publicDoc("experience_letter", {
      data: {
        designation: "Engineer",
        employment_type: "full_time",
        start_date: "2024-01-01",
        currently_employed: true,
        signatory_name: "Head of People",
        responsibilities: "private text",
        contact_email: "x@example.com",
      },
    });
    const byKey = Object.fromEntries(publicFieldRows(doc).map((row) => [row.key, row]));
    expect(byKey.start_date).toMatchObject({ text: "1 Jan 2024" });
    expect(byKey.currently_employed).toMatchObject({ text: "Yes" });
    expect(byKey.employment_type).toMatchObject({ text: "Full-time" });
    expect(byKey.responsibilities).toBeUndefined();
    expect(byKey.contact_email).toBeUndefined();
    expect(byKey.end_date).toBeUndefined();
  });

  it("returns nothing for a revoked record, which has no public fields", () => {
    const doc = publicDoc("certification", { revokedAt: "2026-05-01T00:00:00.000Z", data: { direction: "held", issuing_body: "BSI" } });
    expect(publicFieldRows(doc)).toEqual([]);
  });

  it("describes a custom reporting period by its range", () => {
    const custom = publicDoc("financial_report", {
      data: { report_type: "annual_report", fiscal_year: "2025-26", period: "custom", currency: "PKR", period_start: "2025-07-01", period_end: "2026-03-31" },
    });
    expect(periodLabel(custom)).toBe("1 Jul 2025 – 31 Mar 2026");
    const full = publicDoc("financial_report", { data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" } });
    expect(periodLabel(full)).toBe("Full year");
  });
});

describe("describeVerifierView", () => {
  it("lists what a letter's verifier sees and keeps the private fields out of it", () => {
    const { sees, hidden } = describeVerifierView("experience_letter");
    expect(sees).toContain("Employee / intern name");
    expect(sees).toContain("Designation");
    expect(sees).toContain("Signed by");
    expect(sees).toContain("Whether the record is valid, expired or revoked");
    expect(sees).not.toContain("Responsibilities");
    expect(hidden).toEqual(expect.arrayContaining(["Responsibilities", "Remarks", "Contact email", "Internal notes"]));
    expect(hidden).not.toContain("Designation");
  });

  it("mentions the photo, conditionally, only for categories that carry one", () => {
    expect(describeVerifierView("program_record").sees.some((item) => item.startsWith("Photo"))).toBe(true);
    expect(describeVerifierView("experience_letter").sees.some((item) => item.startsWith("Photo"))).toBe(false);
    expect(describeVerifierView("program_record").hidden).toEqual(expect.arrayContaining(["Contact email", "Internal notes"]));
    // a switch is a setting about the record, not a piece of data kept back
    expect(describeVerifierView("program_record").hidden).not.toContain("Show photo on public pages");
    expect(describeVerifierView("program_record").hidden).not.toContain("Consent to be listed publicly");
  });

  it("never shows a field in both lists, for any category", () => {
    for (const spec of CATEGORY_LIST) {
      const { sees, hidden } = describeVerifierView(spec.key);
      for (const item of hidden) expect(sees, `${spec.key}: ${item}`).not.toContain(item);
    }
  });
});

describe("verification code typing", () => {
  it("formats as you type, adding hyphens only when the next group starts", () => {
    const steps: Array<[string, string]> = [
      ["", ""],
      ["a", "A"],
      ["ac", "AC"],
      ["acv", "ACV"],
      ["acv7", "ACV-7"],
      ["acv7k3m", "ACV-7K3M"],
      ["acv7k3m9", "ACV-7K3M-9"],
      ["ACV-7K3M-", "ACV-7K3M"],
      ["acv 7k3m 9qxd 4trh", "ACV-7K3M-9QXD-4TRH"],
      ["acv7k3m9qxd4trhEXTRA", "ACV-7K3M-9QXD-4TRH"],
    ];
    for (const [typed, shown] of steps) expect(formatCodeInput(typed), typed).toBe(shown);
  });

  it("supplies the prefix when the visitor leaves it off", () => {
    expect(formatCodeInput("7k3m9qxd4trh")).toBe("ACV-7K3M-9QXD-4TRH");
    expect(formatCodeInput("7")).toBe("ACV-7");
  });

  it("never grows past a complete code and is idempotent", () => {
    for (const raw of ["acv7k3m9qxd4trh", "7K3M9QXD4TRH", "acv-7k3m-9qxd-4trh-0000", "ACV-7K3M"]) {
      const once = formatCodeInput(raw);
      expect(once.length).toBeLessThanOrEqual(18);
      expect(formatCodeInput(once)).toBe(once);
    }
  });

  it("counts what is still missing", () => {
    expect(charactersRemaining("")).toBe(12);
    expect(charactersRemaining("ACV")).toBe(12);
    expect(charactersRemaining("ACV-7K3M")).toBe(8);
    expect(charactersRemaining("ACV-7K3M-9QXD-4TRH")).toBe(0);
    expect(charactersRemaining("7K3M9QXD4TRH")).toBe(0);
    expect(charactersRemaining("ACV-7K3M-9QXD-4TRHZZZ")).toBe(0);
  });

  it("agrees with the server's normaliser on everything the server accepts", () => {
    const real = generateVerificationCode();
    const body = real.slice(4).replaceAll("-", "");
    const accepted = [
      real,
      real.toLowerCase(),
      real.replaceAll("-", ""),
      real.replaceAll("-", " "),
      `  ${real}  `,
      real.replaceAll("-", "–"),
      `ACV-${body.slice(0, 4).replace(/1/g, "I")}-${body.slice(4, 8)}-${body.slice(8)}`,
      "acv-oooo-iiii-llll",
      "ACV-0123-4567-89AB",
      "ＡＣＶ－７Ｋ３Ｍ－９ＱＸＤ－４ＴＲＨ",
    ];
    for (const input of accepted) {
      const server = normalizeVerificationCode(input);
      expect(server, `server accepts ${input}`).not.toBeNull();
      expect(normalizeCodeInput(input), input).toBe(server);
    }
  });

  it("agrees with the server's normaliser on what it rejects", () => {
    const rejected = [
      "",
      "ACV",
      "ACV-7K3M-9QXD",
      "ACV-7K3M-9QXD-4TRHH",
      "XYZ-7K3M-9QXD-4TRH",
      "ACV-UUUU-UUUU-UUUU",
      "ACV-7K3M-9QXD-4TR!",
      "hello world",
      "7K3M9QXD4TR",
      "x".repeat(200),
    ];
    for (const input of rejected) {
      expect(normalizeVerificationCode(input), `server rejects ${input}`).toBeNull();
      expect(normalizeCodeInput(input), input.slice(0, 30)).toBeNull();
    }
  });

  it("is kinder than the server in two documented ways, and the server still has the last word", () => {
    // a bare 12-character body, and stray punctuation between groups
    expect(normalizeVerificationCode("7K3M9QXD4TRH")).toBeNull();
    expect(normalizeCodeInput("7K3M9QXD4TRH")).toBe("ACV-7K3M-9QXD-4TRH");
    expect(normalizeCodeInput("ACV.7K3M/9QXD_4TRH")).toBe("ACV-7K3M-9QXD-4TRH");
    // whatever the client produces, the server accepts it
    expect(normalizeVerificationCode(normalizeCodeInput("7K3M9QXD4TRH") as string)).toBe("ACV-7K3M-9QXD-4TRH");
  });

  it("looks at no more than the server's own input cap", () => {
    expect(MAX_CODE_INPUT).toBe(64);
    expect(formatCodeInput("a".repeat(10_000)).length).toBeLessThanOrEqual(18);
  });
});

describe("the hub's data and copy", () => {
  it("groups listed categories and drops the unlisted ones, even if a stray record is public", () => {
    const certification = publicDoc("certification");
    const stray = publicDoc("experience_letter");
    const grouped = groupListed([certification, stray]);
    expect(Object.keys(grouped)).toEqual([...LISTED_CATEGORIES]);
    expect(grouped.certification).toEqual([certification]);
    expect(JSON.stringify(grouped)).not.toContain("experience_letter");
    expect(grouped.financial_report).toEqual([]);
  });

  it("covers every category exactly once, listed or unlisted", () => {
    const all = [...LISTED_CATEGORIES, ...UNLISTED_CATEGORIES].sort();
    expect(all).toEqual(CATEGORY_LIST.map((spec) => spec.key).sort());
    for (const key of LISTED_CATEGORIES) expect(isListedCategory(key)).toBe(true);
    for (const key of UNLISTED_CATEGORIES) expect(isListedCategory(key)).toBe(false);
  });

  it("has an empty-state sentence for every listed category and a panel for every unlisted one", () => {
    for (const key of LISTED_CATEGORIES) expect(EMPTY_BODY[key].length).toBeGreaterThan(20);
    for (const key of UNLISTED_CATEGORIES) {
      expect(QR_PANELS[key].title.length).toBeGreaterThan(5);
      // the unlisted categories really are unlisted by their own spec
      expect(CATEGORIES[key].allowedVisibility).not.toContain("public");
    }
  });

  it("words 'not found' without confirming that a code ever existed", () => {
    const text = `${VERDICTS.not_found.headline} ${VERDICTS.not_found.body}`.toLowerCase();
    expect(text).not.toMatch(/revoked|deleted|removed|no longer|private|draft|archived|exist/);
  });
});
