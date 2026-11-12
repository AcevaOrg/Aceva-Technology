import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { describe, expect, it, vi } from "vitest";
import CertificateGrid from "@/components/documents/CertificateGrid";
import { EmptyState } from "@/components/documents/CategorySection";
import FinancialLedger from "@/components/documents/FinancialLedger";
import IdentityRows from "@/components/documents/IdentityRows";
import TeamHierarchy from "@/components/documents/TeamHierarchy";
import QrImage from "@/components/documents/QrImage";
import Seal from "@/components/documents/Seal";
import VerifiedByQr from "@/components/documents/VerifiedByQr";
import VerifyLanding from "@/components/documents/VerifyLanding";
import VerifyResult from "@/components/documents/VerifyResult";
import type { VerifyOutcome } from "@/components/documents/verifyLookup";
import { toPublicDocument, type PublicDocument } from "@/lib/documents/public";
import type { DocumentCategory, DocumentFileMeta, DocumentRecord, FileRole } from "@/lib/documents/types";

// The code box uses the router; a static render has none, and none is needed to produce its markup.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

const CODE = "ACV-7K3M-9QXD-4TRH";
const NOW = new Date("2026-11-04T12:00:00Z");
const CHECKED_AT = "2026-11-04T14:03:09.000Z";

function fileMeta(role: FileRole): DocumentFileMeta {
  return {
    id: `f-${role}`,
    documentId: "d",
    role,
    filename: role === "photo" ? "portrait.jpg" : "annual-report.pdf",
    mimeType: role === "photo" ? "image/jpeg" : "application/pdf",
    sizeBytes: 1_250_000,
    sha256: "ab".repeat(32),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function record(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category,
    title: "Title",
    summary: "",
    status: "published",
    visibility: "public",
    allowDownload: true,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: "",
    referenceNo: "",
    issuedOn: "2026-01-10",
    expiresOn: null,
    verificationCode: CODE,
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [fileMeta("primary")],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function doc(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}, context: "listing" | "verify" = "verify"): PublicDocument {
  const projected = toPublicDocument(record(category, overrides), context, NOW);
  if (!projected) throw new Error("fixture not visible");
  return projected;
}

const html = (element: ReactElement) => renderToStaticMarkup(element);

/** Renders a tree that contains async server components (the QR image), which the sync renderer rejects. */
async function renderAsync(element: ReactElement): Promise<string> {
  const { prelude } = await prerender(element);
  const reader = prelude.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

const certification = (overrides: Partial<DocumentRecord> = {}) =>
  doc("certification", {
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    data: { direction: "held", issuing_body: "BSI", level: "Level 2", skills: ["security", "isms"], credential_url: "https://example.com/credential" },
    ...overrides,
  });

const result = (document: PublicDocument | null, state: "valid" | "expired" | "revoked" | "not_found"): VerifyOutcome => ({
  kind: "result",
  state,
  document,
  checkedAt: CHECKED_AT,
});

/* ------------------------------------------------------------------ *
 * /verify/<code>                                                       *
 * ------------------------------------------------------------------ */

describe("VerifyResult", () => {
  it("shows a valid record on a paper card with its facts, file, fingerprint and the way out", () => {
    const out = html(<VerifyResult rawCode={CODE.toLowerCase()} outcome={result(certification({ allowDownload: true }), "valid")} />);

    expect(out).toContain("This record is valid.");
    expect(out).toContain("Checked just now");
    expect(out).toContain(`<time dateTime="${CHECKED_AT}">4 Nov 2026, 14:03 UTC</time>`);
    expect(out).toContain("ISO/IEC 27001:2022");
    expect(out).toContain("Awarded to");
    expect(out).toContain("ACEVA Technology");
    expect(out).toContain("Certificate no.");
    expect(out).toContain("ACV/CERT/2026/0042");
    expect(out).toContain("10 Jan 2026");
    // select option labels, not raw values
    expect(out).toContain("Held by ACEVA");
    expect(out).not.toContain(">held<");
    expect(out).toContain("security");
    // the file, with the canonical code in its links
    expect(out).toContain("annual-report.pdf");
    expect(out).toContain("ab".repeat(32));
    expect(out).toContain(`/api/documents/11111111-1111-4111-8111-111111111111/file?role=primary&amp;code=${CODE}`);
    expect(out).toContain("role=primary&amp;code=ACV-7K3M-9QXD-4TRH&amp;download=1");
    expect(out).toContain("How to compare this with your copy");
    expect(out).toContain("shasum -a 256");
    expect(out).toContain("Get-FileHash");
    // the way out
    expect(out).toMatch(/href="\/verify"[^>]*>Verify another/);
    expect(out).toContain("mailto:contact@acevatech.com?subject=");
    expect(out).toContain("Report a problem");
    // a valid record is not dressed up as anything else
    expect(out).not.toContain("expired");
    expect(out).not.toContain("revoked");
  });

  it("offers no Open or Download when the public may not have the file", () => {
    const out = html(<VerifyResult rawCode={CODE} outcome={result(certification({ allowDownload: false }), "valid")} />);
    expect(out).toContain("This record is valid.");
    expect(out).not.toContain("The document file");
    expect(out).not.toContain("SHA-256");
    expect(out).not.toContain("/file?role=primary");
  });

  it("says plainly that an expired record has expired, and marks its date", () => {
    const expired = certification({ issuedOn: "2019-01-01", expiresOn: "2020-01-01" });
    const out = html(<VerifyResult rawCode={CODE} outcome={result(expired, "expired")} />);
    expect(out).toContain("This record has expired.");
    expect(out).toContain("1 Jan 2020 (expired)");
    expect(out).toContain("ISO/IEC 27001:2022");
  });

  it("shows only the minimal view for a revoked record", () => {
    const revoked = certification({ revokedAt: "2026-05-01T09:00:00.000Z" });
    const out = html(<VerifyResult rawCode={CODE} outcome={result(revoked, "revoked")} />);
    expect(out).toContain("This record has been revoked.");
    expect(out).toContain("ISO/IEC 27001:2022");
    expect(out).toContain("ACV/CERT/2026/0042");
    expect(out).toContain("Revoked on");
    expect(out).toContain("1 May 2026");
    expect(out).not.toContain("ACEVA Technology</dd>");
    expect(out).not.toContain("BSI");
    expect(out).not.toContain("SHA-256");
    expect(out).not.toContain("/file?role=");
  });

  it("gives an unknown, hidden or malformed code the same neutral page, without a record or a hint", () => {
    const out = html(<VerifyResult rawCode="nonsense" outcome={result(null, "not_found")} />);
    expect(out).toContain("We could not verify this code.");
    expect(out).not.toContain("record-title");
    expect(out).not.toMatch(/revoked|expired|draft|private|deleted|exist/i);
    expect(out).toContain("Verify another");
    // a malformed code is never echoed into the page or into the mail subject
    expect(out).not.toContain("nonsense");
  });

  it("shows a calm 'try again' for a spent budget and for an outage, never a verdict", () => {
    const limited = html(<VerifyResult rawCode={CODE} outcome={{ kind: "rate_limited", retryAfter: 42 }} />);
    expect(limited).toContain("Too many lookups just now.");
    expect(limited).toContain(`href="/verify/${CODE}"`);
    expect(limited).toContain("Try again");
    expect(limited).not.toContain("Checked just now");

    const down = html(<VerifyResult rawCode="whatever" outcome={{ kind: "unavailable" }} />);
    expect(down).toContain("Verification is temporarily unavailable.");
    expect(down).toContain("not a verdict on your code");
    expect(down).toContain('href="/verify"');
    expect(down).not.toContain("We could not verify this code.");
    expect(down).not.toContain("Checked just now");
  });

  it("escapes everything a record can contain", () => {
    const hostile = certification({
      title: '<img src=x onerror="alert(1)">',
      holderName: "<script>alert(1)</script>",
      data: { direction: "held", issuing_body: '"><svg onload=alert(1)>', credential_url: "javascript:alert(1)" },
    });
    const out = html(<VerifyResult rawCode={CODE} outcome={result(hostile, "valid")} />);
    expect(out).not.toContain("<script>alert");
    expect(out).not.toContain("<img src=x");
    expect(out).not.toContain("<svg onload");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(out).not.toContain("javascript:");
  });

  it("includes the holder's photo only when the record opts in, through the code-aware route", () => {
    const person = (data: Record<string, string | boolean>) =>
      doc("program_record", {
        visibility: "unlisted",
        holderName: "Aisha Khan",
        title: "Intern",
        data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer", start_date: "2026-06-01", record_status: "active", ...data },
        files: [fileMeta("primary"), fileMeta("photo")],
      });
    const withPhoto = html(<VerifyResult rawCode={CODE} outcome={result(person({ show_photo: true }), "valid")} />);
    expect(withPhoto).toContain(`role=photo&amp;code=${CODE}`);
    expect(withPhoto).toContain("Photo of Aisha Khan");
    const without = html(<VerifyResult rawCode={CODE} outcome={result(person({ show_photo: false }), "valid")} />);
    expect(without).not.toContain("role=photo");
  });

  it("never reveals admin-only fields", () => {
    const letter = doc("experience_letter", {
      visibility: "unlisted",
      holderName: "Bilal Ahmed",
      data: {
        designation: "Engineer",
        employment_type: "full_time",
        start_date: "2024-01-01",
        currently_employed: true,
        signatory_name: "Head of People",
        responsibilities: "PRIVATE-RESPONSIBILITIES",
        remarks: "PRIVATE-REMARKS",
        contact_email: "private@example.com",
        internal_notes: "PRIVATE-NOTES",
      },
    });
    const out = html(<VerifyResult rawCode={CODE} outcome={result(letter, "valid")} />);
    expect(out).toContain("Engineer");
    for (const secret of ["PRIVATE-RESPONSIBILITIES", "PRIVATE-REMARKS", "private@example.com", "PRIVATE-NOTES"]) expect(out).not.toContain(secret);
  });
});

describe("VerifyLanding", () => {
  it("is a plain GET form to /verify with one named field, usable without JavaScript", () => {
    const out = html(<VerifyLanding />);
    expect(out).toContain("Check a document.");
    expect(out).toMatch(/<form[^>]*action="\/verify"[^>]*method="get"/);
    expect(out).toContain('name="code"');
    expect(out).toContain("Scan the QR on the document with your phone camera");
    expect(out).toContain("opens this page automatically");
    // the four possible answers are previewed
    for (const badge of ["Valid", "Expired", "Revoked", "Not found"]) expect(out).toContain(badge);
    expect(html(<VerifyLanding />).match(/<h1/g)).toHaveLength(1);
  });

  it("hands back an unreadable code with a message, escaped", () => {
    const out = html(<VerifyLanding initialCode={'<b>"x"</b>'} initialError="That is not a full verification code yet." />);
    expect(out).toContain("That is not a full verification code yet.");
    // the field only ever holds code characters, so markup in a ?code= value cannot reach the page
    expect(out).not.toContain('<b>"x"');
    expect(out).not.toContain("&lt;b&gt;");
    expect(out).toContain('value="ACV-BXB"');
  });
});

/* ------------------------------------------------------------------ *
 * /documents sections                                                  *
 * ------------------------------------------------------------------ */

describe("FinancialLedger", () => {
  const report = doc(
    "financial_report",
    {
      title: "FY 2025–26 Audited Statements",
      referenceNo: "ACV/FIN/2026/001",
      issuedOn: "2026-03-12",
      data: { report_type: "audited_statements", fiscal_year: "2025–26", period: "full_year", currency: "PKR", audited: true, auditor: "A. Ford & Co", highlights: "Revenue up.\nCosts flat." },
    },
    "listing",
  );

  it("shows type, year, period, currency, the audited line, highlights and both file actions", () => {
    const out = html(<FinancialLedger docs={[report]} />);
    expect(out).toContain("Audited financial statements");
    expect(out).toContain("FY 2025–26 Audited Statements");
    expect(out).toContain("2025–26");
    expect(out).toContain("Full year");
    expect(out).toContain("Full year · PKR");
    expect(out).toContain("Audited by A. Ford &amp; Co");
    expect(out).toContain("Published 12 Mar 2026");
    expect(out).toContain("<summary>Highlights</summary>");
    expect(out).toContain("Revenue up.");
    expect(out).toContain('href="/api/documents/11111111-1111-4111-8111-111111111111/file?role=primary"');
    expect(out).toContain("file?role=primary&amp;download=1");
    expect(out).toContain("PDF, 1.3 MB");
  });

  it("is a compact sheet: the fiscal year is the headline, the secondary facts wait under Details", () => {
    const out = html(<FinancialLedger docs={[report]} />);
    // a grid of sheets, not a ruled list of rows
    expect(out).toMatch(/<ul class="[^"]*shelf/);
    expect(out).toMatch(/<li class="[^"]*sheet/);
    // the year headline carries a screen-reader prefix so it is not just a bare number
    expect(out).toMatch(/Fiscal year <\/span>2025–26/);
    // published date, reference and file facts live inside the disclosure, not on the tile face
    const details = out.slice(out.indexOf("<details"));
    expect(details).toContain("Published 12 Mar 2026");
    expect(details).toContain("ACV/FIN/2026/001");
    const face = out.slice(0, out.indexOf("<details"));
    expect(face).not.toContain("Published 12 Mar 2026");
  });

  it("has a labelled View button of its own, with Download beside it, both named in full for a screen reader", () => {
    const out = html(<FinancialLedger docs={[report]} />);
    expect(out).toContain('aria-label="View FY 2025–26 Audited Statements (PDF, 1.3 MB, opens in a new tab)"');
    expect(out).toContain('aria-label="Download FY 2025–26 Audited Statements (PDF, 1.3 MB)"');
    // View says "View" in words, as a button; Download is the round icon next to it in the narrow sheet.
    expect(out).toMatch(/<a [^>]*actPillPrimary[^>]*>[^]*?<span>View<\/span><\/a>/);
    expect(out).toMatch(/<a [^>]*class="[^"]*actIcon[^"]*"[^>]*download/);
  });

  it("labels an unaudited report, and falls back to the publish year when no fiscal year is set", () => {
    const plain = doc("financial_report", { title: "Tax filing", issuedOn: "2025-12-15", data: { report_type: "tax_filing", audited: false } }, "listing");
    const out = html(<FinancialLedger docs={[plain]} />);
    expect(out).toContain("Unaudited");
    expect(out).toMatch(/Fiscal year <\/span>2025</);
  });

  it("says 'on request' instead of offering a download the public may not have", () => {
    const out = html(<FinancialLedger docs={[{ ...report, hasFile: false, file: null }]} />);
    expect(out).toContain("On request.");
    expect(out).toContain('href="/contact"');
    expect(out).not.toContain("/file?role=primary");
  });

  describe("level alignment: every sheet is built from the same slots", () => {
    const SLOTS = ["sheetKind", "sheetYear", "<h3", "sheetMeta", "sheetStatus", "sheetFoot"];
    const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
    // a full report, a bare one (no type, year, period, audit flag, file or details), and an expired one
    // (revoked reports never reach the public listing, so expired is the state a sheet can actually show)
    const full = doc("financial_report", { id: id(1), title: "Full", issuedOn: "2026-03-12", referenceNo: "REF-1", summary: "About it.", data: { report_type: "annual_report", fiscal_year: "2025–26", period: "full_year", currency: "PKR", audited: true, auditor: "A. Ford & Co", highlights: "Revenue up." } }, "listing");
    const bare = doc("financial_report", { id: id(2), title: "Bare", issuedOn: null, allowDownload: false, data: {} }, "listing");
    const expired = doc("financial_report", { id: id(3), title: "Expired", issuedOn: null, expiresOn: "2025-12-31", data: { audited: false } }, "listing");

    const sheets = (docs: PublicDocument[]) => html(<FinancialLedger docs={docs} />).split(/<li /).slice(1);

    it("renders every slot on every sheet, even when a report has nothing to put in it", () => {
      const out = sheets([full, bare, expired]);
      expect(out).toHaveLength(3);
      for (const sheet of out) for (const slot of SLOTS) expect(sheet, slot).toContain(slot);
    });

    it("keeps the state chip inside the status slot rather than adding a row", () => {
      const [fullSheet, , expiredSheet] = sheets([full, bare, expired]);
      const statusOf = (sheet: string) => sheet.slice(sheet.indexOf("sheetStatus"), sheet.indexOf("sheetFoot"));
      expect(statusOf(expiredSheet)).toContain("Expired");
      expect(statusOf(fullSheet)).not.toMatch(/Revoked|Expired/);
      // no stray paragraph between the status slot and the file bar
      expect(expiredSheet).not.toContain("sheetState");
    });

    it("gives a sheet with no details bar a same-height spacer when its neighbours have one", () => {
      const [fullSheet, bareSheet] = sheets([full, bare]);
      expect(fullSheet).toContain("<details");
      expect(fullSheet).not.toContain("moreSpacer");
      expect(bareSheet).not.toContain("<details");
      expect(bareSheet).toMatch(/moreSpacer[^>]*aria-hidden="true"/);
    });

    it("adds no spacer, and no empty bar, when no sheet has anything to open", () => {
      const out = html(<FinancialLedger docs={[bare, { ...bare, id: id(4), title: "Bare two" }]} />);
      expect(out).not.toContain("moreSpacer");
      expect(out).not.toContain("<details");
    });

    it("keeps the file bar the same shape with and without a file", () => {
      const [fullSheet, bareSheet] = sheets([full, bare]);
      const foot = (sheet: string) => sheet.slice(sheet.indexOf("sheetFoot"));
      expect(foot(fullSheet)).toContain("actionRow");
      expect(foot(bareSheet)).toContain("On request.");
      // both live in the one fixed-height bar
      for (const sheet of [fullSheet, bareSheet]) expect(sheet.match(/sheetFoot/g)).toHaveLength(1);
    });
  });
});

describe("IdentityRows", () => {
  it("uses the category's own labels and marks an expired document", () => {
    const row = doc(
      "company_identity",
      {
        title: "Business licence",
        holderName: "ACEVA Technology (Private) Limited",
        referenceNo: "0123456-7",
        issuedOn: "2019-01-01",
        expiresOn: "2020-01-01",
        data: { identity_type: "business_licence", issuing_authority: "SECP", jurisdiction: "Pakistan", registered_address: "1 Main Street\nLahore" },
      },
      "listing",
    );
    const out = html(<IdentityRows docs={[row]} />);
    expect(out).toContain("Business licence");
    expect(out).toContain("Legal entity");
    expect(out).toContain("Registration / licence no.");
    expect(out).toContain("SECP");
    expect(out).toContain("Pakistan");
    expect(out).toContain("1 Main Street");
    expect(out).toContain("Expired");
  });
});

describe("CertificateGrid", () => {
  it("shows the seal, issuer, skills, a QR and the verify link", async () => {
    const out = await renderAsync(<CertificateGrid docs={[certification()]} />);
    expect(out).toContain("ISO/IEC 27001:2022");
    expect(out).toContain("Held by ACEVA");
    expect(out).toContain("BSI");
    expect(out).toContain("security");
    expect(out).toContain(`href="/verify/${CODE}"`);
    expect(out).toContain("Verify this certificate");
    expect(out).toContain('src="data:image/svg+xml;base64,');
    expect(out).toContain("QR code that opens the verification page for ISO/IEC 27001:2022");
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it("is a compact pass: the QR is the verify link, and the long facts wait under Details", async () => {
    const out = await renderAsync(<CertificateGrid docs={[certification()]} />);
    // the QR itself is the link, named for assistive tech
    // (lookaheads, so the test does not depend on the order the attributes are printed in)
    expect(out).toMatch(
      new RegExp(`<a(?=[^>]*href="/verify/${CODE}")(?=[^>]*aria-label="Verify this certificate: ISO/IEC 27001:2022")[^>]*>`),
    );
    expect(out).toMatch(/<ul class="[^"]*passGrid/);
    expect(out).toContain("Scan to verify");
    // level, skills and the external credential are tucked into the disclosure
    const details = out.slice(out.indexOf("<details"));
    expect(details).toContain("Level 2");
    expect(details).toContain("isms");
    expect(details).toContain("External credential");
    const face = out.slice(0, out.indexOf("<details"));
    expect(face).not.toContain("Level 2");
    expect(face).not.toContain("External credential");
  });

  it("gives the pass a labelled View button and a labelled Download button, named exactly like the full-size ones", async () => {
    const out = await renderAsync(<CertificateGrid docs={[certification({ allowDownload: true })]} />);
    expect(out).toMatch(/aria-label="View ISO\/IEC 27001:2022 \(PDF, [\d.]+ (KB|MB), opens in a new tab\)"/);
    expect(out).toMatch(/aria-label="Download ISO\/IEC 27001:2022 \(PDF, [\d.]+ (KB|MB)\)"/);
    expect(out).toContain("<span>View</span>");
    expect(out).toContain("<span>Download</span>");
    // Two separate links: View opens the file in a tab, Download carries the download attribute.
    expect(out).toMatch(/<a [^>]*href="[^"]*role=primary"[^>]*target="_blank"/);
    expect(out).toMatch(/<a [^>]*href="[^"]*download=1"[^>]*download/);
  });

  it("draws the validity bar from real dates: running, expired and open-ended", async () => {
    const running = await renderAsync(<CertificateGrid docs={[certification({ issuedOn: "2020-01-01", expiresOn: "2099-12-31" })]} />);
    expect(running).toContain("Valid until 31 Dec 2099");
    expect(running).toMatch(/years? (\d+ months? )?left/);
    expect(running).toContain('data-phase="running"');
    expect(running).toMatch(/--w:0\.\d+/);

    const expired = await renderAsync(<CertificateGrid docs={[certification({ issuedOn: "2019-01-01", expiresOn: "2020-01-01" })]} />);
    expect(expired).toContain("Expired 1 Jan 2020");
    expect(expired).toContain(" ago");
    expect(expired).toContain('data-phase="ended"');
    expect(expired).toContain("--w:1");

    const open = await renderAsync(<CertificateGrid docs={[certification({ issuedOn: "2020-01-01", expiresOn: null })]} />);
    expect(open).toContain("No expiry");
    expect(open).toContain('data-phase="open-ended"');
    expect(open).not.toContain("--w:");
  });

  it("omits the QR and the verify link for a certificate without a code", async () => {
    const out = await renderAsync(<CertificateGrid docs={[certification({ verificationCode: null })]} />);
    expect(out).not.toContain("data:image/svg+xml");
    expect(out).not.toContain("Verify this certificate");
    expect(out).toContain("ISO/IEC 27001:2022");
  });

  describe("level alignment: every pass is built from the same slots", () => {
    const SLOTS = ["passKind", "<h3", "passHolder", "meterText", "stubLabel", "stubActions"];
    const id = (n: number) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
    // a full pass, and a bare one: no holder, issuer, reference, QR code, public file, expiry or details
    const full = certification({ id: id(1), issuedOn: "2020-01-01", expiresOn: "2099-12-31", summary: "About it." });
    const bare = certification({
      id: id(2),
      title: "Bare",
      holderName: "",
      referenceNo: "",
      issuedOn: null,
      expiresOn: null,
      verificationCode: null,
      allowDownload: false,
      summary: "",
      data: { direction: "issued" },
    });
    const passes = async (docs: PublicDocument[]) => (await renderAsync(<CertificateGrid docs={docs} />)).split(/<li /).slice(1);

    it("renders every slot on every pass, even when a certificate has nothing to put in it", async () => {
      const out = await passes([full, bare]);
      expect(out).toHaveLength(2);
      for (const pass of out) {
        for (const slot of SLOTS) expect(pass, slot).toContain(slot);
        // issuer and reference are two separate slots
        expect(pass.match(/passMeta/g), "passMeta slots").toHaveLength(2);
      }
    });

    it("keeps the issuer and the reference on their own single lines, with the full text in a tooltip", async () => {
      const [pass] = await passes([full]);
      expect(pass).toMatch(/<p class="[^"]*passMeta[^"]*" title="BSI">BSI<\/p>/);
      expect(pass).toMatch(/<p class="[^"]*passMeta[^"]*" title="No\. ACV\/CERT\/2026\/0042">No\. ACV\/CERT\/2026\/0042<\/p>/);
      // never joined into one wrapping line
      expect(pass).not.toContain("BSI · No.");
    });

    it("always gives the validity text two lines, so a long date cannot wrap one pass and not another", async () => {
      const [running, open] = [...(await passes([full])), ...(await passes([bare]))];
      expect(running).toMatch(/meterText[^>]*><span>Valid until 31 Dec 2099<\/span><strong>[^<]+ left<\/strong>/);
      // no expiry: the second line is an empty placeholder, not missing
      expect(open).toMatch(/meterText[^>]*><span>No expiry<\/span><span><\/span>/);
    });

    it("holds the QR and file-button rows open for a pass without a code or a public file", async () => {
      const [fullPass, barePass] = await passes([full, bare]);
      expect(fullPass).toContain("Scan to verify");
      expect(fullPass).not.toContain("stubQrGap");
      expect(barePass).toMatch(/stubQrGap[^>]*aria-hidden="true"/);
      expect(barePass).not.toContain("Scan to verify");
      expect(barePass).not.toContain("Verify this certificate");
      // the file bar is one fixed-height slot with icons or with the "on request" line
      expect(fullPass).toMatch(/stubActions[^>]*><div class="[^"]*actionRow/);
      expect(barePass).toMatch(/stubActions[^>]*><p class="[^"]*noFile[^"]*" data-compact/);
      expect(barePass).toContain("On request.");
    });

    it("gives a pass with no details bar a same-height spacer when its neighbours have one", async () => {
      const [fullPass, barePass] = await passes([full, bare]);
      expect(fullPass).toContain("<details");
      expect(fullPass).not.toContain("moreSpacer");
      expect(barePass).not.toContain("<details");
      expect(barePass).toMatch(/moreSpacer[^>]*aria-hidden="true"/);
    });

    it("adds no spacer, and no empty bar, when no pass has anything to open", async () => {
      const out = await renderAsync(<CertificateGrid docs={[bare, { ...bare, id: id(3), title: "Bare two" }]} />);
      expect(out).not.toContain("moreSpacer");
      expect(out).not.toContain("<details");
    });
  });
});

describe("QrImage", () => {
  it("embeds an SVG that encodes the verification URL, as an inert image", async () => {
    const out = html((await QrImage({ code: CODE, size: 96, alt: "QR" })) as ReactElement);
    const match = /src="data:image\/svg\+xml;base64,([^"]+)"/.exec(out);
    expect(match).not.toBeNull();
    const svg = Buffer.from(match?.[1] ?? "", "base64").toString("utf8");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script|onload|javascript:/i);
  });

  it("renders nothing for a value that is not a code", async () => {
    expect(await QrImage({ code: "nonsense", alt: "QR" })).toBeNull();
  });
});

describe("TeamHierarchy: a person's card", () => {
  const person = (data: Record<string, string | boolean | string[]>, overrides: Partial<DocumentRecord> = {}) =>
    doc(
      "program_record",
      {
        title: "Software Engineering Intern",
        holderName: "Aisha Khan",
        data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", cohort: "Cohort 03", start_date: "2026-06-01", record_status: "alumni", consent_to_publish: true, ...data },
        files: [fileMeta("photo")],
        ...overrides,
      },
      "listing",
    );

  it("shows a monogram, not a photo, unless the record opts in", () => {
    const out = html(<TeamHierarchy docs={[person({})]} />);
    expect(out).toContain("Aisha Khan");
    expect(out).toContain(">AK<");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("role=photo");
  });

  it("shows the photo through the file route (no code needed for a consenting public record)", () => {
    const out = html(<TeamHierarchy docs={[person({ show_photo: true })]} />);
    expect(out).toContain('src="/api/documents/11111111-1111-4111-8111-111111111111/file?role=photo"');
    expect(out).toContain('alt="Portrait of Aisha Khan"');
    expect(out).toContain('loading="lazy"');
  });

  it("shows role, department, program, cohort, status, bio, skills, a safe LinkedIn link and the verify link", () => {
    const out = html(
      <TeamHierarchy
        docs={[person({ department: "Engineering", bio: "Builds things.", skills: ["React", "Postgres"], linkedin_url: "https://www.linkedin.com/in/aisha" })]}
      />,
    );
    expect(out).toContain("Frontend Intern");
    expect(out).toMatch(/<span class="[^"]*">Engineering<\/span>/);
    expect(out).toContain("Summer 2026 · Cohort 03");
    expect(out).toContain("Alumni");
    expect(out).toContain("Builds things.");
    expect(out).toContain("Postgres");
    expect(out).toContain('href="https://www.linkedin.com/in/aisha"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain(`href="/verify/${CODE}"`);
  });

  it("puts the name in an h3, and does not call an active person out with a status chip", () => {
    const out = html(<TeamHierarchy docs={[person({ record_status: "active" })]} />);
    expect(out).toMatch(/<h3 id="person-[^"]+">Aisha Khan<\/h3>/);
    expect(out).not.toContain("Alumni");
    expect(out).not.toContain("Active");
  });

  it("refuses a link that is not http(s)", () => {
    const out = html(<TeamHierarchy docs={[person({ linkedin_url: "javascript:alert(1)" })]} />);
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("LinkedIn");
  });

  it("keeps the person's private fields out", () => {
    const out = html(
      <TeamHierarchy
        docs={[person({ contact_email: "aisha.private@example.com", internal_notes: "NOTE-INTERNAL", consent_to_publish: true, show_photo: false })]}
      />,
    );
    expect(out).not.toContain("aisha.private@example.com");
    expect(out).not.toContain("NOTE-INTERNAL");
    expect(out).not.toContain("consent");
    expect(out).not.toContain("show_photo");
  });

  it("falls back to the headline when a profile saved before job titles has no role", () => {
    const legacy = doc(
      "program_record",
      { title: "Summer Intern", holderName: "Old Record", data: { record_kind: "intern", start_date: "2026-06-01", record_status: "active", consent_to_publish: true } },
      "listing",
    );
    const out = html(<TeamHierarchy docs={[legacy]} />);
    expect(out).toContain("Old Record");
    expect(out).toContain("Summer Intern");
  });
});

describe("TeamHierarchy: tiers, counts and reporting lines", () => {
  let n = 0;
  const member = (name: string, level: string | null, extra: Record<string, string | boolean | string[]> = {}, overrides: Partial<DocumentRecord> = {}) => {
    n += 1;
    return doc(
      "program_record",
      {
        id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        title: `${name} headline`,
        holderName: name,
        data: {
          ...(level === null ? {} : { hierarchy_level: level }),
          role_title: `${name} role`,
          record_kind: "employee",
          start_date: "2024-01-01",
          record_status: "active",
          consent_to_publish: true,
          ...extra,
        },
        files: [],
        ...overrides,
      },
      "listing",
    );
  };

  it("lists the tiers in rank order, only the ones with people, each with a count", () => {
    const out = html(
      <TeamHierarchy
        docs={[member("Intern One", "trainee"), member("Founder One", "leadership"), member("Founder Two", "leadership"), member("Lead One", "team_lead")]}
      />,
    );
    const headings = [...out.matchAll(/<h3 id="team-tier-([a-z_]+)">([^<]+)<\/h3>/g)].map((m) => [m[1], m[2]]);
    expect(headings).toEqual([
      ["leadership", "Leadership"],
      ["team_lead", "Team leads"],
      ["trainee", "Interns &amp; trainees"],
    ]);
    expect(out).not.toContain("Management");
    expect(out).not.toContain("Team members");
    expect(out).toMatch(/Leadership<\/h3><span class="[^"]*">2<span class="[^"]*"> people<\/span>/);
    expect(out).toMatch(/Team leads<\/h3><span class="[^"]*">1<span class="[^"]*"> person<\/span>/);
  });

  it("marks the first and last tier so the connector is drawn only between tiers", () => {
    const out = html(<TeamHierarchy docs={[member("A", "leadership"), member("B", "member")]} />);
    expect(out).toMatch(/data-level="leadership" data-first="true" data-last="false"/);
    expect(out).toMatch(/data-level="member" data-first="false" data-last="true"/);
  });

  it("makes leadership cards larger than the rest", () => {
    const out = html(<TeamHierarchy docs={[member("Boss", "leadership"), member("Worker", "member")]} />);
    expect(out.match(/data-size="lead"/g)).toHaveLength(1);
    expect(out.indexOf('data-size="lead"')).toBeLessThan(out.indexOf("Worker"));
  });

  it("treats a missing or unknown level as a team member, and never drops the person", () => {
    const out = html(<TeamHierarchy docs={[member("No Level", null), member("Odd Level", "wizard")]} />);
    expect(out).toContain('id="team-tier-member"');
    expect(out).toContain("No Level");
    expect(out).toContain("Odd Level");
    expect(out).not.toContain("wizard");
  });

  it("prints 'Reports to <name>' as plain text, using the listed person's own spelling, and never links it", () => {
    const boss = member("Hira Malik", "leadership");
    const out = html(<TeamHierarchy docs={[boss, member("Sana Ali", "member", { reports_to: "  hira   MALIK " })]} />);
    expect(out).toContain("Reports to Hira Malik");
    expect(out).not.toMatch(/<a [^>]*>[^<]*Hira Malik/);
  });

  it("keeps a manager who is not listed as typed, and ignores a person reporting to themselves", () => {
    const out = html(
      <TeamHierarchy docs={[member("Sana Ali", "member", { reports_to: "Someone Outside" }), member("Self Ref", "member", { reports_to: "self ref" })]} />,
    );
    expect(out).toContain("Reports to Someone Outside");
    expect(out).not.toContain("Reports to Self Ref");
    expect(out).not.toContain("Reports to self ref");
  });

  it("offers a department filter only with two or more departments, counted, with everything still in the markup", () => {
    const two = html(
      <TeamHierarchy
        docs={[member("A", "member", { department: "Engineering" }), member("B", "member", { department: "engineering" }), member("C", "member", { department: "Design" })]}
      />,
    );
    expect(two).toContain('aria-pressed="true"');
    expect(two).toMatch(/>All<span class="[^"]*">3<\/span>/);
    expect(two).toMatch(/>Design<span class="[^"]*">1<\/span>/);
    expect(two).toMatch(/>Engineering<span class="[^"]*">2<\/span>/);
    // nothing is hidden before a chip is pressed
    expect(two).not.toMatch(/\shidden(=|>)/);
    expect(two).toContain("A role");
    expect(two).toContain("C role");

    const one = html(<TeamHierarchy docs={[member("A", "member", { department: "Engineering" }), member("B", "member", { department: "Engineering" })]} />);
    expect(one).not.toContain("aria-pressed");
    const none = html(<TeamHierarchy docs={[member("A", "member")]} />);
    expect(none).not.toContain("aria-pressed");
  });

  it("orders people in a tier by featured, then the admin's sort order, then name", () => {
    const a = member("Zed Last", "member");
    const b = member("Amy First", "member");
    const c = member("Mid Sort", "member");
    const star = member("Star Person", "member", {}, { featured: true });
    const sortOrders = new Map([
      [a.id, 1],
      [b.id, 1],
      [c.id, 0],
      [star.id, 9],
    ]);
    const out = html(<TeamHierarchy docs={[a, b, c, star]} sortOrders={sortOrders} />);
    const order = ["Star Person", "Mid Sort", "Amy First", "Zed Last"].map((name) => out.indexOf(`>${name}</h3>`));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("renders nothing private for a whole team, whatever the records hold", () => {
    const secret = member("Secret Holder", "management", {
      contact_email: "secret.person@example.com",
      internal_notes: "INTERNAL-ONLY-NOTE",
      show_photo: false,
    });
    const out = html(<TeamHierarchy docs={[secret]} />);
    for (const hidden of ["secret.person@example.com", "INTERNAL-ONLY-NOTE", "consent_to_publish", "contact_email", "internal_notes"]) {
      expect(out).not.toContain(hidden);
    }
  });
});

describe("VerifiedByQr and EmptyState", () => {
  it("explains an unlisted category and links to the code box without listing anything", () => {
    const out = html(<VerifiedByQr category="experience_letter" />);
    expect(out).toContain("Verified by QR");
    expect(out).toContain("A verifier sees");
    expect(out).toContain("Always kept private");
    expect(out).toContain("Designation");
    expect(out).toContain("Responsibilities");
    expect(out).toContain('name="code"');
    expect(out).toMatch(/Code from an experience letter/);
  });

  it("keeps 'nothing published' honest, and 'unavailable' distinct from it", () => {
    const empty = html(<EmptyState category="financial_report" />);
    expect(empty).toContain("Nothing published yet");
    expect(empty).not.toContain("role=\"status\"");
    const unavailable = html(<EmptyState category="financial_report" unavailable />);
    expect(unavailable).toContain("Temporarily unavailable");
    expect(unavailable).not.toContain("Nothing published yet");
  });
});

describe("Seal", () => {
  it("is decorative and has a finished shape for every verdict", () => {
    for (const kind of ["valid", "expired", "revoked", "not_found", "rate_limited", "unavailable"] as const) {
      const out = html(<Seal kind={kind} />);
      expect(out, kind).toContain('aria-hidden="true"');
      expect(out, kind).toContain("<svg");
    }
    expect(html(<Seal kind="revoked" />)).toContain("<polygon");
    expect(html(<Seal kind="valid" />)).toContain("M38 62 L53 77 L83 43");
    expect(html(<Seal kind="valid" size={44} />)).toMatch(/compact/);
  });
});

describe("view-only files on the public pages", () => {
  const viewOnly = (overrides: Partial<DocumentRecord> = {}) => certification({ allowDownload: false, allowView: true, ...overrides });

  it("the certificate pass shows a View button and no Download button", async () => {
    const out = await renderAsync(<CertificateGrid docs={[viewOnly()]} />);
    expect(out).toContain("<span>View</span>");
    expect(out).not.toContain("<span>Download</span>");
    expect(out).not.toContain("download=1");
    expect(out).toMatch(/aria-label="View ISO\/IEC 27001:2022 \(PDF, [\d.]+ (KB|MB), opens in a new tab\)"/);
    expect(out).not.toContain("On request.");
  });

  it("the report sheet shows View alone", () => {
    const report = doc("financial_report", { title: "FY report", allowDownload: false, allowView: true, data: { report_type: "annual_report", fiscal_year: "2025", period: "full_year", currency: "PKR" } }, "listing");
    const out = html(<FinancialLedger docs={[report]} />);
    expect(out).toContain("<span>View</span>");
    expect(out).not.toMatch(/class="[^"]*actIcon/);
    expect(out).not.toContain("download=1");
  });

  it("the verify page offers View, and Download only when it is allowed", () => {
    const code = "ACV-7K3M-9QXD-4TRH";
    const viewOnlyDoc = doc("certification", { allowDownload: false, allowView: true, verificationCode: code }, "verify");
    const open = doc("certification", { allowDownload: true, allowView: true, verificationCode: code }, "verify");
    const viewOnlyPage = html(<VerifyResult rawCode={code} outcome={result(viewOnlyDoc, "valid")} />);
    const openPage = html(<VerifyResult rawCode={code} outcome={result(open, "valid")} />);
    expect(viewOnlyPage).toMatch(/aria-label="View [^"]*opens in a new tab/);
    expect(viewOnlyPage).not.toMatch(/aria-label="Download /);
    expect(openPage).toMatch(/aria-label="Download /);
  });

  it("a file the admin has not shared still shows 'On request'", async () => {
    const out = await renderAsync(<CertificateGrid docs={[certification({ allowDownload: false, allowView: false })]} />);
    expect(out).toContain("On request.");
    expect(out).not.toContain("<span>View</span>");
  });
});
