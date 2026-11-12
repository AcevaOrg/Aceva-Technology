import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import type { DocumentCategory, DocumentFileMeta, DocumentRecord, FieldSpec, FieldValue } from "@/lib/documents/types";
import { HIERARCHY_LEVELS } from "@/lib/documents/types";
import {
  cleanText,
  parseBooleanLike,
  parseEmail,
  parseHttpUrl,
  parseIsoDate,
  validateDocumentInput,
  validatePublishable,
  visibleFieldKeys,
  type DocumentInput,
} from "@/lib/documents/validate";
import { requirePhoto, setBooleanDefault } from "../helpers/specOverrides";

const char = (code: number) => String.fromCharCode(code);

/** The smallest payload that satisfies every required field of each category. */
const VALID: Record<DocumentCategory, Record<string, unknown>> = {
  financial_report: {
    title: "FY 2025-26 Audited Statements",
    issuedOn: "2026-01-10",
    data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR" },
  },
  company_identity: {
    title: "Certificate of Incorporation",
    data: { identity_type: "incorporation_certificate" },
  },
  certification: {
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    data: { direction: "held", issuing_body: "BSI" },
  },
  program_record: {
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", start_date: "2026-06-01", record_status: "active" },
  },
  experience_letter: {
    title: "Experience letter",
    holderName: "Bilal Ahmed",
    referenceNo: "ACV/EL/2026/0007",
    issuedOn: "2026-02-01",
    data: {
      designation: "Software Engineer",
      employment_type: "full_time",
      start_date: "2024-01-01",
      currently_employed: true,
      signatory_name: "Head of People",
    },
  },
};

function payload(
  category: DocumentCategory,
  top: Record<string, unknown> = {},
  data: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = VALID[category];
  return { ...base, ...top, data: { ...(base.data as Record<string, unknown>), ...data } };
}

function run(category: DocumentCategory, top: Record<string, unknown> = {}, data: Record<string, unknown> = {}, existing?: DocumentRecord) {
  return validateDocumentInput(payload(category, top, data), { category, existing });
}

function errorsOf(result: ReturnType<typeof validateDocumentInput>): Record<string, string> {
  if (result.ok) throw new Error("expected validation to fail");
  return result.errors;
}

function valueOf(result: ReturnType<typeof validateDocumentInput>): DocumentInput {
  if (!result.ok) throw new Error(`expected validation to pass: ${JSON.stringify(result.errors)}`);
  return result.value;
}

function makeRecord(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  const input = valueOf(run(category));
  return {
    id: "22222222-2222-4222-8222-222222222222",
    category,
    title: input.title,
    summary: input.summary,
    status: "draft",
    visibility: CATEGORIES[category].defaultVisibility,
    allowDownload: false,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: input.holderName,
    referenceNo: input.referenceNo,
    issuedOn: input.issuedOn,
    expiresOn: input.expiresOn,
    verificationCode: null,
    revokedAt: null,
    revokedReason: "",
    data: input.data,
    files: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

const file = (role: "primary" | "photo"): DocumentFileMeta => ({
  id: "f",
  documentId: "d",
  role,
  filename: "x",
  mimeType: "application/pdf",
  sizeBytes: 1,
  sha256: "0".repeat(64),
  createdAt: "",
});

/** Temporarily adds fields to a category so rules no shipped category exercises (numbers, chains) can be tested. */
function withFields(category: DocumentCategory, extra: FieldSpec[], body: () => void): void {
  const fields = CATEGORIES[category].fields as FieldSpec[];
  const originalLength = fields.length;
  fields.push(...extra);
  try {
    body();
  } finally {
    fields.splice(originalLength);
  }
}

/* ------------------------------------------------------------------ *
 * The specs themselves                                                *
 * ------------------------------------------------------------------ */

describe("fixture coverage", () => {
  it.each(CATEGORY_LIST.map((spec) => [spec.key]))("%s: the minimal payload is valid", (key) => {
    const result = run(key);
    expect(result.ok, JSON.stringify(result.ok ? {} : result.errors)).toBe(true);
  });

  it.each(CATEGORY_LIST.map((spec) => [spec.key]))("%s: the defaults come from the category", (key) => {
    const spec = CATEGORIES[key];
    const value = valueOf(run(key));
    expect(value).toMatchObject({
      category: key,
      status: "draft",
      visibility: spec.defaultVisibility,
      allowDownload: false,
      featured: false,
      sortOrder: 0,
      enableVerification: spec.verifiable,
    });
  });
});

/* ------------------------------------------------------------------ *
 * Required fields, derived from the spec                              *
 * ------------------------------------------------------------------ */

describe("required base fields", () => {
  for (const spec of CATEGORY_LIST) {
    for (const key of ["title", "summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
      const base = spec.base[key];
      if (base.hidden || !base.required) continue;
      it(`${spec.key}: ${key} is required`, () => {
        const errors = errorsOf(run(spec.key, { [key]: undefined }));
        expect(errors[key]).toMatch(/required/i);
        const blank = errorsOf(run(spec.key, { [key]: "   " }));
        expect(blank[key]).toMatch(/required/i);
        const nulled = errorsOf(run(spec.key, { [key]: null }));
        expect(nulled[key]).toMatch(/required/i);
      });
    }
  }
});

describe("required category fields", () => {
  for (const spec of CATEGORY_LIST) {
    for (const field of spec.fields) {
      if (!field.required || field.showWhen) continue;
      it(`${spec.key}: ${field.key} is required`, () => {
        const errors = errorsOf(run(spec.key, {}, { [field.key]: undefined }));
        expect(errors[field.key]).toMatch(/required/i);
        const empty = errorsOf(run(spec.key, {}, { [field.key]: "" }));
        expect(empty[field.key]).toMatch(/required/i);
      });
    }
  }
});

describe("optional fields", () => {
  for (const spec of CATEGORY_LIST) {
    for (const field of spec.fields) {
      if (field.required || field.requiredWhen || field.showWhen || field.type === "boolean") continue;
      it(`${spec.key}: ${field.key} may be left out and then does not appear in data`, () => {
        const value = valueOf(run(spec.key, {}, { [field.key]: undefined }));
        expect(value.data).not.toHaveProperty(field.key);
        const blank = valueOf(run(spec.key, {}, { [field.key]: "" }));
        expect(blank.data).not.toHaveProperty(field.key);
      });
    }
  }
});

describe("hidden base fields are cleared, whatever the client sends", () => {
  for (const spec of CATEGORY_LIST) {
    for (const key of ["summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
      if (!spec.base[key].hidden) continue;
      it(`${spec.key}: ${key}`, () => {
        const sent = key === "issuedOn" || key === "expiresOn" ? "2026-05-05" : "should be ignored";
        const value = valueOf(run(spec.key, { [key]: sent }));
        expect(value[key]).toBe(key === "issuedOn" || key === "expiresOn" ? null : "");
      });
    }
  }
});

/* ------------------------------------------------------------------ *
 * Field types                                                         *
 * ------------------------------------------------------------------ */

describe("select fields", () => {
  for (const spec of CATEGORY_LIST) {
    for (const field of spec.fields) {
      if (field.type !== "select" || !field.options) continue;
      if (field.showWhen) continue;
      for (const option of field.options) {
        it(`${spec.key}.${field.key} accepts "${option.value}"`, () => {
          const result = run(spec.key, {}, { [field.key]: option.value });
          // some options switch other fields on (period "custom"), so judge only this field
          if (result.ok) expect(result.value.data[field.key]).toBe(option.value);
          else expect(result.errors).not.toHaveProperty(field.key);
        });
      }
      it(`${spec.key}.${field.key} rejects a value that is not an option`, () => {
        expect(errorsOf(run(spec.key, {}, { [field.key]: "not-an-option" }))[field.key]).toMatch(/listed options/);
        expect(errorsOf(run(spec.key, {}, { [field.key]: "'; DROP TABLE documents;--" }))[field.key]).toBeTruthy();
      });
      it(`${spec.key}.${field.key} matches options exactly (case and labels do not count)`, () => {
        const first = field.options?.[0];
        if (!first) return;
        expect(errorsOf(run(spec.key, {}, { [field.key]: first.value.toUpperCase() + "x" }))[field.key]).toBeTruthy();
        if (first.label !== first.value) {
          expect(errorsOf(run(spec.key, {}, { [field.key]: first.label }))[field.key]).toBeTruthy();
        }
      });
    }
  }
});

describe("text length limits", () => {
  for (const spec of CATEGORY_LIST) {
    for (const field of spec.fields) {
      if ((field.type !== "text" && field.type !== "textarea") || !field.maxLength || field.showWhen) continue;
      const max = field.maxLength;
      it(`${spec.key}.${field.key}: ${max} characters pass, ${max + 1} fail`, () => {
        expect(valueOf(run(spec.key, {}, { [field.key]: "a".repeat(max) })).data[field.key]).toHaveLength(max);
        expect(errorsOf(run(spec.key, {}, { [field.key]: "a".repeat(max + 1) }))[field.key]).toMatch(String(max));
      });
    }
  }

  it.each([
    ["title", 200],
    ["summary", 600],
    ["holderName", 160],
    ["referenceNo", 80],
  ] as const)("base %s: limit %i", (key, max) => {
    expect(run("certification", { [key]: "a".repeat(max) }).ok).toBe(true);
    expect(errorsOf(run("certification", { [key]: "a".repeat(max + 1) }))[key]).toMatch(String(max));
  });

  it("counts characters, not UTF-16 units", () => {
    const emoji = "😀".repeat(200);
    expect(run("certification", { title: emoji }).ok).toBe(true);
    expect(run("certification", { title: emoji + "😀" }).ok).toBe(false);
  });

  it("does not silently truncate: too long is an error", () => {
    expect(run("certification", { title: "x".repeat(5000) }).ok).toBe(false);
  });
});

describe("text hygiene", () => {
  it("trims and collapses whitespace in single-line text", () => {
    expect(valueOf(run("certification", { title: "   Spaced    out \t title  " })).title).toBe("Spaced out title");
  });

  it("flattens newlines in single-line fields", () => {
    expect(valueOf(run("certification", { title: "one\ntwo\r\nthree" })).title).toBe("one two three");
  });

  it("keeps paragraph breaks in multi-line fields but not runs of blank lines", () => {
    const value = valueOf(run("certification", { summary: "line one  \n\n\n\n  line two\r\nline three" }));
    expect(value.summary).toBe("line one\n\nline two\nline three");
  });

  it("strips control characters", () => {
    const dirty = `A${char(0)}B${char(1)}C${char(7)}D${char(27)}E${char(0x7f)}F${char(0x85)}G`;
    expect(valueOf(run("certification", { title: dirty })).title).toBe("ABCDEFG");
  });

  it("strips zero-width and bidirectional-override characters", () => {
    const dirty = `ISO${char(0x200b)}27001${char(0x200c)}${char(0x200d)}${char(0x2060)}${char(0xfeff)}${char(0xad)}${char(0x202e)}${char(0x2066)}`;
    expect(valueOf(run("certification", { title: dirty })).title).toBe("ISO27001");
  });

  it("strips unpaired surrogates (Postgres cannot store them)", () => {
    const value = valueOf(run("certification", { title: `ok${char(0xd800)}${char(0xdc00)}${char(0xd83d)}x${char(0xdc00)}y` }));
    expect(value.title).toBe(`ok${char(0xd800)}${char(0xdc00)}xy`);
    expect(() => JSON.stringify(value)).not.toThrow();
  });

  it("normalises to NFC so look-alike composed strings compare equal", () => {
    const decomposed = `Cafe${char(0x301)}`;
    expect(valueOf(run("certification", { title: decomposed })).title).toBe("Café");
  });

  it("applies the same hygiene to category fields", () => {
    const value = valueOf(run("certification", {}, { issuing_body: ` B${char(0x200b)}SI ${char(0)}` }));
    expect(value.data.issuing_body).toBe("BSI");
  });

  it("accepts numbers for text fields (a fiscal year typed as 2026)", () => {
    expect(valueOf(run("financial_report", {}, { fiscal_year: 2026 })).data.fiscal_year).toBe("2026");
  });

  it("rejects objects and arrays where text is expected", () => {
    expect(errorsOf(run("certification", { title: { evil: true } })).title).toBeTruthy();
    expect(errorsOf(run("certification", {}, { issuing_body: ["a"] })).issuing_body).toBeTruthy();
    expect(errorsOf(run("certification", { title: true })).title).toBeTruthy();
  });

  it("cleanText is exported for reuse and is idempotent", () => {
    const once = cleanText(`  a${char(0x200b)}   b\n`);
    expect(once).toBe("a b");
    expect(cleanText(once)).toBe(once);
  });
});

describe("dates", () => {
  const good = ["2026-01-01", "2024-02-29", "2000-02-29", "2026-12-31", "1900-01-01", "2100-12-31", "2026-04-30"];
  it.each(good)("accepts %s", (date) => {
    expect(parseIsoDate(date)).toBe(date);
    expect(valueOf(run("certification", { issuedOn: date })).issuedOn).toBe(date);
  });

  const bad = [
    "2026-02-30", "2025-02-29", "1900-02-29", "2026-13-01", "2026-00-10", "2026-01-00", "2026-01-32", "2026-04-31",
    "2026-1-1", "26-01-01", "2026/01/01", "01-01-2026", "2026-01-01T00:00:00Z", "2026-01-01 ", "20260101", "yesterday",
    "1899-12-31", "2101-01-01", "0000-01-01", "9999-99-99", "2026-01-01; DROP", "２０２６-01-01",
  ];
  it.each(bad)("rejects %j", (date) => {
    const result = run("certification", { issuedOn: date });
    // surrounding whitespace is trimmed, so "2026-01-01 " is the one value that legitimately normalises
    if (date.trim() === "2026-01-01") expect(valueOf(result).issuedOn).toBe("2026-01-01");
    else expect(errorsOf(result).issuedOn).toMatch(/date/i);
  });

  it("rejects non-string dates", () => {
    for (const value of [20260101, true, {}, [], new Date("2026-01-01")]) {
      expect(errorsOf(run("certification", { issuedOn: value })).issuedOn).toBeTruthy();
    }
  });

  it("allows an empty optional date", () => {
    expect(valueOf(run("certification", { expiresOn: "" })).expiresOn).toBeNull();
    expect(valueOf(run("certification", { expiresOn: null })).expiresOn).toBeNull();
  });

  it("allows expiry on the same day as issue", () => {
    expect(run("certification", { issuedOn: "2026-05-05", expiresOn: "2026-05-05" }).ok).toBe(true);
  });

  it("rejects expiry before issue", () => {
    expect(errorsOf(run("certification", { issuedOn: "2026-05-05", expiresOn: "2026-05-04" })).expiresOn).toMatch(/on or after/);
    expect(errorsOf(run("company_identity", { issuedOn: "2027-01-01", expiresOn: "2026-01-01" })).expiresOn).toMatch(/on or after/);
  });

  it("does not stack a second message on a malformed expiry", () => {
    expect(errorsOf(run("certification", { issuedOn: "2026-05-05", expiresOn: "nonsense" })).expiresOn).toMatch(/real date/);
  });

  it("parseIsoDate rejects strings that are not full dates", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
  });
});

describe("paired date fields", () => {
  it("period_end must not precede period_start (custom reporting period)", () => {
    const custom = { period: "custom", period_start: "2026-04-01", period_end: "2026-03-31" };
    expect(errorsOf(run("financial_report", {}, custom)).period_end).toMatch(/before the start/);
    expect(run("financial_report", {}, { ...custom, period_end: "2026-04-01" }).ok).toBe(true);
    expect(run("financial_report", {}, { ...custom, period_end: "2026-09-30" }).ok).toBe(true);
  });

  it("a custom period needs both ends", () => {
    const errors = errorsOf(run("financial_report", {}, { period: "custom" }));
    expect(errors.period_start).toMatch(/required/i);
    expect(errors.period_end).toMatch(/required/i);
    expect(errorsOf(run("financial_report", {}, { period: "custom", period_start: "2026-01-01" })).period_end).toMatch(/required/i);
  });

  it("a standard period does not need them", () => {
    expect(run("financial_report", {}, { period: "q2" }).ok).toBe(true);
  });

  it("start_date and end_date of a program record keep their order", () => {
    expect(errorsOf(run("program_record", {}, { start_date: "2026-08-01", end_date: "2026-07-31" })).end_date).toMatch(/before the start/);
    expect(run("program_record", {}, { start_date: "2026-08-01", end_date: "2026-08-01" }).ok).toBe(true);
  });

  it("start_date and end_date of an experience letter keep their order", () => {
    const ended = { currently_employed: false, start_date: "2025-01-01", end_date: "2024-12-31" };
    expect(errorsOf(run("experience_letter", {}, ended)).end_date).toMatch(/before the start/);
    expect(run("experience_letter", {}, { ...ended, end_date: "2025-06-30" }).ok).toBe(true);
  });
});

describe("conditional fields (showWhen / requiredWhen)", () => {
  it("an ended experience letter needs an end date", () => {
    expect(errorsOf(run("experience_letter", {}, { currently_employed: false })).end_date).toMatch(/required/i);
    expect(run("experience_letter", {}, { currently_employed: false, end_date: "2025-12-31" }).ok).toBe(true);
  });

  it("an unanswered 'currently employed' counts as its default (no) and so needs an end date", () => {
    const data = { ...(VALID.experience_letter.data as Record<string, unknown>) };
    delete data.currently_employed;
    const result = validateDocumentInput({ ...VALID.experience_letter, data }, { category: "experience_letter" });
    expect(errorsOf(result).end_date).toMatch(/required/i);
  });

  it("a current employee's end date is cleared, even when it is garbage", () => {
    const value = valueOf(run("experience_letter", {}, { currently_employed: true, end_date: "not-a-date" }));
    expect(value.data).not.toHaveProperty("end_date");
    const valid = valueOf(run("experience_letter", {}, { currently_employed: true, end_date: "2025-12-31" }));
    expect(valid.data).not.toHaveProperty("end_date");
  });

  it("the auditor is required, shown and kept only for audited reports", () => {
    expect(errorsOf(run("financial_report", {}, { audited: true })).auditor).toMatch(/required/i);
    expect(valueOf(run("financial_report", {}, { audited: true, auditor: "Big Four LLP" })).data.auditor).toBe("Big Four LLP");
    const unaudited = valueOf(run("financial_report", {}, { audited: false, auditor: "Big Four LLP" }));
    expect(unaudited.data).not.toHaveProperty("auditor");
    const unanswered = valueOf(run("financial_report", {}, { auditor: "Big Four LLP" }));
    expect(unanswered.data).not.toHaveProperty("auditor");
  });

  it("a hidden field's own validation errors are discarded", () => {
    expect(run("financial_report", {}, { audited: false, auditor: "x".repeat(10_000) }).ok).toBe(true);
  });

  it("visibleFieldKeys reflects the stored values", () => {
    const hidden = visibleFieldKeys("experience_letter", { currently_employed: true });
    expect(hidden.has("end_date")).toBe(false);
    expect(hidden.has("designation")).toBe(true);
    expect(visibleFieldKeys("experience_letter", { currently_employed: false }).has("end_date")).toBe(true);
    expect(visibleFieldKeys("experience_letter", {}).has("end_date")).toBe(true);
    expect(visibleFieldKeys("financial_report", { audited: true }).has("auditor")).toBe(true);
    expect(visibleFieldKeys("financial_report", {}).has("auditor")).toBe(false);
  });

  it("chains: a field is visible only if its controller is visible too", () => {
    const chain: FieldSpec[] = [
      { key: "gate", label: "Gate", type: "boolean", group: "T", public: false, defaultValue: false },
      { key: "mid", label: "Mid", type: "boolean", group: "T", public: false, showWhen: { key: "gate", equals: true }, defaultValue: true },
      { key: "leaf", label: "Leaf", type: "text", group: "T", public: false, showWhen: { key: "mid", equals: true }, requiredWhen: { key: "mid", equals: true } },
    ];
    withFields("company_identity", chain, () => {
      // gate off: mid hidden, so leaf hidden even though mid's default is true
      expect(valueOf(run("company_identity", {}, { gate: false, leaf: "x" })).data).not.toHaveProperty("leaf");
      expect(run("company_identity", {}, { gate: false }).ok).toBe(true);
      // gate on: mid defaults to true, so leaf is shown and required
      expect(errorsOf(run("company_identity", {}, { gate: true })).leaf).toMatch(/required/i);
      expect(valueOf(run("company_identity", {}, { gate: true, leaf: "x" })).data.leaf).toBe("x");
    });
  });

  it("fails closed on a rule that points at a missing field or loops", () => {
    const broken: FieldSpec[] = [
      { key: "orphan", label: "Orphan", type: "text", group: "T", public: false, showWhen: { key: "does_not_exist", equals: true } },
      { key: "loop_a", label: "A", type: "text", group: "T", public: false, showWhen: { key: "loop_b", equals: "x" } },
      { key: "loop_b", label: "B", type: "text", group: "T", public: false, showWhen: { key: "loop_a", equals: "x" } },
    ];
    withFields("company_identity", broken, () => {
      const value = valueOf(run("company_identity", {}, { orphan: "a", loop_a: "x", loop_b: "x" }));
      expect(value.data).not.toHaveProperty("orphan");
      expect(value.data).not.toHaveProperty("loop_a");
      expect(value.data).not.toHaveProperty("loop_b");
    });
  });
});

describe("numbers", () => {
  const numeric: FieldSpec[] = [
    { key: "score", label: "Score", type: "number", group: "T", public: false, min: 0, max: 100 },
    { key: "free", label: "Free", type: "number", group: "T", public: false },
    { key: "at_least", label: "At least", type: "number", group: "T", public: false, min: 10 },
    { key: "at_most", label: "At most", type: "number", group: "T", public: false, max: 10 },
  ];

  it("accepts numbers and numeric strings within range", () => {
    withFields("company_identity", numeric, () => {
      expect(valueOf(run("company_identity", {}, { score: 50 })).data.score).toBe(50);
      expect(valueOf(run("company_identity", {}, { score: "50" })).data.score).toBe(50);
      expect(valueOf(run("company_identity", {}, { score: " 7.5 " })).data.score).toBe(7.5);
      expect(valueOf(run("company_identity", {}, { score: 0 })).data.score).toBe(0);
      expect(valueOf(run("company_identity", {}, { score: 100 })).data.score).toBe(100);
      expect(valueOf(run("company_identity", {}, { free: -1234.5 })).data.free).toBe(-1234.5);
    });
  });

  it("rejects out-of-range values", () => {
    withFields("company_identity", numeric, () => {
      expect(errorsOf(run("company_identity", {}, { score: -1 })).score).toMatch(/between 0 and 100/);
      expect(errorsOf(run("company_identity", {}, { score: 101 })).score).toMatch(/between 0 and 100/);
      expect(errorsOf(run("company_identity", {}, { at_least: 9 })).at_least).toMatch(/at least 10/);
      expect(errorsOf(run("company_identity", {}, { at_most: 11 })).at_most).toMatch(/at most 10/);
    });
  });

  it("rejects things that are not plain numbers", () => {
    withFields("company_identity", numeric, () => {
      for (const bad of ["abc", "1e3", "0x10", "1,000", "NaN", "Infinity", NaN, Infinity, {}, [], true, "5; DROP"]) {
        expect(errorsOf(run("company_identity", {}, { free: bad })).free, String(bad)).toMatch(/number/i);
      }
    });
  });

  it("treats an empty number as absent", () => {
    withFields("company_identity", numeric, () => {
      const value = valueOf(run("company_identity", {}, { score: "", free: null }));
      expect(value.data).not.toHaveProperty("score");
      expect(value.data).not.toHaveProperty("free");
    });
  });
});

describe("booleans", () => {
  it.each([
    [true, true], [false, false], ["true", true], ["false", false], ["on", true], ["off", false],
    ["yes", true], ["no", false], ["1", true], ["0", false], ["TRUE", true], [" False ", false], [1, true], [0, false],
  ])("category boolean %j becomes %j", (input, expected) => {
    expect(valueOf(run("financial_report", {}, { audited: input, auditor: "X" })).data.audited).toBe(expected);
  });

  it.each(["maybe", "2", 2, "tru", {}, [], "null"])("rejects %j", (input) => {
    expect(errorsOf(run("financial_report", {}, { audited: input })).audited).toMatch(/yes or no/);
  });

  it("an unanswered boolean takes the spec default", () => {
    expect(valueOf(run("financial_report")).data.audited).toBe(false);
    expect(valueOf(run("program_record")).data.consent_to_publish).toBe(false);
    expect(valueOf(run("program_record")).data.show_photo).toBe(false);
    expect(valueOf(run("program_record", {}, { show_photo: null })).data.show_photo).toBe(false);
    expect(valueOf(run("program_record", {}, { show_photo: "" })).data.show_photo).toBe(false);
  });

  it("takes whatever default the spec declares, true included", () => {
    // Every shipped boolean now defaults to false, so a false result alone would not prove the default is read.
    const undo = setBooleanDefault("program_record", "show_photo", true);
    try {
      expect(valueOf(run("program_record")).data.show_photo).toBe(true);
      expect(valueOf(run("program_record", {}, { show_photo: null })).data.show_photo).toBe(true);
      expect(valueOf(run("program_record", {}, { show_photo: "" })).data.show_photo).toBe(true);
      expect(valueOf(run("program_record", {}, { show_photo: false })).data.show_photo).toBe(false);
    } finally {
      undo();
    }
  });

  it("parseBooleanLike", () => {
    expect(parseBooleanLike("Yes")).toBe(true);
    expect(parseBooleanLike("nope")).toBeUndefined();
    expect(parseBooleanLike(undefined)).toBeUndefined();
  });
});

describe("tags", () => {
  const tags = (value: unknown) => run("certification", {}, { skills: value });

  it("accepts an array", () => {
    expect(valueOf(tags(["react", "node"])).data.skills).toEqual(["react", "node"]);
  });

  it("accepts a comma-separated string", () => {
    expect(valueOf(tags("react, node ,  typescript")).data.skills).toEqual(["react", "node", "typescript"]);
  });

  it("splits commas inside array items too", () => {
    expect(valueOf(tags(["a, b", "c"])).data.skills).toEqual(["a", "b", "c"]);
  });

  it("trims, drops empties and de-duplicates case-insensitively (first spelling wins)", () => {
    expect(valueOf(tags(" React , react,, REACT ,Node,  ")).data.skills).toEqual(["React", "Node"]);
  });

  it("omits an empty list", () => {
    for (const empty of ["", "  ", ",,,", [], [""], null, undefined]) {
      expect(valueOf(tags(empty)).data).not.toHaveProperty("skills");
    }
  });

  it("allows exactly 12 tags and rejects 13", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `tag${i}`);
    expect(valueOf(tags(twelve)).data.skills).toHaveLength(12);
    expect(errorsOf(tags([...twelve, "tag12"])).skills).toMatch(/at most 12/);
    expect(errorsOf(tags(twelve.join(",") + ",extra")).skills).toMatch(/at most 12/);
  });

  it("de-duplicates before counting", () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag${i % 12}`);
    expect(valueOf(tags(many)).data.skills).toHaveLength(12);
  });

  it("limits each tag to the field's maxLength (40)", () => {
    expect(valueOf(tags(["a".repeat(40)])).data.skills).toEqual(["a".repeat(40)]);
    expect(errorsOf(tags(["a".repeat(41)])).skills).toMatch(/at most 40/);
  });

  it("rejects non-string items and other types", () => {
    for (const bad of [[1, 2], [{}], [null], 5, true, {}]) {
      expect(errorsOf(tags(bad)).skills, JSON.stringify(bad)).toMatch(/comma/);
    }
  });

  it("cleans each tag", () => {
    expect(valueOf(tags([`re${char(0x200b)}act`, `no${char(0)}de`])).data.skills).toEqual(["react", "node"]);
  });
});

describe("urls", () => {
  const url = (value: unknown) => run("certification", {}, { credential_url: value });

  const good: Array<[string, string]> = [
    ["https://credly.com/badges/abc", "https://credly.com/badges/abc"],
    ["http://example.com/x?y=1#z", "http://example.com/x?y=1#z"],
    ["HTTPS://Example.COM/Path", "https://example.com/Path"],
    ["https://example.com", "https://example.com/"],
    ["https://sub.domain.example.co.uk:8443/a/b", "https://sub.domain.example.co.uk:8443/a/b"],
    ["  https://example.com/trim  ", "https://example.com/trim"],
    ["https://xn--bcher-kva.example/", "https://xn--bcher-kva.example/"],
  ];
  it.each(good)("accepts %j", (input, expected) => {
    expect(valueOf(url(input)).data.credential_url).toBe(expected);
    expect(parseHttpUrl(input.trim())).toBe(expected);
  });

  const bad = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", `java${char(0x200b)}script:alert(1)`,
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd", "ftp://example.com/x", "mailto:a@b.co",
    "blob:https://example.com/abc", "about:blank", "//evil.example/x", "/relative/path", "example.com", "www.example.com",
    "https://", "http://", "not a url", "https://exa mple.com", "https://user:pass@example.com/", "https://user@example.com/",
    "https://example.com/a b", "ws://example.com", "javascript://example.com/%0Aalert(1)",
  ];
  it.each(bad)("rejects %j", (input) => {
    expect(errorsOf(url(input)).credential_url).toMatch(/http/);
    expect(parseHttpUrl(input)).toBeNull();
  });

  it("enforces the field's maxLength (300)", () => {
    const long = "https://example.com/" + "a".repeat(290);
    expect(errorsOf(url(long)).credential_url).toMatch(/at most 300/);
  });

  it("allows it to be empty", () => {
    expect(valueOf(url("")).data).not.toHaveProperty("credential_url");
  });
});

describe("emails", () => {
  const email = (value: unknown) => run("program_record", {}, { contact_email: value });

  const good: Array<[string, string]> = [
    ["aisha@example.com", "aisha@example.com"],
    ["Aisha.Khan+intern@Example.COM", "Aisha.Khan+intern@example.com"],
    ["a_b-c@sub.example.co.pk", "a_b-c@sub.example.co.pk"],
    ["  spaced@example.com  ", "spaced@example.com"],
    ["o'brien@example.ie", "o'brien@example.ie"],
    ["x@y.io", "x@y.io"],
  ];
  it.each(good)("accepts %j", (input, expected) => {
    expect(valueOf(email(input)).data.contact_email).toBe(expected);
  });

  const bad = [
    "plain", "@example.com", "a@", "a@b", "a@.com", "a@b..com", "a..b@example.com", ".a@example.com", "a.@example.com",
    "a b@example.com", "a@exa mple.com", "a@@example.com", "a@example.com.", "a@-example.com", "a@example-.com",
    "<script>@example.com", "a@example.com\nBcc: evil@example.com", "a,b@example.com", "a@example.c om", "a@[127.0.0.1]",
  ];
  it.each(bad)("rejects %j", (input) => {
    expect(errorsOf(email(input)).contact_email).toMatch(/email/i);
  });

  it("limits length (local part 64, whole address 200 by spec)", () => {
    expect(errorsOf(email(`${"a".repeat(65)}@example.com`)).contact_email).toBeTruthy();
    expect(errorsOf(email(`a@${"b".repeat(200)}.com`)).contact_email).toBeTruthy();
    expect(parseEmail(`${"a".repeat(64)}@example.com`)).toBe(`${"a".repeat(64)}@example.com`);
  });
});

/* ------------------------------------------------------------------ *
 * Workflow settings                                                   *
 * ------------------------------------------------------------------ */

describe("visibility", () => {
  for (const spec of CATEGORY_LIST) {
    for (const visibility of ["public", "unlisted", "private"] as const) {
      const allowed = spec.allowedVisibility.includes(visibility);
      // program_record may be public only with consent, which is covered separately
      if (spec.key === "program_record" && visibility === "public") continue;
      it(`${spec.key}: ${visibility} is ${allowed ? "allowed" : "refused"}`, () => {
        const result = run(spec.key, { visibility });
        if (allowed) expect(valueOf(result).visibility).toBe(visibility);
        else expect(errorsOf(result).visibility).toMatch(/cannot be/);
      });
    }
  }

  it.each(["", "secret", "PUBLIC", null, 5, {}])("rejects %j", (value) => {
    expect(errorsOf(run("certification", { visibility: value })).visibility).toMatch(/Public, Unlisted or Private/);
  });

  it("accepts surrounding whitespace", () => {
    expect(valueOf(run("certification", { visibility: " unlisted " })).visibility).toBe("unlisted");
  });

  it("experience letters can never be public", () => {
    expect(run("experience_letter", { visibility: "public" }).ok).toBe(false);
  });
});

describe("consent for personal records", () => {
  const consent = { consent_to_publish: true };

  it("a person may not be public without consent", () => {
    expect(errorsOf(run("program_record", { visibility: "public" })).visibility).toMatch(/consent/i);
    expect(errorsOf(run("program_record", { visibility: "public" }, { consent_to_publish: false })).visibility).toMatch(/consent/i);
  });

  it("consent unlocks public listing", () => {
    expect(valueOf(run("program_record", { visibility: "public" }, consent)).visibility).toBe("public");
    expect(valueOf(run("program_record", { visibility: "public" }, { consent_to_publish: "true" })).visibility).toBe("public");
  });

  it("without consent a person may still be unlisted or private", () => {
    expect(run("program_record", { visibility: "unlisted" }).ok).toBe(true);
    expect(run("program_record", { visibility: "private" }).ok).toBe(true);
  });

  it("an existing public record cannot silently lose its consent", () => {
    const existing = makeRecord("program_record", { visibility: "public", data: { ...makeRecord("program_record").data, consent_to_publish: true } });
    expect(errorsOf(run("program_record", {}, { consent_to_publish: false }, existing)).visibility).toMatch(/consent/i);
  });

  it("organisation categories need no consent", () => {
    expect(run("certification", { visibility: "public" }).ok).toBe(true);
    expect(run("company_identity", { visibility: "public" }).ok).toBe(true);
  });
});

describe("status", () => {
  it.each(["draft", "published", "archived"] as const)("accepts %s", (status) => {
    expect(valueOf(run("certification", { status })).status).toBe(status);
  });
  it.each(["", "live", "DRAFT", null, 1])("rejects %j", (status) => {
    expect(errorsOf(run("certification", { status })).status).toMatch(/Draft, Published or Archived/);
  });
});

describe("flags and sort order", () => {
  it("parses allowDownload, featured and enableVerification", () => {
    const value = valueOf(run("certification", { allowDownload: "yes", featured: true, enableVerification: "off" }));
    expect(value).toMatchObject({ allowDownload: true, featured: true, enableVerification: false });
  });

  it("rejects garbage flags by name", () => {
    const errors = errorsOf(run("certification", { allowDownload: "maybe", featured: {}, enableVerification: 7 }));
    expect(Object.keys(errors).sort()).toEqual(["allowDownload", "enableVerification", "featured"]);
  });

  it.each([
    [0, 0], [5, 5], [-5, -5], [9999, 9999], [-9999, -9999], [10_000, 9999], [-10_000, -9999], [1e12, 9999], ["42", 42], ["-7", -7], [" 12 ", 12],
  ])("sortOrder %j becomes %i (clamped)", (input, expected) => {
    expect(valueOf(run("certification", { sortOrder: input })).sortOrder).toBe(expected);
  });

  it.each([3.5, "3.5", "abc", "1e3", NaN, Infinity, {}, [], true])("rejects sortOrder %j", (input) => {
    expect(errorsOf(run("certification", { sortOrder: input })).sortOrder).toMatch(/whole number/);
  });

  it("treats a blank sortOrder as zero", () => {
    expect(valueOf(run("certification", { sortOrder: "" })).sortOrder).toBe(0);
    expect(valueOf(run("certification", { sortOrder: null })).sortOrder).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * Shape of the request                                                *
 * ------------------------------------------------------------------ */

describe("the request body", () => {
  it.each([null, undefined, "string", 42, true, [], [{}]])("rejects a non-object body: %j", (body) => {
    const result = validateDocumentInput(body, { category: "certification" });
    expect(errorsOf(result).form).toBeTruthy();
  });

  it("rejects an unknown category", () => {
    const result = validateDocumentInput(VALID.certification, { category: "nope" as DocumentCategory });
    expect(errorsOf(result).category).toBeTruthy();
  });

  it("rejects a body that names a different category", () => {
    expect(errorsOf(run("certification", { category: "financial_report" })).category).toBeTruthy();
    expect(run("certification", { category: "certification" }).ok).toBe(true);
  });

  it("rejects data that is not an object", () => {
    for (const data of ["x", 5, [], true]) {
      const result = validateDocumentInput({ ...VALID.certification, data }, { category: "certification" });
      expect(errorsOf(result).data).toBeTruthy();
    }
  });

  it("drops unknown keys, top-level and in data", () => {
    const value = valueOf(
      validateDocumentInput(
        { ...VALID.certification, id: "hijack", createdAt: "2000-01-01", verificationCode: "ACV-AAAA-AAAA-AAAA", verifyCount: 99, data: { ...(VALID.certification.data as object), rogue: "x", "<script>": "y" } },
        { category: "certification" },
      ),
    );
    expect(Object.keys(value).sort()).toEqual(
      ["allowDownload", "allowView", "category", "data", "enableVerification", "expiresOn", "featured", "holderName", "issuedOn", "referenceNo", "sortOrder", "status", "summary", "title", "visibility"].sort(),
    );
    expect(value.data).not.toHaveProperty("rogue");
    expect(value.data).not.toHaveProperty("<script>");
  });

  it("only ever outputs keys declared in the spec", () => {
    for (const spec of CATEGORY_LIST) {
      const everything: Record<string, unknown> = {};
      for (const field of spec.fields) everything[field.key] = "x";
      const result = run(spec.key, {}, everything);
      const declared = new Set(spec.fields.map((field) => field.key));
      const keys = result.ok ? Object.keys(result.value.data) : [];
      for (const key of keys) expect(declared.has(key)).toBe(true);
    }
  });

  it("is not polluted by __proto__ or constructor keys", () => {
    const hostile = JSON.parse('{"title":"T","holderName":"H","referenceNo":"R","issuedOn":"2026-01-01","__proto__":{"polluted":true},"data":{"direction":"held","issuing_body":"BSI","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}}');
    const value = valueOf(validateDocumentInput(hostile, { category: "certification" }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value.data, "__proto__")).toBe(false);
    expect(value.data).not.toHaveProperty("constructor.prototype.polluted");
  });

  it("rejects a class instance masquerading as the body", () => {
    class Evil {
      title = "x";
    }
    expect(errorsOf(validateDocumentInput(new Evil(), { category: "certification" })).form).toBeTruthy();
  });

  it("reports every problem at once, keyed by field", () => {
    const errors = errorsOf(
      validateDocumentInput(
        { title: "", holderName: "", referenceNo: "", issuedOn: "bad", visibility: "nope", status: "x", data: { direction: "x", skills: Array.from({ length: 20 }, (_, i) => `tag${i}`).join(",") } },
        { category: "certification" },
      ),
    );
    for (const key of ["title", "holderName", "referenceNo", "issuedOn", "visibility", "status", "direction", "issuing_body", "skills"]) {
      expect(errors, key).toHaveProperty(key);
    }
  });

  it("returns display-safe messages that never echo the input", () => {
    const secret = "TOPSECRET-VALUE-12345";
    const errors = errorsOf(run("certification", { issuedOn: secret, visibility: secret, status: secret }, { direction: secret, credential_url: secret }));
    expect(JSON.stringify(errors)).not.toContain(secret);
  });
});

/* ------------------------------------------------------------------ *
 * Updates                                                             *
 * ------------------------------------------------------------------ */

describe("validateDocumentInput with an existing record", () => {
  const existing = makeRecord("certification", {
    status: "published",
    visibility: "unlisted",
    allowDownload: true,
    featured: true,
    sortOrder: 7,
    verificationCode: "ACV-7K3M-9QXD-4TRH",
  });

  it("keeps workflow settings the form did not send", () => {
    const value = valueOf(run("certification", {}, {}, existing));
    expect(value).toMatchObject({ status: "published", visibility: "unlisted", allowDownload: true, featured: true, sortOrder: 7, enableVerification: true });
  });

  it("lets the form change them explicitly", () => {
    const value = valueOf(run("certification", { status: "archived", visibility: "private", allowDownload: false, featured: false, sortOrder: 1 }, {}, existing));
    expect(value).toMatchObject({ status: "archived", visibility: "private", allowDownload: false, featured: false, sortOrder: 1 });
  });

  it("enableVerification defaults to whether a code exists", () => {
    expect(valueOf(run("certification", {}, {}, makeRecord("certification"))).enableVerification).toBe(false);
    expect(valueOf(run("certification", {}, {}, existing)).enableVerification).toBe(true);
  });

  it("content is replaced, not merged: omitting it means empty", () => {
    const result = validateDocumentInput({ status: "draft" }, { category: "certification", existing });
    const errors = errorsOf(result);
    expect(errors.title).toMatch(/required/i);
    expect(errors.issuing_body).toMatch(/required/i);
  });

  it("refuses to move a record to another category", () => {
    const result = validateDocumentInput(payload("company_identity"), { category: "company_identity", existing });
    expect(errorsOf(result).category).toMatch(/cannot be changed/);
  });

  it("falls back to the category default for an existing record whose visibility is no longer allowed", () => {
    const stale = makeRecord("experience_letter", { visibility: "public" });
    expect(errorsOf(run("experience_letter", {}, {}, stale)).visibility).toMatch(/cannot be public/);
  });
});

/* ------------------------------------------------------------------ *
 * validatePublishable                                                 *
 * ------------------------------------------------------------------ */

describe("validatePublishable", () => {
  const publishable = (category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord => {
    const spec = CATEGORIES[category];
    const files: DocumentFileMeta[] = [];
    if (spec.fileRequired) files.push(file("primary"));
    if (spec.photoRequired) files.push(file("photo"));
    return makeRecord(category, { files, ...overrides });
  };

  it.each(CATEGORY_LIST.map((spec) => [spec.key]))("%s: a complete record passes", (key) => {
    expect(validatePublishable(publishable(key))).toEqual({ ok: true });
  });

  for (const spec of CATEGORY_LIST) {
    if (spec.fileRequired) {
      it(`${spec.key}: needs its document file`, () => {
        const result = validatePublishable(publishable(spec.key, { files: [] }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.file).toMatch(/Upload/);
      });
      it(`${spec.key}: a photo does not stand in for the document file`, () => {
        const result = validatePublishable(publishable(spec.key, { files: spec.hasPhoto ? [file("photo")] : [] }));
        if (!result.ok) expect(result.errors.file).toBeTruthy();
        expect(result.ok).toBe(false);
      });
    } else {
      it(`${spec.key}: does not need a document file`, () => {
        expect(validatePublishable(publishable(spec.key, { files: spec.photoRequired ? [file("photo")] : [] })).ok).toBe(true);
      });
    }
    if (spec.photoRequired) {
      it(`${spec.key}: needs a photo`, () => {
        const result = validatePublishable(publishable(spec.key, { files: [] }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.photo).toMatch(/photo/i);
      });
    }
  }

  for (const spec of CATEGORY_LIST) {
    for (const key of ["title", "summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
      const base = spec.base[key];
      if (base.hidden || !base.required) continue;
      it(`${spec.key}: ${key} must be present`, () => {
        const empty = key === "issuedOn" || key === "expiresOn" ? null : "";
        const result = validatePublishable(publishable(spec.key, { [key]: empty }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors[key]).toMatch(/required/i);
      });
    }
    for (const field of spec.fields) {
      if (!field.required || field.showWhen) continue;
      it(`${spec.key}: ${field.key} must be present (the spec may have tightened since saving)`, () => {
        const record = publishable(spec.key);
        const data = { ...record.data };
        delete data[field.key];
        const result = validatePublishable({ ...record, data });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors[field.key]).toMatch(/required/i);
      });
    }
  }

  it("a conditionally required field is checked only while it applies", () => {
    const base = publishable("experience_letter");
    const ended = validatePublishable({ ...base, data: { ...base.data, currently_employed: false } });
    expect(ended.ok).toBe(false);
    if (!ended.ok) expect(ended.errors.end_date).toMatch(/required/i);
    expect(validatePublishable({ ...base, data: { ...base.data, currently_employed: true } }).ok).toBe(true);
  });

  it("consent: a public person needs it", () => {
    const record = publishable("program_record", { visibility: "public" });
    const result = validatePublishable(record);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.visibility).toMatch(/consent/i);
    expect(validatePublishable({ ...record, data: { ...record.data, consent_to_publish: true } }).ok).toBe(true);
    expect(validatePublishable({ ...record, data: { ...record.data, consent_to_publish: "true" } }).ok).toBe(false);
  });

  it("consent is not needed for an unlisted or private person", () => {
    expect(validatePublishable(publishable("program_record", { visibility: "unlisted" })).ok).toBe(true);
    expect(validatePublishable(publishable("program_record", { visibility: "private" })).ok).toBe(true);
  });

  it("visibility must be one the category allows", () => {
    const result = validatePublishable(publishable("experience_letter", { visibility: "public" }));
    expect(result.ok).toBe(false);
  });

  it("expiry may not precede issue", () => {
    const result = validatePublishable(publishable("certification", { issuedOn: "2026-05-05", expiresOn: "2026-05-04" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.expiresOn).toBeTruthy();
  });

  it("reports every problem at once", () => {
    // No shipped category requires a photo, so the requirement is switched on for one category here.
    const undo = requirePhoto("program_record");
    try {
      const result = validatePublishable(publishable("program_record", { files: [], title: "", holderName: "" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["holderName", "photo", "title"]);
    } finally {
      undo();
    }
  });

  it("asks for a photo only where the category requires one", () => {
    expect(CATEGORIES.program_record.photoRequired).toBe(false);
    expect(validatePublishable(publishable("program_record", { files: [] })).ok).toBe(true);
    const undo = requirePhoto("program_record");
    try {
      const result = validatePublishable(publishable("program_record", { files: [] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.photo).toMatch(/photo/i);
    } finally {
      undo();
    }
  });
});

describe("helpers", () => {
  it("parseHttpUrl returns the canonical href", () => {
    expect(parseHttpUrl("https://EXAMPLE.com")).toBe("https://example.com/");
  });
  it("parseEmail lower-cases only the domain", () => {
    expect(parseEmail("Ab@Example.COM")).toBe("Ab@example.com");
    expect(parseEmail("nope")).toBeNull();
  });
});

describe("FieldValue typing sanity", () => {
  it("every output value is a valid FieldValue", () => {
    const isFieldValue = (value: unknown): value is FieldValue =>
      value === null || ["string", "number", "boolean"].includes(typeof value) || (Array.isArray(value) && value.every((v) => typeof v === "string"));
    for (const spec of CATEGORY_LIST) {
      const everything: Record<string, unknown> = {};
      for (const field of spec.fields) {
        if (field.type === "select") everything[field.key] = field.options?.[0]?.value;
        else if (field.type === "date") everything[field.key] = "2026-02-02";
        else if (field.type === "boolean") everything[field.key] = true;
        else if (field.type === "tags") everything[field.key] = "a,b";
        else if (field.type === "url") everything[field.key] = "https://example.com";
        else if (field.type === "email") everything[field.key] = "a@example.com";
        else everything[field.key] = "text";
      }
      const result = run(spec.key, { visibility: "unlisted" }, everything);
      if (!result.ok) throw new Error(`${spec.key}: ${JSON.stringify(result.errors)}`);
      for (const value of Object.values(result.value.data)) expect(isFieldValue(value)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * Team profiles: the hierarchy fields                                  *
 * ------------------------------------------------------------------ */

describe("team profiles: hierarchy_level, role_title, program_name, reports_to", () => {
  const without = (key: string): Record<string, unknown> => ({ [key]: undefined });

  it("a complete profile with every level is accepted, and the level is stored", () => {
    for (const level of HIERARCHY_LEVELS) {
      expect(valueOf(run("program_record", {}, { hierarchy_level: level })).data.hierarchy_level).toBe(level);
    }
  });

  it("requires a level on a new profile", () => {
    expect(errorsOf(run("program_record", {}, without("hierarchy_level"))).hierarchy_level).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, { hierarchy_level: "" })).hierarchy_level).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, { hierarchy_level: "   " })).hierarchy_level).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, { hierarchy_level: null })).hierarchy_level).toMatch(/required/i);
  });

  it("rejects a level that is not on the list, however it is spelled", () => {
    for (const bad of ["wizard", "Leadership", "TEAM_LEAD", "team lead", "member ", 3, true, ["member"]]) {
      const result = run("program_record", {}, { hierarchy_level: bad });
      // " member " style padding is cleaned; anything else that is not exactly a level is an error
      if (bad === "member ") expect(result.ok).toBe(true);
      else expect(errorsOf(result).hierarchy_level, String(bad)).toBeTruthy();
    }
  });

  it("requires a role / job title, and shows its label in the message", () => {
    expect(errorsOf(run("program_record", {}, without("role_title"))).role_title).toBe("Role / job title is required.");
    expect(errorsOf(run("program_record", {}, { role_title: "  " })).role_title).toMatch(/required/i);
  });

  it("does not require a program any more", () => {
    const result = run("program_record", {}, without("program_name"));
    expect(result.ok).toBe(true);
    expect(valueOf(result).data.program_name).toBeUndefined();
    expect(valueOf(run("program_record", {}, { program_name: "Summer 2026" })).data.program_name).toBe("Summer 2026");
  });

  it("keeps the reporting line optional, trimmed and capped at 120 characters", () => {
    expect(valueOf(run("program_record", {}, without("reports_to"))).data.reports_to).toBeUndefined();
    expect(valueOf(run("program_record", {}, { reports_to: "  Hira   Malik " })).data.reports_to).toBe("Hira Malik");
    expect(run("program_record", {}, { reports_to: "x".repeat(120) }).ok).toBe(true);
    expect(errorsOf(run("program_record", {}, { reports_to: "x".repeat(121) })).reports_to).toMatch(/at most 120/);
  });

  it("still validates every other team field exactly as before", () => {
    expect(errorsOf(run("program_record", {}, without("record_kind"))).record_kind).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, without("start_date"))).start_date).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, without("record_status"))).record_status).toMatch(/required/i);
    expect(errorsOf(run("program_record", {}, { linkedin_url: "javascript:alert(1)" })).linkedin_url).toBeTruthy();
    expect(errorsOf(run("program_record", { visibility: "public" })).visibility).toMatch(/consent/i);
  });

  it("asks for a level again when an existing profile saved before levels is edited", () => {
    const legacyData = { ...makeRecord("program_record").data };
    delete legacyData.hierarchy_level;
    delete legacyData.role_title;
    const legacy = makeRecord("program_record", { data: legacyData });
    // the editor sends the whole form: without a level, the save is refused and names the field
    const errors = errorsOf(validateDocumentInput({ ...payload("program_record", {}, without("hierarchy_level")) }, { category: "program_record", existing: legacy }));
    expect(errors.hierarchy_level).toMatch(/required/i);
    // once the level and title are chosen, the same record saves
    expect(run("program_record", {}, { hierarchy_level: "member", role_title: "Engineer" }, legacy).ok).toBe(true);
  });

  it("flags a legacy profile at publish time, naming the missing fields, instead of crashing", () => {
    const legacyData = { ...makeRecord("program_record").data };
    delete legacyData.hierarchy_level;
    delete legacyData.role_title;
    const result = validatePublishable(makeRecord("program_record", { data: legacyData }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.hierarchy_level).toMatch(/required/i);
      expect(result.errors.role_title).toMatch(/required/i);
    }
  });
});

/* ------------------------------------------------------------------ *
 * View and download                                                    *
 * ------------------------------------------------------------------ */

describe("allowView and allowDownload", () => {
  it("download switches view on, since a file that can be saved can be opened", () => {
    const value = valueOf(run("certification", { allowDownload: true, allowView: false }));
    expect(value).toMatchObject({ allowDownload: true, allowView: true });
  });

  it("view alone is view-only", () => {
    expect(valueOf(run("certification", { allowView: true, allowDownload: false }))).toMatchObject({ allowView: true, allowDownload: false });
  });

  it("neither means the file is not public", () => {
    expect(valueOf(run("certification", { allowView: false, allowDownload: false }))).toMatchObject({ allowView: false, allowDownload: false });
  });

  it("accepts the usual yes/no spellings", () => {
    expect(valueOf(run("certification", { allowView: "yes", allowDownload: "no" }))).toMatchObject({ allowView: true, allowDownload: false });
  });

  it("rejects something that is not yes or no", () => {
    expect(errorsOf(run("certification", { allowView: "maybe" })).allowView).toMatch(/yes or no/i);
  });

  it("keeps an existing record's settings when the request leaves them out", () => {
    const existing = makeRecord("certification", { allowView: true, allowDownload: false });
    const body = { ...payload("certification") };
    delete body.allowView;
    delete body.allowDownload;
    const value = valueOf(validateDocumentInput(body, { category: "certification", existing }));
    expect(value).toMatchObject({ allowView: true, allowDownload: false });
  });

  it("stores a record saved before view-only existed (download on, view off) with view on from its next save", () => {
    const legacy = makeRecord("certification", { allowView: false, allowDownload: true });
    const body = { ...payload("certification") };
    delete body.allowView;
    delete body.allowDownload;
    expect(valueOf(validateDocumentInput(body, { category: "certification", existing: legacy }))).toMatchObject({ allowView: true, allowDownload: true });
  });

  it("turning download off on a legacy record leaves it view-only only if view was asked for", () => {
    const legacy = makeRecord("certification", { allowView: false, allowDownload: true });
    expect(valueOf(run("certification", { allowDownload: false }, {}, legacy))).toMatchObject({ allowView: false, allowDownload: false });
    expect(valueOf(run("certification", { allowDownload: false, allowView: true }, {}, legacy))).toMatchObject({ allowView: true, allowDownload: false });
  });
});
