import { describe, expect, it } from "vitest";
import { CATEGORIES, CATEGORY_LIST, publicFieldKeys } from "@/lib/documents/categories";
import { computeVerificationState, toPublicDocument, type PublicContext } from "@/lib/documents/public";
import type {
  CategorySpec,
  DocumentCategory,
  DocumentFileMeta,
  DocumentRecord,
  FieldSpec,
  FieldValue,
} from "@/lib/documents/types";
import { visibleFieldKeys } from "@/lib/documents/validate";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const CONTEXTS: PublicContext[] = ["listing", "verify"];

function fileMeta(role: "primary" | "photo", overrides: Partial<DocumentFileMeta> = {}): DocumentFileMeta {
  return {
    id: `file-${role}`,
    documentId: "doc-1",
    role,
    filename: role === "photo" ? "portrait.jpg" : "letter.pdf",
    mimeType: role === "photo" ? "image/jpeg" : "application/pdf",
    sizeBytes: 1234,
    sha256: "ab".repeat(32),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function sampleValue(field: FieldSpec): FieldValue {
  switch (field.type) {
    case "select":
      return field.options?.[0]?.value ?? "x";
    case "date":
      return "2026-01-02";
    case "number":
      return 5;
    case "boolean":
      return true;
    case "tags":
      return [`tag-${field.key}`];
    case "url":
      return `https://example.com/${field.key}`;
    case "email":
      return `${field.key}@example.com`;
    default:
      return `value-${field.key}`;
  }
}

/** A published public record with EVERY declared field filled in, so leaks have something to leak. */
function fullData(spec: CategorySpec): Record<string, FieldValue> {
  const data: Record<string, FieldValue> = {};
  for (const field of spec.fields) data[field.key] = sampleValue(field);
  if (spec.personal) data.consent_to_publish = true;
  return data;
}

function makeRecord(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  const spec = CATEGORIES[category];
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category,
    title: `Title for ${category}`,
    summary: "A public summary",
    status: "published",
    visibility: "public",
    allowDownload: true,
    allowView: false,
    featured: true,
    sortOrder: 3,
    holderName: "Aisha Khan",
    referenceNo: "REF-001",
    issuedOn: "2026-01-01",
    expiresOn: "2027-01-01",
    verificationCode: "ACV-7K3M-9QXD-4TRH",
    revokedAt: null,
    revokedReason: "",
    data: fullData(spec),
    files: [fileMeta("primary"), fileMeta("photo")],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    publishedAt: "2026-01-05T00:00:00.000Z",
    verifyCount: 9,
    lastVerifiedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeVerificationState", () => {
  const cases: Array<[string, { revokedAt: string | null; expiresOn: string | null }, Date, string]> = [
    ["no expiry", { revokedAt: null, expiresOn: null }, NOW, "valid"],
    ["expires far in the future", { revokedAt: null, expiresOn: "2030-01-01" }, NOW, "valid"],
    ["expires tomorrow", { revokedAt: null, expiresOn: "2026-06-16" }, NOW, "valid"],
    ["expires today (valid through the day)", { revokedAt: null, expiresOn: "2026-06-15" }, NOW, "valid"],
    ["expired yesterday", { revokedAt: null, expiresOn: "2026-06-14" }, NOW, "expired"],
    ["expired long ago", { revokedAt: null, expiresOn: "2020-01-01" }, NOW, "expired"],
    ["revoked, no expiry", { revokedAt: "2026-02-01T00:00:00.000Z", expiresOn: null }, NOW, "revoked"],
    ["revoked beats expired", { revokedAt: "2026-02-01T00:00:00.000Z", expiresOn: "2020-01-01" }, NOW, "revoked"],
    ["revoked beats valid", { revokedAt: "2026-02-01T00:00:00.000Z", expiresOn: "2030-01-01" }, NOW, "revoked"],
    ["last second of the expiry day (UTC)", { revokedAt: null, expiresOn: "2026-06-15" }, new Date("2026-06-15T23:59:59.999Z"), "valid"],
    ["first instant after the expiry day (UTC)", { revokedAt: null, expiresOn: "2026-06-15" }, new Date("2026-06-16T00:00:00.000Z"), "expired"],
  ];
  it.each(cases)("%s", (_label, record, now, expected) => {
    expect(computeVerificationState(record, now)).toBe(expected);
  });

  it("defaults to the current time", () => {
    expect(computeVerificationState({ revokedAt: null, expiresOn: "2000-01-01" })).toBe("expired");
    expect(computeVerificationState({ revokedAt: null, expiresOn: "2999-01-01" })).toBe("valid");
  });
});

describe("toPublicDocument: what may be seen at all", () => {
  for (const spec of CATEGORY_LIST) {
    describe(spec.key, () => {
      for (const context of CONTEXTS) {
        it(`hides drafts in ${context}`, () => {
          expect(toPublicDocument(makeRecord(spec.key, { status: "draft" }), context, NOW)).toBeNull();
        });
        it(`hides archived records in ${context}`, () => {
          expect(toPublicDocument(makeRecord(spec.key, { status: "archived" }), context, NOW)).toBeNull();
        });
        it(`hides private records in ${context}`, () => {
          expect(toPublicDocument(makeRecord(spec.key, { visibility: "private" }), context, NOW)).toBeNull();
        });
      }

      it("hides unlisted records from the listing", () => {
        expect(toPublicDocument(makeRecord(spec.key, { visibility: "unlisted" }), "listing", NOW)).toBeNull();
      });

      it("shows unlisted records to a code lookup", () => {
        const result = toPublicDocument(makeRecord(spec.key, { visibility: "unlisted" }), "verify", NOW);
        expect(result).not.toBeNull();
        expect(result?.state).toBe("valid");
      });

      it("shows public records in both contexts", () => {
        for (const context of CONTEXTS) expect(toPublicDocument(makeRecord(spec.key), context, NOW)).not.toBeNull();
      });

      it("never lists a revoked record, but a lookup reports it as revoked", () => {
        const revoked = makeRecord(spec.key, { revokedAt: "2026-05-01T00:00:00.000Z", revokedReason: "Issued in error" });
        expect(toPublicDocument(revoked, "listing", NOW)).toBeNull();
        expect(toPublicDocument(revoked, "verify", NOW)?.state).toBe("revoked");
      });

      it("hides a revoked draft or private record like any other", () => {
        const base = { revokedAt: "2026-05-01T00:00:00.000Z" };
        expect(toPublicDocument(makeRecord(spec.key, { ...base, status: "draft" }), "verify", NOW)).toBeNull();
        expect(toPublicDocument(makeRecord(spec.key, { ...base, visibility: "private" }), "verify", NOW)).toBeNull();
      });
    });
  }
});

describe("toPublicDocument: the privacy boundary", () => {
  for (const spec of CATEGORY_LIST) {
    for (const context of CONTEXTS) {
      describe(`${spec.key} / ${context}`, () => {
        const record = makeRecord(spec.key);
        const result = toPublicDocument(record, context, NOW);

        it("exposes only fields flagged public in the spec", () => {
          expect(result).not.toBeNull();
          const allowed = new Set(publicFieldKeys(spec.key));
          for (const key of Object.keys(result?.fields ?? {})) expect(allowed.has(key), `${key} must be public`).toBe(true);
        });

        it("exposes only fields that are currently visible", () => {
          const visible = visibleFieldKeys(spec.key, record.data);
          for (const key of Object.keys(result?.fields ?? {})) expect(visible.has(key), `${key} must be visible`).toBe(true);
        });

        it("contains no value of any private field anywhere in the payload", () => {
          const payload = JSON.stringify(result);
          for (const field of spec.fields.filter((f) => !f.public)) {
            const secret = sampleValue(field);
            if (typeof secret === "string") expect(payload, `${field.key} leaked`).not.toContain(secret);
            expect(payload).not.toContain(`"${field.key}"`);
          }
        });

        it("includes every public, visible, non-empty field", () => {
          const visible = visibleFieldKeys(spec.key, record.data);
          const expected = spec.fields.filter((f) => f.public && visible.has(f.key)).map((f) => f.key);
          expect(Object.keys(result?.fields ?? {}).sort()).toEqual(expected.sort());
        });
      });
    }
  }

  it("never copies admin-only members of the record", () => {
    const result = toPublicDocument(makeRecord("certification"), "verify", NOW);
    const keys = Object.keys(result ?? {});
    for (const forbidden of ["data", "files", "status", "visibility", "revokedReason", "createdAt", "updatedAt", "verifyCount", "lastVerifiedAt", "sortOrder"]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it("does not leak the specific private fields of the personal categories", () => {
    const secrets: Record<string, FieldValue> = {
      internal_notes: "SECRET-NOTE",
      contact_email: "private@example.com",
      responsibilities: "SECRET-DUTIES",
      remarks: "SECRET-REMARK",
      consent_to_publish: true,
      show_photo: true,
    };
    for (const category of ["program_record", "experience_letter"] as const) {
      const record = makeRecord(category, { data: { ...fullData(CATEGORIES[category]), ...secrets } });
      for (const context of CONTEXTS) {
        const result = toPublicDocument(record, context, NOW);
        if (!result) continue;
        const payload = JSON.stringify(result);
        expect(payload).not.toMatch(/SECRET|private@example/);
        for (const key of ["internal_notes", "contact_email", "responsibilities", "remarks", "consent_to_publish", "show_photo"]) {
          expect(result.fields).not.toHaveProperty(key);
        }
      }
    }
  });

  it("drops data keys the spec does not declare", () => {
    const record = makeRecord("certification", { data: { ...fullData(CATEGORIES.certification), rogue: "should not appear", __proto__x: "no" } });
    const result = toPublicDocument(record, "verify", NOW);
    expect(result?.fields).not.toHaveProperty("rogue");
    expect(JSON.stringify(result)).not.toContain("should not appear");
  });

  it("does not mutate the stored record", () => {
    const record = makeRecord("program_record", { visibility: "unlisted" });
    const snapshot = JSON.stringify(record);
    toPublicDocument(record, "verify", NOW);
    toPublicDocument(record, "listing", NOW);
    expect(JSON.stringify(record)).toBe(snapshot);
  });
});

describe("toPublicDocument: personal categories", () => {
  it("does not list a person without recorded consent", () => {
    const record = makeRecord("program_record", { data: { ...fullData(CATEGORIES.program_record), consent_to_publish: false } });
    expect(toPublicDocument(record, "listing", NOW)).toBeNull();
  });

  it("does not list a person when consent is missing, a string, or a number", () => {
    for (const consent of [undefined, "true", 1, null, "yes"]) {
      const data = { ...fullData(CATEGORIES.program_record) } as Record<string, FieldValue>;
      if (consent === undefined) delete data.consent_to_publish;
      else data.consent_to_publish = consent as FieldValue;
      expect(toPublicDocument(makeRecord("program_record", { data }), "listing", NOW)).toBeNull();
    }
  });

  it("lists a person once consent is recorded, with their name", () => {
    const result = toPublicDocument(makeRecord("program_record"), "listing", NOW);
    expect(result?.holderName).toBe("Aisha Khan");
  });

  it("still resolves an unlisted person by code (that is what a QR is for)", () => {
    const record = makeRecord("program_record", {
      visibility: "unlisted",
      data: { ...fullData(CATEGORIES.program_record), consent_to_publish: false },
    });
    const result = toPublicDocument(record, "verify", NOW);
    expect(result?.state).toBe("valid");
    expect(result?.holderName).toBe("Aisha Khan");
  });

  it("an experience letter shows name, role and status but not the letter text", () => {
    const record = makeRecord("experience_letter", {
      visibility: "unlisted",
      data: {
        designation: "Software Engineer",
        employment_type: "full_time",
        start_date: "2024-01-01",
        currently_employed: false,
        end_date: "2025-12-31",
        signatory_name: "Head of People",
        responsibilities: "Built the secret billing system",
        remarks: "Confidential remark",
      },
    });
    const result = toPublicDocument(record, "verify", NOW);
    expect(result?.fields).toMatchObject({ designation: "Software Engineer", end_date: "2025-12-31" });
    expect(JSON.stringify(result)).not.toMatch(/secret billing|Confidential/);
  });
});

describe("toPublicDocument: revoked records collapse", () => {
  it("keeps only title, reference, category and the revocation date", () => {
    const revoked = makeRecord("program_record", {
      visibility: "unlisted",
      revokedAt: "2026-05-01T08:00:00.000Z",
      revokedReason: "Intern left the program early",
      holderName: "Sara Malik",
      summary: "should vanish",
    });
    expect(toPublicDocument(revoked, "verify", NOW)).toEqual({
      id: revoked.id,
      category: "program_record",
      title: revoked.title,
      summary: "",
      holderName: "",
      referenceNo: "REF-001",
      issuedOn: null,
      expiresOn: null,
      state: "revoked",
      verificationCode: null,
      allowDownload: false,
      hasFile: false,
      canDownload: false,
      hasPhoto: false,
      file: null,
      featured: false,
      publishedAt: null,
      revokedAt: "2026-05-01T08:00:00.000Z",
      fields: {},
    });
  });

  it("does not reveal the holder, reason, photo, file or any field", () => {
    for (const spec of CATEGORY_LIST) {
      const revoked = makeRecord(spec.key, { visibility: "unlisted", revokedAt: "2026-05-01T08:00:00.000Z", revokedReason: "SECRET-REASON" });
      const payload = JSON.stringify(toPublicDocument(revoked, "verify", NOW));
      expect(payload).not.toContain("Aisha Khan");
      expect(payload).not.toContain("SECRET-REASON");
      expect(payload).not.toContain("letter.pdf");
      expect(payload).not.toContain("portrait.jpg");
      expect(payload).not.toContain("value-");
      expect(payload).not.toContain(revoked.verificationCode ?? "no-code");
    }
  });

  it("revoked wins over expired", () => {
    const revoked = makeRecord("certification", { revokedAt: "2026-05-01T08:00:00.000Z", expiresOn: "2020-01-01", visibility: "unlisted" });
    expect(toPublicDocument(revoked, "verify", NOW)?.state).toBe("revoked");
  });
});

describe("toPublicDocument: validity", () => {
  it("reports expired records as expired but still shows their details", () => {
    const record = makeRecord("certification", { expiresOn: "2026-06-14" });
    const result = toPublicDocument(record, "verify", NOW);
    expect(result?.state).toBe("expired");
    expect(result?.title).toBe(record.title);
    expect(result?.holderName).toBe("Aisha Khan");
    expect(Object.keys(result?.fields ?? {}).length).toBeGreaterThan(0);
  });

  it("keeps an expired public record in the listing, flagged expired", () => {
    expect(toPublicDocument(makeRecord("certification", { expiresOn: "2026-06-14" }), "listing", NOW)?.state).toBe("expired");
  });

  it("is valid through the whole expiry day", () => {
    expect(toPublicDocument(makeRecord("certification", { expiresOn: "2026-06-15" }), "verify", NOW)?.state).toBe("valid");
  });
});

describe("toPublicDocument: photo", () => {
  const withPhoto = (data: Record<string, FieldValue>, files = [fileMeta("primary"), fileMeta("photo")]) =>
    toPublicDocument(makeRecord("program_record", { visibility: "unlisted", data: { ...fullData(CATEGORIES.program_record), ...data }, files }), "verify", NOW);

  it("is available only with a photo file AND show_photo", () => {
    expect(withPhoto({ show_photo: true })?.hasPhoto).toBe(true);
  });
  it("is hidden when show_photo is off", () => {
    expect(withPhoto({ show_photo: false })?.hasPhoto).toBe(false);
  });
  it("is hidden when show_photo is not a real boolean true", () => {
    expect(withPhoto({ show_photo: "true" })?.hasPhoto).toBe(false);
    expect(withPhoto({ show_photo: 1 })?.hasPhoto).toBe(false);
  });
  it("is hidden when no photo file exists", () => {
    expect(withPhoto({ show_photo: true }, [fileMeta("primary")])?.hasPhoto).toBe(false);
    expect(withPhoto({ show_photo: true }, [])?.hasPhoto).toBe(false);
  });
  it("is never offered for a category without photos", () => {
    const record = makeRecord("certification", { data: { ...fullData(CATEGORIES.certification), show_photo: true } });
    expect(toPublicDocument(record, "verify", NOW)?.hasPhoto).toBe(false);
  });
  it("a primary file is not mistaken for a photo", () => {
    expect(withPhoto({ show_photo: true }, [fileMeta("primary")])?.hasPhoto).toBe(false);
  });
});

describe("toPublicDocument: file download", () => {
  it("exposes the file only when download is allowed", () => {
    const allowed = toPublicDocument(makeRecord("certification", { allowDownload: true }), "verify", NOW);
    expect(allowed?.hasFile).toBe(true);
    expect(allowed?.file).toEqual({ filename: "letter.pdf", mimeType: "application/pdf", sizeBytes: 1234, sha256: "ab".repeat(32) });

    const denied = toPublicDocument(makeRecord("certification", { allowDownload: false }), "verify", NOW);
    expect(denied?.hasFile).toBe(false);
    expect(denied?.file).toBeNull();
    expect(denied?.allowDownload).toBe(false);
    expect(JSON.stringify(denied)).not.toContain("letter.pdf");
  });

  it("has no file when none was uploaded, whatever allowDownload says", () => {
    const result = toPublicDocument(makeRecord("certification", { allowDownload: true, files: [] }), "verify", NOW);
    expect(result?.hasFile).toBe(false);
    expect(result?.file).toBeNull();
  });

  it("never describes the photo as the downloadable file", () => {
    const result = toPublicDocument(makeRecord("program_record", { visibility: "unlisted", allowDownload: true, files: [fileMeta("photo")] }), "verify", NOW);
    expect(result?.hasFile).toBe(false);
    expect(result?.file).toBeNull();
  });

  it("an expired record keeps its file", () => {
    const result = toPublicDocument(makeRecord("certification", { expiresOn: "2026-06-14" }), "verify", NOW);
    expect(result?.state).toBe("expired");
    expect(result?.hasFile).toBe(true);
  });
});

describe("toPublicDocument: conditional fields", () => {
  it("drops end_date while the person is currently employed", () => {
    const data = { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, end_date: "2025-01-01", signatory_name: "HR" };
    const result = toPublicDocument(makeRecord("experience_letter", { visibility: "unlisted", data }), "verify", NOW);
    expect(result?.fields).not.toHaveProperty("end_date");
    expect(result?.fields.currently_employed).toBe(true);
  });

  it("shows end_date once employment has ended", () => {
    const data = { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: false, end_date: "2025-01-01", signatory_name: "HR" };
    const result = toPublicDocument(makeRecord("experience_letter", { visibility: "unlisted", data }), "verify", NOW);
    expect(result?.fields.end_date).toBe("2025-01-01");
    expect(result?.fields.currently_employed).toBe(false);
  });

  it("treats an unanswered controlling boolean as its default", () => {
    // currently_employed defaults to false, so end_date is shown
    const data = { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", end_date: "2025-01-01", signatory_name: "HR" };
    const result = toPublicDocument(makeRecord("experience_letter", { visibility: "unlisted", data }), "verify", NOW);
    expect(result?.fields.end_date).toBe("2025-01-01");
  });

  it("hides the auditor of an unaudited report", () => {
    const base = { report_type: "annual_report", fiscal_year: "2025", period: "full_year", currency: "PKR", auditor: "Big Four LLP" };
    const unaudited = toPublicDocument(makeRecord("financial_report", { data: { ...base, audited: false } }), "listing", NOW);
    expect(unaudited?.fields).not.toHaveProperty("auditor");
    const audited = toPublicDocument(makeRecord("financial_report", { data: { ...base, audited: true } }), "listing", NOW);
    expect(audited?.fields.auditor).toBe("Big Four LLP");
  });
});

describe("toPublicDocument: values and base fields", () => {
  it("omits empty values", () => {
    const data = { designation: "", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "   ", department: "" };
    const result = toPublicDocument(makeRecord("experience_letter", { visibility: "unlisted", data }), "verify", NOW);
    expect(result?.fields).toEqual({ employment_type: "full_time", start_date: "2024-01-01", currently_employed: true });
  });

  it("omits empty tag lists and keeps populated ones", () => {
    const empty = toPublicDocument(makeRecord("certification", { data: { direction: "held", issuing_body: "BSI", skills: [] } }), "verify", NOW);
    expect(empty?.fields).not.toHaveProperty("skills");
    const some = toPublicDocument(makeRecord("certification", { data: { direction: "held", issuing_body: "BSI", skills: ["react", "node"] } }), "verify", NOW);
    expect(some?.fields.skills).toEqual(["react", "node"]);
  });

  it("keeps a boolean false (it is an answer, not an absence)", () => {
    const result = toPublicDocument(makeRecord("financial_report", { data: { report_type: "annual_report", audited: false } }), "listing", NOW);
    expect(result?.fields.audited).toBe(false);
  });

  const unsafeUrls = ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x", "ftp://example.com/x", "//evil.example", "not a url", "https://user:pass@example.com/"];
  it.each(unsafeUrls)("drops the unsafe URL %s even if it reached the database", (url) => {
    const result = toPublicDocument(makeRecord("certification", { data: { direction: "held", issuing_body: "BSI", credential_url: url } }), "verify", NOW);
    expect(result?.fields).not.toHaveProperty("credential_url");
  });

  it("keeps a safe URL", () => {
    const result = toPublicDocument(makeRecord("certification", { data: { direction: "held", issuing_body: "BSI", credential_url: "https://credly.com/badges/abc" } }), "verify", NOW);
    expect(result?.fields.credential_url).toBe("https://credly.com/badges/abc");
  });

  it("drops a value of the wrong type for its field", () => {
    const record = makeRecord("certification", {
      data: { direction: "held", issuing_body: 42 as unknown as FieldValue, skills: "react" as unknown as FieldValue, level: ["a"] as unknown as FieldValue },
    });
    const result = toPublicDocument(record, "verify", NOW);
    expect(result?.fields).toEqual({ direction: "held" });
  });

  it("blanks base fields a category hides, even if the row holds a value", () => {
    const record = makeRecord("financial_report", { holderName: "Leaked Person", expiresOn: "2030-01-01" });
    const result = toPublicDocument(record, "listing", NOW);
    expect(result?.holderName).toBe("");
    expect(result?.expiresOn).toBeNull();
    expect(result?.state).toBe("valid");

    const letter = makeRecord("experience_letter", { visibility: "unlisted", summary: "should not show" });
    expect(toPublicDocument(letter, "verify", NOW)?.summary).toBe("");
  });

  it("passes through the identifying basics", () => {
    const record = makeRecord("certification", { featured: true, publishedAt: "2026-01-05T00:00:00.000Z" });
    const result = toPublicDocument(record, "listing", NOW);
    expect(result).toMatchObject({
      id: record.id,
      category: "certification",
      title: record.title,
      summary: "A public summary",
      holderName: "Aisha Khan",
      referenceNo: "REF-001",
      issuedOn: "2026-01-01",
      expiresOn: "2027-01-01",
      verificationCode: "ACV-7K3M-9QXD-4TRH",
      featured: true,
      publishedAt: "2026-01-05T00:00:00.000Z",
      revokedAt: null,
    });
  });

  it("defaults to the current time", () => {
    const old = makeRecord("certification", { expiresOn: "2001-01-01" });
    expect(toPublicDocument(old, "verify")?.state).toBe("expired");
  });
});

describe("toPublicDocument: view and download are separate", () => {
  const withFile = (overrides: Partial<DocumentRecord>) =>
    makeRecord("certification", { visibility: "public", files: [{ id: "f", documentId: "d", role: "primary", filename: "c.pdf", mimeType: "application/pdf", sizeBytes: 10, sha256: "a".repeat(64), createdAt: "2026-01-01T00:00:00.000Z" }], ...overrides });

  it("a view-only file is public but cannot be downloaded", () => {
    const doc = toPublicDocument(withFile({ allowView: true, allowDownload: false }), "listing", NOW);
    expect(doc).toMatchObject({ hasFile: true, canDownload: false, allowDownload: false });
    expect(doc?.file?.filename).toBe("c.pdf");
  });

  it("a downloadable file is public and can be downloaded", () => {
    expect(toPublicDocument(withFile({ allowView: true, allowDownload: true }), "listing", NOW)).toMatchObject({ hasFile: true, canDownload: true });
  });

  it("a record saved before view-only existed (download on, view off) keeps working as it did", () => {
    expect(toPublicDocument(withFile({ allowView: false, allowDownload: true }), "listing", NOW)).toMatchObject({ hasFile: true, canDownload: true });
  });

  it("with neither on there is no public file at all", () => {
    const doc = toPublicDocument(withFile({ allowView: false, allowDownload: false }), "listing", NOW);
    expect(doc).toMatchObject({ hasFile: false, canDownload: false, file: null });
  });

  it("a record with no file offers nothing, whatever the switches say", () => {
    const doc = toPublicDocument(makeRecord("certification", { visibility: "public", allowView: true, allowDownload: true, files: [] }), "listing", NOW);
    expect(doc).toMatchObject({ hasFile: false, canDownload: false });
  });
});
