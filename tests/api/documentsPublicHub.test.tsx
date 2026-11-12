import type { PGlite } from "@electric-sql/pglite";
import type { ReactElement } from "react";
import { prerender } from "react-dom/static";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsPage from "@/app/documents/page";
import ui from "@/components/home/home.module.css";
import { loadRegistry } from "@/components/documents/registry";
import { setSqlClientForTests, type SqlClient } from "@/lib/db";
import { inspectUpload, type InspectedUpload } from "@/lib/documents/files";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import { createDocument } from "@/lib/documents/store";
import type { DocumentCategory } from "@/lib/documents/types";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Lets one test pretend no database is configured, without ever touching the real environment.
const flags = vi.hoisted(() => ({ configured: true }));
vi.mock("@/lib/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/db")>();
  return { ...original, isDatabaseConfigured: () => (flags.configured ? original.isDatabaseConfigured() : false) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

let pg: Awaited<ReturnType<typeof createPgliteSql>>;
let db: PGlite;
let sql: SqlClient;

beforeAll(async () => {
  pg = await createPgliteSql();
  db = pg.db;
  sql = pg.sql;
  setSqlClientForTests(sql);
  await ensureDocumentTables();
});

afterAll(async () => {
  setSqlClientForTests(null);
  resetDocumentTablesCache();
  await pg.close();
});

beforeEach(async () => {
  flags.configured = true;
  setSqlClientForTests(sql);
  await db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ *
 * Fixtures                                                            *
 * ------------------------------------------------------------------ */

const BASE: Record<string, Record<string, unknown>> = {
  financial_report: {
    title: "FY 2025-26 Audited Statements",
    issuedOn: "2026-01-10",
    data: { report_type: "annual_report", fiscal_year: "2025-26", period: "full_year", currency: "PKR", audited: true, auditor: "A. Ford & Co" },
  },
  certification: {
    title: "ISO/IEC 27001:2022",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    issuedOn: "2026-01-10",
    data: { direction: "held", issuing_body: "BSI", skills: ["security"] },
  },
  program_record: {
    title: "Software Engineering Intern",
    holderName: "Aisha Khan",
    data: { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer 2026", start_date: "2026-06-01", record_status: "active", consent_to_publish: true },
  },
  experience_letter: {
    title: "Experience letter UNLISTED-LETTER-TITLE",
    holderName: "Bilal UNLISTED-HOLDER",
    referenceNo: "ACV/EL/2026/0007",
    issuedOn: "2026-02-01",
    data: { designation: "Software Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "Head of People" },
  },
};

function input(category: DocumentCategory, top: Record<string, unknown> = {}): DocumentInput {
  const base = BASE[category];
  const result = validateDocumentInput(
    { status: "published", enableVerification: true, allowDownload: true, ...base, ...top, data: { ...(base.data as object), ...((top.data as object | undefined) ?? {}) } },
    { category },
  );
  if (!result.ok) throw new Error(`fixture invalid: ${JSON.stringify(result.errors)}`);
  return result.value;
}

let sequence = 0;
function pdf(): InspectedUpload {
  sequence += 1;
  const body = Buffer.from(Array.from({ length: 800 }, (_, i) => 0x41 + ((i * 7 + sequence) % 26)));
  const result = inspectUpload({ name: "report.pdf", bytes: Buffer.concat([Buffer.from("%PDF-1.7\n"), body, Buffer.from("\n%%EOF\n")]) }, "primary");
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

const seed = (category: DocumentCategory, top: Record<string, unknown> = {}) => createDocument(input(category, top), { primary: pdf() });

async function renderPage(): Promise<string> {
  const element = (await DocumentsPage()) as ReactElement;
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

/** The markup of one section, found by its anchor id. */
function section(html: string, id: string): string {
  const start = html.indexOf(`<section id="${id}"`);
  expect(start, `section ${id} exists`).toBeGreaterThanOrEqual(0);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

/* ------------------------------------------------------------------ *
 * The page                                                            *
 * ------------------------------------------------------------------ */

describe("the /documents page, rendered end to end", () => {
  it("lists only public, published records, in the right sections, and never the unlisted or draft ones", async () => {
    // financial reports default to private until someone chooses to publish them
    await seed("financial_report", { visibility: "public" });
    await seed("certification");
    await seed("program_record", { visibility: "public" });
    await seed("experience_letter", { visibility: "unlisted" });
    await seed("certification", { title: "DRAFT-CERT-TITLE", status: "draft", referenceNo: "ACV/CERT/DRAFT" });
    await seed("certification", { title: "PRIVATE-CERT-TITLE", visibility: "private", referenceNo: "ACV/CERT/PRIV" });

    const html = await renderPage();

    expect(html).toMatch(/<h1[^>]*id="documents-h1"/);
    expect(html).toContain(">check</span>");
    expect(section(html, "financial-reports")).toContain("FY 2025-26 Audited Statements");
    expect(section(html, "financial-reports")).toContain("Audited by A. Ford &amp; Co");
    expect(section(html, "financial-reports")).toContain("1 published");
    expect(section(html, "certifications")).toContain("ISO/IEC 27001:2022");
    expect(section(html, "certifications")).toContain("data:image/svg+xml;base64,");
    expect(section(html, "team")).toContain("Aisha Khan");

    // nothing is invented for a category with no public records
    expect(section(html, "company-identity")).toContain("Nothing published yet");
    expect(section(html, "company-identity")).not.toContain("<li");

    // unlisted, draft and private records appear nowhere on the page
    for (const hidden of ["UNLISTED-LETTER-TITLE", "UNLISTED-HOLDER", "DRAFT-CERT-TITLE", "PRIVATE-CERT-TITLE"]) {
      expect(html, hidden).not.toContain(hidden);
    }
    // the unlisted category explains itself instead
    expect(section(html, "certifications")).toContain("Verified by QR");
    expect(section(html, "certifications")).toContain("letters never listed");
    // The retired ID card category leaves no section and no index link behind
    expect(html).not.toContain('id="ids"');
    expect(html).not.toContain('href="#ids"');
  });

  it("does not list a person without consent, even if the row says public", async () => {
    await seed("program_record", { visibility: "public", holderName: "Consent Withdrawn" });
    await db.exec("UPDATE documents SET data = data - 'consent_to_publish'");
    const html = await renderPage();
    expect(html).not.toContain("Consent Withdrawn");
    expect(section(html, "team")).toContain("Nothing published yet");
  });

  it("does not list a revoked record", async () => {
    await seed("certification");
    await db.exec("UPDATE documents SET revoked_at = now()");
    const html = await renderPage();
    expect(html).not.toContain("ISO/IEC 27001:2022");
    expect(section(html, "certifications")).toContain("Nothing published yet");
  });

  it("keeps a financial report out of the listing while it is still private (the default)", async () => {
    await seed("financial_report");
    const html = await renderPage();
    expect(html).not.toContain("FY 2025-26 Audited Statements");
    expect(section(html, "financial-reports")).toContain("Nothing published yet");
  });

  it("renders every section, the index, the three steps and both calls to action", async () => {
    const html = await renderPage();
    for (const id of ["financial-reports", "company-identity", "certifications", "team", "experience-letters", "how-verification-works"]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).toContain('aria-label="Document categories"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Scan");
    expect(html).toContain("Trust");
    expect(html).toContain('href="/verify"');
    expect(html).toContain('href="/contact"');
    expect(html).not.toContain("data-armed");
  });

  it("says 'unavailable', never 'nothing published', when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    resetDocumentTablesCache();
    setSqlClientForTests(async () => {
      throw new Error("connect ECONNREFUSED postgres://user:secret@db.internal");
    });
    const html = await renderPage();
    resetDocumentTablesCache();

    expect(html).toContain("The registry is taking a moment.");
    expect(html).toContain('role="status"');
    expect(section(html, "financial-reports")).toContain("Temporarily unavailable");
    expect(html).not.toContain("Nothing published yet");
    expect(html).not.toMatch(/secret|ECONNREFUSED|db\.internal/);
    // verifying by code still works from the page
    expect(section(html, "certifications")).toContain('name="code"');
  });

  it("says the same when no database is configured at all", async () => {
    flags.configured = false;
    const html = await renderPage();
    expect(html).toContain("The registry is taking a moment.");
    expect(html).not.toContain("Nothing published yet");
  });
});

/** The open tag of the filter row whose visible label is `label`, so a test can tell whether it is hidden. */
function filterRow(markup: string, label: string): string {
  const match = new RegExp(`<div class="[^"]*" role="group" aria-labelledby="([^"]+)"[^>]*><span id="\\1" class="[^"]*">${label}</span>`).exec(markup);
  expect(match, `filter row "${label}" exists`).not.toBeNull();
  return match?.[0] ?? "";
}

/** The pressed-state buttons of the page, as "Label|count" pairs in order. */
function chips(markup: string): string[] {
  return [...markup.matchAll(/<button type="button" class="[^"]*" aria-pressed="(?:true|false)">([^<]*)(?:<span class="[^"]*">(\d+)<\/span>)?<\/button>/g)].map(
    (m) => `${m[1]}|${m[2] ?? ""}`,
  );
}

describe("the combined Certifications & letters section", () => {
  it("renders both panels, the chips with their counts and both anchors in the server markup", async () => {
    await seed("certification", { title: "HELD-CERT-ONE", referenceNo: "ACV/CERT/1" });
    await seed("certification", { title: "HELD-CERT-TWO", referenceNo: "ACV/CERT/2" });
    await seed("certification", { title: "ISSUED-CERT-ONE", referenceNo: "ACV/CERT/3", data: { direction: "issued", issuing_body: "ACEVA Technology" } });
    await seed("experience_letter", { visibility: "unlisted" });

    const html = await renderPage();
    const certs = section(html, "certifications");

    // one section, one heading, both halves present with nothing hidden
    expect(certs).toContain("Certifications &amp; letters");
    expect(certs).toContain("HELD-CERT-ONE");
    expect(certs).toContain("ISSUED-CERT-ONE");
    expect(certs).toContain("Verified by QR");
    expect(certs).toContain('data-panel="certifications"');
    expect(certs).toContain('data-panel="letters"');
    expect(certs).not.toMatch(/data-panel="[a-z]+" hidden/);
    expect(certs).toContain('data-view="all"');
    expect(certs).toContain('data-direction-filter="all"');
    expect(certs).not.toContain("UNLISTED-LETTER-TITLE");

    // the view chips: All · Certifications (counted) · Experience letters (never counted: letters are never listed)
    expect(chips(certs).slice(0, 3)).toEqual(["All|", "Certifications|3", "Experience letters|"]);
    // the direction chips, counted from the data
    expect(chips(certs).slice(3)).toEqual(["All|3", "Held by ACEVA|2", "Issued by ACEVA|1"]);
    expect(filterRow(certs, "Certificates")).not.toContain("hidden");
    expect(certs).toContain('data-direction="held"');
    expect(certs).toContain('data-direction="issued"');

    // the old deep links: the section id is unchanged, and the letters anchor is an empty span inside it
    expect(html.match(/id="certifications"/g)).toHaveLength(1);
    expect(html.match(/id="experience-letters"/g)).toHaveLength(1);
    expect(certs).toMatch(/<span id="experience-letters" class="[^"]*"><\/span>/);
    expect(html).not.toContain('<section id="experience-letters"');
    expect(html).not.toContain('href="#experience-letters"');
  });

  it("announces nothing before anyone presses a chip, and offers the chips only to people with JavaScript", async () => {
    const html = await renderPage();
    const certs = section(html, "certifications");
    expect(certs).toMatch(/<p class="[^"]*" role="status" aria-live="polite" aria-atomic="true"><\/p>/);
    expect(certs).toContain("<noscript><style>[data-filter-bar]{display:none!important}</style></noscript>");
    expect(certs).toContain("data-filter-bar");
  });

  it("hides the second chip row, without removing it, when only one kind of certificate exists", async () => {
    await seed("certification");
    const certs = section(await renderPage(), "certifications");
    expect(filterRow(certs, "Certificates")).toContain('hidden=""');
    expect(filterRow(certs, "Show")).not.toContain("hidden");
    // still there for the client to reveal if another kind appears
    expect(chips(certs).slice(3)).toEqual(["All|1", "Held by ACEVA|1", "Issued by ACEVA|0"]);
  });

  it("keeps the filter and the letters explainer when there are no certifications at all", async () => {
    const certs = section(await renderPage(), "certifications");
    expect(certs).toContain("Nothing published yet");
    expect(certs).toContain("Verified by QR");
    expect(certs).toContain('name="code"');
    expect(chips(certs).slice(0, 3)).toEqual(["All|", "Certifications|0", "Experience letters|"]);
    expect(filterRow(certs, "Certificates")).toContain('hidden=""');
  });

  it("claims no certification count when the registry could not be reached", async () => {
    flags.configured = false;
    const certs = section(await renderPage(), "certifications");
    expect(certs).toContain("Temporarily unavailable");
    expect(chips(certs).slice(0, 3)).toEqual(["All|", "Certifications|", "Experience letters|"]);
    expect(certs).toContain('name="code"');
  });

  it("numbers the four sections 01 to 04 and keeps the sticky index in step", async () => {
    const html = await renderPage();
    const eyebrows = [...html.matchAll(/<p class="[^"]*"><i class="[^"]*"><\/i><b>(\d\d)<\/b><span>([^<]+)<\/span><\/p>/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(eyebrows).toEqual(["01 Financial reports", "02 Company identity", "03 Certifications &amp; letters", "04 Team"]);

    const nav = html.slice(html.indexOf('aria-label="Document categories"'));
    const items = [...nav.slice(0, nav.indexOf("</nav>")).matchAll(/href="#([a-z-]+)"[^>]*><span class="[^"]*" aria-hidden="true">(\d\d)<\/span>([^<]+)</g)].map(
      (m) => `${m[2]} ${m[1]} ${m[3]}`,
    );
    expect(items).toEqual([
      "01 financial-reports Financial reports",
      "02 company-identity Company identity",
      "03 certifications Certifications &amp; letters",
      "04 team Team",
    ]);
    expect(html).not.toContain("people-programs");
    expect(html).not.toContain("Interns, team");
    expect(html).not.toContain("People &amp; program");
  });

  it("alternates the section surfaces paper, paper2, ink, paper", async () => {
    const html = await renderPage();
    const classOf = (id: string) => new RegExp(`<section id="${id}" class="([^"]*)"`).exec(html)?.[1] ?? "";
    const surfaces = ["financial-reports", "company-identity", "certifications", "team"].map((id) => classOf(id).split(" ")[0]);
    expect(surfaces).toEqual([ui.paper, ui.paper2, ui.ink, ui.paper]);
  });
});

describe("the Team section, rendered end to end", () => {
  const team = (html: string) => section(html, "team");

  it("shows consenting public people in rank order under their tier, with the right counts", async () => {
    await seed("program_record", { visibility: "public", holderName: "Zara Founder", title: "Chief Executive", data: { hierarchy_level: "leadership", role_title: "Chief Executive", department: "Executive", record_kind: "employee" } });
    await seed("program_record", { visibility: "public", holderName: "Ibrahim Manager", title: "Engineering Manager", data: { hierarchy_level: "management", role_title: "Engineering Manager", department: "Engineering", reports_to: "zara founder", record_kind: "employee" } });
    await seed("program_record", { visibility: "public", holderName: "Aisha Khan" });

    const html = await renderPage();
    const markup = team(html);
    const order = ["Leadership", "Management", "Interns &amp; trainees"].map((heading) => markup.indexOf(`>${heading}</h3>`));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup).not.toContain("Team leads");
    expect(markup).toContain("Reports to Zara Founder");
    expect(markup).toContain("3 published");
    // three departments => the filter is offered, counted, with every card already in the markup
    expect(chips(markup)).toEqual(["All|3", "Engineering|1", "Executive|1"]);
    expect(markup).toContain("Zara Founder");
    expect(markup).toContain("Ibrahim Manager");
    expect(markup).toContain("Aisha Khan");
  });

  it("lists a profile saved before levels existed as a team member instead of dropping it", async () => {
    await seed("program_record", { visibility: "public", holderName: "Legacy Person" });
    await db.exec("UPDATE documents SET data = data - 'hierarchy_level' - 'role_title'");
    const markup = team(await renderPage());
    expect(markup).toContain("Legacy Person");
    expect(markup).toContain('id="team-tier-member"');
    // the headline stands in for the missing job title
    expect(markup).toContain("Software Engineering Intern");
  });

  it("falls back to team member for a stored level that is no longer known", async () => {
    await seed("program_record", { visibility: "public", holderName: "Odd Level Person" });
    await db.exec("UPDATE documents SET data = jsonb_set(data, '{hierarchy_level}', '\"wizard\"')");
    const markup = team(await renderPage());
    expect(markup).toContain("Odd Level Person");
    expect(markup).toContain('id="team-tier-member"');
    expect(markup).not.toContain("wizard");
  });

  it("never lets a private field, the consent flag or an unconsented person into the page", async () => {
    await seed("program_record", {
      visibility: "public",
      holderName: "Visible Person",
      data: { contact_email: "visible.private@example.com", internal_notes: "TEAM-SECRET-NOTE", show_photo: false },
    });
    await seed("program_record", { visibility: "unlisted", holderName: "Unlisted Person" });
    await seed("program_record", { visibility: "public", holderName: "Withdrawn Person" });
    await db.exec("UPDATE documents SET data = data - 'consent_to_publish' WHERE holder_name = 'Withdrawn Person'");

    const html = await renderPage();
    expect(team(html)).toContain("Visible Person");
    for (const hidden of ["visible.private@example.com", "TEAM-SECRET-NOTE", "Unlisted Person", "Withdrawn Person", "consent_to_publish", "contact_email", "internal_notes"]) {
      expect(html, hidden).not.toContain(hidden);
    }
    expect(html).not.toContain("role=photo");
  });

  it("uses the new empty state when nobody has agreed to be listed", async () => {
    const markup = team(await renderPage());
    expect(markup).toContain("Nothing published yet");
    expect(markup).toContain("People appear here only with their written consent. Nobody is listed until they have agreed.");
  });
});

describe("loadRegistry", () => {
  it("returns grouped public records, and only the listed categories", async () => {
    await seed("certification");
    await seed("experience_letter", { visibility: "unlisted" });
    const registry = await loadRegistry();
    expect(registry.status).toBe("ok");
    if (registry.status === "ok") {
      expect(registry.byCategory.certification).toHaveLength(1);
      expect(Object.keys(registry.byCategory)).toEqual(["financial_report", "company_identity", "certification", "program_record"]);
    }
  });

  it("is 'unavailable' when no database is configured, and logs nothing sensitive when it fails", async () => {
    flags.configured = false;
    expect(await loadRegistry()).toEqual({ status: "unavailable" });

    flags.configured = true;
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    resetDocumentTablesCache();
    setSqlClientForTests(async () => {
      throw new Error("password for user secretuser rejected");
    });
    expect(await loadRegistry()).toEqual({ status: "unavailable" });
    resetDocumentTablesCache();
    expect(JSON.stringify(logged.mock.calls)).not.toContain("secretuser");
  });
});
