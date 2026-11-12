import { describe, expect, it } from "vitest";
import { assessReadiness, buildCardData } from "@/components/admin/card/cardData";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";

const NOW = new Date("2026-06-01T12:00:00Z");
const ID = "0b9d4f1e-6c1a-4f36-9a41-2f3c7d8e9a10";
const CODE = "ACV-7K3M-9QXD-4TRH";
const VERIFY_URL = `https://acevatech.com/verify/${CODE}`;

/** A complete, published certification: the baseline every readiness test bends one thing on. */
function certificate(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: ID,
    category: "certification",
    title: "ISO/IEC 27001:2022 Certificate",
    summary: "",
    status: "published",
    visibility: "public",
    allowDownload: false,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    expiresOn: "2027-01-09",
    verificationCode: CODE,
    revokedAt: null,
    revokedReason: "",
    data: { direction: "held", issuing_body: "BSI", contact_email: "private@example.com", internal_notes: "Renewal is due in March." },
    files: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    publishedAt: "2026-01-02T00:00:00.000Z",
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function record(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return certificate({ category, title: "Experience letter — Engineer", holderName: "Bilal Ahmed", referenceNo: "ACV/EL/2026/0007", data: {}, ...overrides });
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("assessReadiness", () => {
  it("is ready and complete when everything is in place", () => {
    const readiness = assessReadiness(certificate(), { hasUsableCode: true, now: NOW });
    expect(readiness.ready).toBe(true);
    expect(readiness.complete).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.warnings).toEqual([]);
    expect(ids(readiness.items)).toEqual(["code", "title", "reference", "published", "scannable", "valid"]);
    expect(readiness.items.every((item) => item.ok)).toBe(true);
  });

  it("asks for nothing a label does not print: no photo, name or date checks, whatever the category", () => {
    for (const category of ["certification", "program_record", "experience_letter"] as const) {
      const readiness = assessReadiness(record(category), { hasUsableCode: true, now: NOW });
      expect(ids(readiness.items), category).toEqual(["code", "title", "reference", "published", "scannable", "valid"]);
    }
  });

  it("blocks printing without a usable verification code", () => {
    const readiness = assessReadiness(certificate({ verificationCode: null }), { hasUsableCode: false, now: NOW });
    expect(readiness.ready).toBe(false);
    expect(ids(readiness.blockers)).toEqual(["code"]);
    expect(readiness.blockers[0].detail).toMatch(/no verification code/i);
    expect(readiness.blockers[0].detail).toMatch(/editor/i);
  });

  it("treats a stored code that cannot be used the same as a missing one", () => {
    const readiness = assessReadiness(certificate({ verificationCode: "not-a-code" }), { hasUsableCode: false, now: NOW });
    expect(ids(readiness.blockers)).toContain("code");
  });

  it("blocks printing without a title, ignoring whitespace", () => {
    const readiness = assessReadiness(certificate({ title: "   " }), { hasUsableCode: true, now: NOW });
    expect(ids(readiness.blockers)).toEqual(["title"]);
    expect(readiness.ready).toBe(false);
  });

  it("collects every blocker at once", () => {
    const readiness = assessReadiness(certificate({ title: " ", verificationCode: null }), { hasUsableCode: false, now: NOW });
    expect(ids(readiness.blockers)).toEqual(["code", "title"]);
  });

  it("only warns about a missing reference where the category requires one", () => {
    const required = assessReadiness(certificate({ referenceNo: "" }), { hasUsableCode: true, now: NOW });
    expect(ids(required.warnings)).toEqual(["reference"]);
    expect(required.ready).toBe(true);

    const optional = assessReadiness(record("program_record", { referenceNo: "" }), { hasUsableCode: true, now: NOW });
    expect(optional.warnings).toEqual([]);
    expect(optional.items.find((item) => item.id === "reference")).toMatchObject({ ok: false, severity: "info" });
    expect(optional.complete).toBe(true);
  });

  it("warns, but still allows printing, for a draft", () => {
    const readiness = assessReadiness(certificate({ status: "draft" }), { hasUsableCode: true, now: NOW });
    expect(readiness.ready).toBe(true);
    expect(readiness.complete).toBe(false);
    expect(ids(readiness.warnings)).toEqual(["published"]);
    expect(readiness.warnings[0].detail).toMatch(/draft/i);
  });

  it("explains an archived record differently from a draft", () => {
    const readiness = assessReadiness(certificate({ status: "archived" }), { hasUsableCode: true, now: NOW });
    expect(readiness.warnings[0].detail).toMatch(/archived/i);
  });

  it("warns that a private record reports not found when scanned", () => {
    const readiness = assessReadiness(certificate({ visibility: "private" }), { hasUsableCode: true, now: NOW });
    expect(ids(readiness.warnings)).toEqual(["scannable"]);
    expect(readiness.ready).toBe(true);
  });

  it("warns for a revoked record and for an expired one, naming the date", () => {
    const revoked = assessReadiness(certificate({ revokedAt: "2026-05-01T00:00:00.000Z" }), { hasUsableCode: true, now: NOW });
    expect(ids(revoked.warnings)).toEqual(["valid"]);
    expect(revoked.warnings[0].detail).toMatch(/revoked/i);

    const expired = assessReadiness(certificate({ expiresOn: "2026-03-12" }), { hasUsableCode: true, now: NOW });
    expect(ids(expired.warnings)).toEqual(["valid"]);
    expect(expired.warnings[0].detail).toContain("12 Mar 2026");
  });

  it("is valid through the whole of its expiry day", () => {
    const lastDay = assessReadiness(certificate({ expiresOn: "2026-06-01" }), { hasUsableCode: true, now: NOW });
    expect(lastDay.items.find((item) => item.id === "valid")?.ok).toBe(true);
    const nextDay = assessReadiness(certificate({ expiresOn: "2026-05-31" }), { hasUsableCode: true, now: NOW });
    expect(nextDay.items.find((item) => item.id === "valid")?.ok).toBe(false);
  });

  it("revocation wins over expiry", () => {
    const readiness = assessReadiness(certificate({ revokedAt: "2026-05-01T00:00:00.000Z", expiresOn: "2026-01-01" }), { hasUsableCode: true, now: NOW });
    expect(readiness.warnings[0].detail).toMatch(/revoked/i);
  });

  it("treats a record with no expiry date as valid", () => {
    const readiness = assessReadiness(certificate({ expiresOn: null }), { hasUsableCode: true, now: NOW });
    expect(readiness.items.find((item) => item.id === "valid")?.ok).toBe(true);
  });
});

describe("buildCardData", () => {
  it("maps a record, trimming what it prints", () => {
    const data = buildCardData(certificate({ title: "  ISO 27001  ", holderName: "  ACEVA Technology ", referenceNo: " ACV/CERT/1 " }), VERIFY_URL);
    expect(data).toEqual({
      id: ID,
      category: "certification",
      categoryLabel: "Certification",
      title: "ISO 27001",
      holderName: "ACEVA Technology",
      referenceNo: "ACV/CERT/1",
      qrSrc: `/api/admin/documents/${ID}/qr?format=svg`,
      verifyUrl: VERIFY_URL,
      verifyShort: `acevatech.com/verify/${CODE}`,
      code: CODE,
    });
  });

  it("has no QR, link or code without a usable verification URL, even if a code is stored", () => {
    const data = buildCardData(certificate({ verificationCode: "garbage" }), null);
    expect(data.qrSrc).toBeNull();
    expect(data.verifyUrl).toBeNull();
    expect(data.verifyShort).toBe("");
    expect(data.code).toBeNull();
  });

  it("does not trust a URL when the record holds no code", () => {
    const data = buildCardData(certificate({ verificationCode: null }), VERIFY_URL);
    expect(data.qrSrc).toBeNull();
    expect(data.code).toBeNull();
  });

  it("never carries the private fields of the record, only what the label prints", () => {
    const serialised = JSON.stringify(buildCardData(certificate(), VERIFY_URL));
    expect(serialised).not.toContain("private@example.com");
    expect(serialised).not.toContain("Renewal is due");
  });

  it("works for the other verifiable categories, which have no card-specific fields", () => {
    const data = buildCardData(record("experience_letter"), VERIFY_URL);
    expect(data.categoryLabel).toBe("Experience letter");
    expect(data.title).toBe("Experience letter — Engineer");
    expect(data.referenceNo).toBe("ACV/EL/2026/0007");
  });
});
