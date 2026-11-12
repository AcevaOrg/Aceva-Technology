/**
 * Server-render smoke tests: every category renders in create mode, a stored record renders in edit mode with
 * its tools, text is escaped, and no inline grid is emitted. Interaction is not covered here (the repo has no DOM
 * environment); the logic behind it is tested in the other adminEditor*.test files.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/documents/new",
}));

import { CategoryPicker } from "@/components/admin/editor/CategoryPicker";
import { DocumentEditor } from "@/components/admin/editor/DocumentEditor";
import { VerificationPanel } from "@/components/admin/editor/VerificationPanel";
import { ToastProvider } from "@/components/admin/Toast";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import type { DocumentRecord } from "@/lib/documents/types";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(React.createElement(ToastProvider, null, node));
}

const ID = "0b9d3a52-6f5e-4c1a-9a53-1f2f7d0a4b11";

function record(category: keyof typeof CATEGORIES, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: ID,
    category,
    title: "Record <b>title</b>",
    summary: "",
    status: "draft",
    visibility: CATEGORIES[category].defaultVisibility,
    allowDownload: false,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: "Aisha Khan",
    referenceNo: "ACV/X/1",
    issuedOn: "2026-01-02",
    expiresOn: null,
    verificationCode: "ACV-AAAA-BBBB-CCCC",
    revokedAt: null,
    revokedReason: "",
    data: { designation: "Engineer" },
    files: [
      { id: "1", documentId: ID, role: "primary", filename: "letter.pdf", mimeType: "application/pdf", sizeBytes: 12345, sha256: "a".repeat(64), createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", documentId: ID, role: "photo", filename: "face.jpg", mimeType: "image/jpeg", sizeBytes: 2345, sha256: "b".repeat(64), createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    publishedAt: null,
    verifyCount: 3,
    lastVerifiedAt: "2026-02-02T10:00:00.000Z",
    ...overrides,
  };
}

describe("document editor markup", () => {
  it("renders every category in create mode", () => {
    for (const spec of CATEGORY_LIST) {
      const html = render(
        React.createElement(DocumentEditor, { mode: "create", category: spec.key, maxUploadBytes: 4_000_000, cancelHref: "/admin/documents" }),
      );
      expect(html, spec.key).toContain("Basics");
      expect(html, spec.key).toContain("Publishing");
      expect(html, spec.key).toContain("Save draft");
      expect(html, spec.key).toContain(">Publish<");
      expect(html, spec.key).toContain("As visitors see it");
      expect(html, spec.key).not.toContain("grid-template-columns");
      for (const key of ["title", "summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
        const base = spec.base[key];
        if (!base.hidden) expect(html, `${spec.key}.${key}`).toContain(base.label);
      }
      for (const field of spec.fields) {
        if (field.showWhen) continue; // appears only once its controller is set
        expect(html, `${spec.key}.${field.key}`).toContain(field.label);
      }
      expect(html).toContain('data-scope="public"');
      expect(html).toContain('data-scope="admin"');
      if (spec.hasPhoto) expect(html, spec.key).toContain("Photo");
      if (spec.verifiable) expect(html, spec.key).toContain("Enable QR verification");
      else expect(html, spec.key).not.toContain("Enable QR verification");
    }
  });

  it("renders a stored record in edit mode with its files, the verification panel and no unsafe markup", () => {
    const stored = record("experience_letter");
    const html = render(
      React.createElement(DocumentEditor, {
        mode: "edit",
        category: "experience_letter",
        record: stored,
        maxUploadBytes: 4_000_000,
        cancelHref: "/admin/documents",
        aside: React.createElement(VerificationPanel, { record: stored, publicUrl: "https://acevatech.com/verify/ACV-AAAA-BBBB-CCCC" }),
      }),
    );
    expect(html).toContain("letter.pdf");
    expect(html).toContain(`/api/admin/documents/${ID}/qr?format=svg`);
    expect(html).toContain("ACV-AAAA-BBBB-CCCC");
    expect(html).toContain("Regenerate code");
    expect(html).toContain("Revoke");
    expect(html).toContain("Print QR labels");
    expect(html).toContain(`/admin/documents/${ID}/card`);
    expect(html).toContain("QR verification is on");
    expect(html).not.toContain("Enable QR verification");
    expect(html).toContain(">Update<");
    expect(html).toContain("Publication status");
    // The title is text, never markup.
    expect(html).not.toContain("<b>title</b>");
    expect(html).toContain("Record &lt;b&gt;title&lt;/b&gt;");
    // Public is not offered for an experience letter.
    expect(html).not.toContain(">Public</button>");
  });

  it("renders the program record's consent gate and the privacy notice", () => {
    const html = render(
      React.createElement(DocumentEditor, { mode: "create", category: "program_record", maxUploadBytes: 4_000_000, cancelHref: "/admin/documents" }),
    );
    expect(html).toContain("This record is about a person");
    expect(html).toContain("Consent to be listed publicly");
    expect(html).toContain("Public is locked");
  });

  it("renders the verification panel for a record without a code", () => {
    const html = render(
      React.createElement(VerificationPanel, { record: record("financial_report", { verificationCode: null }), publicUrl: null }),
    );
    expect(html).toContain("Record actions");
    expect(html).toContain("not verified by QR");
    expect(html).not.toContain("/qr?format");
  });

  it("renders a revoked record's panel", () => {
    const html = render(
      React.createElement(VerificationPanel, {
        record: record("certification", { revokedAt: "2026-03-01T00:00:00.000Z", revokedReason: "Issued in error" }),
        publicUrl: "https://acevatech.com/verify/ACV-AAAA-BBBB-CCCC",
      }),
    );
    expect(html).toContain("Reinstate");
    expect(html).toContain("Issued in error");
    expect(html).not.toContain("Regenerate code");
  });

  it("renders the category picker as one plain link per category, five in all", () => {
    const html = renderToStaticMarkup(React.createElement(CategoryPicker));
    for (const spec of CATEGORY_LIST) {
      expect(html).toContain(`/admin/documents/new?category=${spec.slug}`);
      expect(html).toContain(spec.label.replace("&", "&amp;"));
    }
    expect((html.match(/<a /g) ?? []).length).toBe(5);
    expect(CATEGORY_LIST).toHaveLength(5);
    expect(html).not.toContain("category=ids");
  });
});
