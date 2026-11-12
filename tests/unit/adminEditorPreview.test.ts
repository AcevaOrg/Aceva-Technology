import { describe, expect, it } from "vitest";
import { createInitialValues, type EditorValues } from "@/components/admin/editor/editorModel";
import {
  PREVIEW_CODE,
  cardChips,
  formatDateOnly,
  formatDateTimeUtc,
  formatFieldValue,
  previewRecord,
  projectPreview,
  publicRows,
  visitorSummary,
  type PreviewContext,
} from "@/components/admin/editor/editorPreview";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";

const NOW = new Date("2026-06-15T10:00:00.000Z");

const none: PreviewContext = { stored: null, primary: null, photo: null, willHaveCode: false };

function values(category: DocumentCategory, patch: Partial<EditorValues> = {}, data: EditorValues["data"] = {}): EditorValues {
  const base = createInitialValues(category);
  return { ...base, ...patch, data: { ...base.data, ...data } };
}

function stored(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    ...previewRecord("certification", values("certification"), none),
    id: "0b9d3a52-6f5e-4c1a-9a53-1f2f7d0a4b11",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatters", () => {
  it("writes a date the same everywhere", () => {
    expect(formatDateOnly("2026-11-04")).toBe("4 Nov 2026");
    expect(formatDateOnly("2026-01-09")).toBe("9 Jan 2026");
    expect(formatDateOnly("2026-11-04T10:00:00.000Z")).toBe("4 Nov 2026");
    expect(formatDateOnly("")).toBe("");
    expect(formatDateOnly(null)).toBe("");
    expect(formatDateOnly("not a date")).toBe("not a date");
  });

  it("writes a timestamp in UTC, so server and browser agree", () => {
    expect(formatDateTimeUtc("2026-11-04T14:32:00.000Z")).toBe("4 Nov 2026, 14:32 UTC");
    expect(formatDateTimeUtc("2026-01-02T03:04:05Z")).toBe("2 Jan 2026, 03:04 UTC");
    expect(formatDateTimeUtc(null)).toBe("");
    expect(formatDateTimeUtc("garbage")).toBe("");
  });

  it("formats each kind of stored value as a person reads it", () => {
    const cert = CATEGORIES.certification.fields;
    const field = (key: string) => cert.find((candidate) => candidate.key === key)!;
    expect(formatFieldValue("certification", field("direction"), "held")).toBe("Held by ACEVA");
    expect(formatFieldValue("certification", field("skills"), ["a", "b"])).toBe("a, b");
    expect(formatFieldValue("certification", field("level"), "L2")).toBe("L2");
    const finance = CATEGORIES.financial_report.fields;
    expect(formatFieldValue("financial_report", finance.find((f) => f.key === "audited")!, true)).toBe("Yes");
    expect(formatFieldValue("financial_report", finance.find((f) => f.key === "period_start")!, "2026-03-01")).toBe("1 Mar 2026");
    expect(formatFieldValue("certification", field("level"), undefined)).toBe("");
  });
});

describe("previewRecord", () => {
  it("is forced to published so the preview shows the finished result", () => {
    const record = previewRecord("certification", values("certification", { title: "ISO" }), none);
    expect(record.status).toBe("published");
    expect(record.title).toBe("ISO");
    expect(previewRecord("certification", values("certification"), none).title).toBe("Untitled document");
  });

  it("shows a placeholder code only when one is coming, and the real one when there is one", () => {
    expect(previewRecord("certification", values("certification"), none).verificationCode).toBeNull();
    expect(previewRecord("certification", values("certification"), { ...none, willHaveCode: true }).verificationCode).toBe(PREVIEW_CODE);
    const real = stored({ verificationCode: "ACV-AAAA-BBBB-CCCC" });
    expect(previewRecord("certification", values("certification"), { ...none, stored: real, willHaveCode: true }).verificationCode).toBe("ACV-AAAA-BBBB-CCCC");
  });

  it("carries revocation from the stored record", () => {
    const revoked = stored({ revokedAt: "2026-05-01T00:00:00.000Z", revokedReason: "Issued in error" });
    expect(previewRecord("certification", values("certification"), { ...none, stored: revoked }).revokedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("describes attached files without bytes", () => {
    const record = previewRecord("certification", values("certification"), {
      ...none,
      primary: { filename: "cert.pdf", mimeType: "application/pdf", sizeBytes: 2000 },
    });
    expect(record.files).toHaveLength(1);
    expect(record.files[0]).toMatchObject({ role: "primary", filename: "cert.pdf", sha256: "" });
  });
});

describe("projectPreview", () => {
  const certValues = values(
    "certification",
    { title: "ISO/IEC 27001", holderName: "ACEVA", referenceNo: "ACV/CERT/1", issuedOn: "2026-01-10", expiresOn: "2030-01-10", visibility: "public" },
    { direction: "held", issuing_body: "BSI", level: "Lead", skills: ["security"], internal_notes: "do not leak" },
  );

  it("shows a public record as the card on the Documents page", () => {
    const projection = projectPreview(previewRecord("certification", certValues, none), NOW);
    expect(projection.kind).toBe("listing");
    if (projection.kind !== "listing") return;
    expect(projection.doc.title).toBe("ISO/IEC 27001");
    expect(cardChips(projection.doc)).toEqual(["Held by ACEVA", "BSI", "Lead"]);
    expect(projection.doc.state).toBe("valid");
  });

  it("shows an unlisted record as the verify page", () => {
    const projection = projectPreview(previewRecord("certification", { ...certValues, visibility: "unlisted" }, none), NOW);
    expect(projection.kind).toBe("verify");
  });

  it("shows nothing for a private record", () => {
    expect(projectPreview(previewRecord("certification", { ...certValues, visibility: "private" }, none), NOW).kind).toBe("private");
  });

  it("explains why a personal record without consent is not listed", () => {
    const person = values(
      "program_record",
      { title: "Intern", holderName: "Aisha", visibility: "public" },
      { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer", start_date: "2026-06-01", record_status: "active", consent_to_publish: false },
    );
    const projection = projectPreview(previewRecord("program_record", person, none), NOW);
    expect(projection.kind).toBe("hidden");
    if (projection.kind === "hidden") expect(projection.reason).toMatch(/consent/i);
  });

  it("shows a team profile's level, job title and department as its card chips", () => {
    const person = values(
      "program_record",
      { title: "Head of Engineering", holderName: "Hira Malik", visibility: "public" },
      { hierarchy_level: "leadership", role_title: "Head of Engineering", department: "Engineering", record_kind: "employee", start_date: "2024-01-01", record_status: "active", consent_to_publish: true },
    );
    const projection = projectPreview(previewRecord("program_record", person, none), NOW);
    expect(projection.kind).toBe("listing");
    if (projection.kind === "listing") expect(cardChips(projection.doc)).toEqual(["Leadership", "Head of Engineering", "Engineering"]);
  });

  it("previews a profile saved before levels existed as a team member, as the public page lists it", () => {
    const legacy = values(
      "program_record",
      { title: "Intern", holderName: "Old Record", visibility: "public" },
      { role_title: "Frontend Intern", record_kind: "intern", start_date: "2026-06-01", record_status: "active", consent_to_publish: true },
    );
    const projection = projectPreview(previewRecord("program_record", legacy, none), NOW);
    expect(projection.kind).toBe("listing");
    if (projection.kind === "listing") expect(cardChips(projection.doc)).toEqual(["Team member", "Frontend Intern"]);
  });

  it("lists a personal record once consent is recorded", () => {
    const person = values(
      "program_record",
      { title: "Intern", holderName: "Aisha", visibility: "public" },
      { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer", start_date: "2026-06-01", record_status: "active", consent_to_publish: true },
    );
    expect(projectPreview(previewRecord("program_record", person, none), NOW).kind).toBe("listing");
  });

  it("marks an expired record as expired", () => {
    const expired = { ...certValues, expiresOn: "2026-01-01" };
    const projection = projectPreview(previewRecord("certification", expired, none), NOW);
    expect(projection.kind === "listing" && projection.doc.state).toBe("expired");
  });

  it("collapses a revoked record to what a scan would show", () => {
    const record = previewRecord("certification", certValues, { ...none, stored: stored({ revokedAt: "2026-05-01T00:00:00.000Z" }) });
    const projection = projectPreview(record, NOW);
    expect(projection.kind).toBe("verify");
    if (projection.kind !== "verify") return;
    expect(projection.doc.state).toBe("revoked");
    expect(projection.doc.holderName).toBe("");
    expect(projection.doc.fields).toEqual({});
    expect(projection.note).toBeTruthy();
  });

  it("only offers the file when the public may view or download it", () => {
    const primary = { filename: "c.pdf", mimeType: "application/pdf", sizeBytes: 100 };
    const closed = projectPreview(previewRecord("certification", { ...certValues, allowView: false, allowDownload: false }, { ...none, primary }), NOW);
    const open = projectPreview(previewRecord("certification", { ...certValues, allowView: true, allowDownload: true }, { ...none, primary }), NOW);
    expect(closed.kind === "listing" && closed.doc.file).toBeNull();
    expect(open.kind === "listing" && open.doc.file?.filename).toBe("c.pdf");
  });

  it("shows a view-only file to visitors, with no download offered", () => {
    const primary = { filename: "c.pdf", mimeType: "application/pdf", sizeBytes: 100 };
    const viewOnly = projectPreview(previewRecord("certification", { ...certValues, allowView: true, allowDownload: false }, { ...none, primary }), NOW);
    expect(viewOnly.kind === "listing" && viewOnly.doc.file?.filename).toBe("c.pdf");
    expect(viewOnly.kind === "listing" && viewOnly.doc.canDownload).toBe(false);
  });
});

describe("the preview can never show an admin-only answer", () => {
  it("drops every field marked public: false, in every category and on both public surfaces", () => {
    const SECRET = "SECRET-VALUE";
    for (const spec of CATEGORY_LIST) {
      const data: EditorValues["data"] = {};
      for (const field of spec.fields) {
        if (field.type === "boolean") data[field.key] = true;
        else if (field.type === "tags") data[field.key] = [field.public ? "visible-tag" : SECRET];
        else if (field.type === "select") data[field.key] = field.options?.[0]?.value ?? "";
        else if (field.type === "date") data[field.key] = "2026-02-02";
        else data[field.key] = field.public ? "visible" : SECRET;
      }
      for (const visibility of spec.allowedVisibility.filter((candidate) => candidate !== "private")) {
        const form = values(spec.key, { title: "Title", holderName: "Holder", referenceNo: "REF", visibility, allowDownload: true }, data);
        const projection = projectPreview(previewRecord(spec.key, form, { ...none, willHaveCode: true }), NOW);
        if (projection.kind !== "listing" && projection.kind !== "verify") continue;

        const serialised = JSON.stringify(projection.doc);
        expect(serialised, `${spec.key}/${visibility}`).not.toContain(SECRET);
        for (const field of spec.fields.filter((candidate) => !candidate.public)) {
          expect(projection.doc.fields, `${spec.key}.${field.key}`).not.toHaveProperty(field.key);
        }
        const labels = publicRows(projection.doc).map((row) => row.label);
        for (const field of spec.fields.filter((candidate) => !candidate.public)) {
          expect(labels, `${spec.key}.${field.label}`).not.toContain(field.label);
        }
      }
    }
  });
});

describe("visitorSummary", () => {
  it("lists what is shown and what stays in the console, straight from the spec", () => {
    const summary = visitorSummary("experience_letter");
    expect(summary.shown).toContain("Employee / intern name");
    expect(summary.shown).toContain("Designation");
    expect(summary.admin).toEqual(expect.arrayContaining(["Responsibilities", "Remarks", "Contact email", "Internal notes"]));
    expect(summary.shown).not.toContain("Responsibilities");
  });

  it("omits base columns a category hides", () => {
    expect(visitorSummary("financial_report").shown).not.toContain("Entity");
    expect(visitorSummary("experience_letter").shown).not.toContain("Summary");
  });

  it("puts every field in the list its public flag says", () => {
    for (const spec of CATEGORY_LIST) {
      const summary = visitorSummary(spec.key);
      for (const field of spec.fields) {
        expect(summary.shown.includes(field.label), `${spec.key}.${field.key} shown`).toBe(field.public);
        expect(summary.admin.includes(field.label), `${spec.key}.${field.key} admin`).toBe(!field.public);
      }
    }
  });
});
