import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, request as playwrightRequest, test, type APIRequestContext, type TestInfo } from "@playwright/test";

/**
 * /documents: the public hub.
 *
 * The first group needs nothing but the dev server. The "seeded" group creates real records through
 * the admin API, so it needs the dev server to run with ADMIN_PASSKEY (read from the environment or
 * .env.local here too) and ACEVA_LOCAL_DB=1 or DATABASE_URL; it skips itself, saying why, otherwise.
 * Every record carries a per-run tag and is deleted afterwards, so it is safe to run against a
 * database that already holds real documents.
 */

const RUN = Date.now().toString(36);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PDF = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n% e2e ${RUN}\n%%EOF\n`);
// A real 1x1 PNG, so the photo route has genuine image bytes to serve.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

/** The pass key the dev server was started with: the environment first, then .env.local. */
function readPasskey(): string | null {
  const fromEnv = process.env.ADMIN_PASSKEY?.trim();
  if (fromEnv) return fromEnv;
  const file = path.join(process.cwd(), ".env.local");
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?ADMIN_PASSKEY\s*=\s*(.*?)\s*$/.exec(line);
    if (match) return match[1].replace(/^(["'])(.*)\1$/, "$2") || null;
  }
  return null;
}

/** A stable fake client address per test, so the per-IP rate limits never couple parallel tests. */
function visitorIp(testInfo: TestInfo): string {
  let hash = 0;
  for (const char of `${testInfo.project.name}|${testInfo.titlePath.join(">")}`) hash = (hash * 31 + char.charCodeAt(0)) % 240;
  return `203.0.113.${hash + 10}`;
}

interface Seeded {
  id: string;
  title: string;
  verificationCode: string | null;
}

interface Seeder {
  api: APIRequestContext;
  created: string[];
}

let seederPromise: Promise<Seeder | string> | null = null;

async function openSeeder(baseURL: string, workerIndex: number): Promise<Seeder | string> {
  const passkey = readPasskey();
  if (!passkey) return "ADMIN_PASSKEY is not set (environment or .env.local), so records cannot be seeded through the admin API.";
  const api = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { "x-forwarded-for": `198.51.100.${(workerIndex % 200) + 1}` },
  });
  const login = await api.post("/api/admin/login", { data: { passkey } });
  if (!login.ok()) {
    await api.dispose();
    return `Admin sign-in answered ${login.status()}. Start the dev server with the same ADMIN_PASSKEY (and ACEVA_LOCAL_DB=1) to run the seeded tests.`;
  }
  return { api, created: [] };
}

async function seeder(baseURL: string | undefined, testInfo: TestInfo): Promise<Seeder> {
  seederPromise ??= openSeeder(baseURL ?? "http://127.0.0.1:3100", testInfo.workerIndex);
  const opened = await seederPromise;
  if (typeof opened === "string") {
    test.skip(true, opened);
    throw new Error(opened);
  }
  return opened;
}

async function createRecord(
  { api, created }: Seeder,
  payload: Record<string, unknown>,
  files: { primary?: boolean; photo?: boolean } = { primary: true },
): Promise<Seeded> {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = { payload: JSON.stringify(payload) };
  if (files.primary) multipart.primary = { name: "e2e-document.pdf", mimeType: "application/pdf", buffer: PDF };
  if (files.photo) multipart.photo = { name: "e2e-portrait.png", mimeType: "image/png", buffer: PNG };
  const response = await api.post("/api/admin/documents", { multipart });
  expect(response.status(), await response.text()).toBe(201);
  const { document } = (await response.json()) as { document: Seeded };
  created.push(document.id);
  return document;
}

const certificationPayload = (title: string, overrides: Record<string, unknown> = {}) => ({
  category: "certification",
  title,
  holderName: "ACEVA Technology",
  referenceNo: `ACV/E2E/${RUN}`,
  issuedOn: "2026-01-10",
  status: "published",
  visibility: "public",
  allowDownload: true,
  enableVerification: true,
  data: { direction: "held", issuing_body: "E2E Standards Body", level: "Level 2", skills: ["testing", "security"] },
  ...overrides,
});

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": visitorIp(testInfo) });
});

test.afterAll(async () => {
  const opened = seederPromise ? await seederPromise : null;
  if (!opened || typeof opened === "string") return;
  for (const id of opened.created) await opened.api.delete(`/api/admin/documents/${id}`).catch(() => undefined);
  await opened.api.dispose();
  seederPromise = null;
});

/* ------------------------------------------------------------------ *
 * No data needed                                                       *
 * ------------------------------------------------------------------ */

test.describe("the hub itself", () => {
  test("server HTML carries the whole page with nothing pre-hidden by motion", async ({ request }) => {
    const html = await (await request.get("/documents")).text();
    expect(html).toContain(">Proof</span>");
    expect(html).toContain(">you</span>");
    expect(html).toContain("Verified by QR");
    expect(html).toContain("Three steps, no account, nothing to install.");
    expect(html).not.toContain("data-armed");
  });

  test("keeps its title, canonical metadata and is indexable", async ({ page }) => {
    await page.goto("/documents");
    await expect(page).toHaveTitle(/Documents & Records/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/documents$/);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test("renders one h1, a four-link index and the four sections in order: certifications and letters share one", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Proof you can check instead of promises.");

    const index = page.getByRole("navigation", { name: "Document categories" });
    await expect(index.getByRole("link")).toHaveCount(4);
    const hrefs = await index.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["#financial-reports", "#company-identity", "#certifications", "#team"]);
    await expect(index.getByRole("link", { name: /Certifications & letters/ })).toBeVisible();
    await expect(index.getByRole("link", { name: /Team/ })).toBeVisible();
    await expect(page.locator("section#ids")).toHaveCount(0);
    // experience letters have no section of their own any more: the old id is an anchor inside the merged one
    await expect(page.locator("section#experience-letters")).toHaveCount(0);
    await expect(page.locator("section#certifications #experience-letters")).toHaveCount(1);
    await expect(page.locator("section#people-programs")).toHaveCount(0);

    // the numbers in front of the section titles run 01 to 04
    const numbers = await page.locator("section[aria-labelledby$='-heading'] p b").evaluateAll((nodes) => nodes.map((node) => node.textContent));
    expect(numbers.slice(0, 4)).toEqual(["01", "02", "03", "04"]);

    for (const id of ["financial-reports", "company-identity", "certifications", "team"]) {
      const section = page.locator(`section#${id}`);
      await expect(section).toHaveCount(1);
      await expect(section.getByRole("heading", { level: 2 })).toHaveCount(1);
      // every section is named by its own heading
      const labelledBy = await section.getAttribute("aria-labelledby");
      expect(labelledBy).toBe(`${id}-heading`);
      await expect(page.locator(`#${id}-heading`)).toBeVisible();
    }
  });

  test("an index link jumps to its section and clears the sticky bars", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("navigation", { name: "Document categories" }).getByRole("link", { name: /Certifications/ }).click();
    await expect(page).toHaveURL(/#certifications$/);
    const heading = page.locator("#certifications-heading");
    // The page scrolls smoothly, so wait for it to settle: below the header pill and the index, not hidden beneath them.
    await expect
      .poll(() => heading.evaluate((element) => Math.round(element.getBoundingClientRect().top)), { message: "heading rests clear of the sticky bars" })
      .toBeGreaterThan(110);
    await expect(heading).toBeInViewport();
  });

  test("every listed section shows either its records or an honest empty state, never both", async ({ page }) => {
    await page.goto("/documents");
    for (const id of ["financial-reports", "company-identity", "certifications", "team"]) {
      const section = page.locator(`section#${id}`);
      // the combined section also holds the letters explainer (lists of its own), so count only the certificate panel
      const scope = id === "certifications" ? section.locator('[data-panel="certifications"]') : section;
      const records = await scope.locator("ul > li").count();
      const empty = await section.getByText("Nothing published yet").count();
      const unavailable = await section.getByText("Temporarily unavailable").count();
      expect(empty + unavailable <= 1, `${id}: more than one empty state`).toBe(true);
      if (records > 0) expect(empty + unavailable, `${id}: records and an empty state together`).toBe(0);
      else expect(empty + unavailable, `${id}: neither records nor an empty state`).toBe(1);
    }
  });

  test("the letters half of the combined section explains QR verification and takes a code, but lists nothing", async ({ page }) => {
    await page.goto("/documents");
    const section = page.locator('section#certifications [data-panel="letters"]');
    await expect(section.getByText("Verified by QR")).toBeVisible();
    await expect(section.getByText("A verifier sees")).toBeVisible();
    await expect(section.getByText("Always kept private")).toBeVisible();
    await expect(section.getByRole("textbox")).toHaveCount(1);
    await expect(page.locator("section#certifications").getByText(/letters never listed/i)).toBeVisible();
    // what stays private is named, derived from the category's own fields
    await expect(section.getByText("Responsibilities")).toBeVisible();
  });

  test("a code typed into a panel goes to its result page, however it is spelled", async ({ page }) => {
    await page.goto("/documents");
    const box = page.locator('section#certifications [data-panel="letters"]').getByRole("textbox");
    await box.fill("acv7k3m9qxd4trh");
    await expect(box).toHaveValue("ACV-7K3M-9QXD-4TRH");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/verify\/ACV-7K3M-9QXD-4TRH$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("an incomplete code is refused in place, with a message, not sent away", async ({ page }) => {
    await page.goto("/documents");
    const panel = page.locator('section#certifications [data-panel="letters"]');
    await panel.getByRole("textbox").fill("ACV-7K3M");
    await panel.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(panel.getByRole("alert")).toContainText("not a full verification code");
    await expect(page).toHaveURL(/\/documents$/);
  });

  test("explains verification in three steps and closes with both calls to action", async ({ page }) => {
    await page.goto("/documents");
    const steps = page.locator("#how-verification-works li");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Scan");
    await expect(steps.nth(1)).toContainText("Check");
    await expect(steps.nth(2)).toContainText("Trust");
    await expect(page.getByRole("link", { name: "Verify a document" }).first()).toHaveAttribute("href", "/verify");
    await expect(page.getByRole("link", { name: "Contact", exact: true }).first()).toHaveAttribute("href", "/contact");
  });

  test("is reachable from the footer, together with the verify page", async ({ page }) => {
    await page.goto("/about");
    const footer = page.locator("footer").getByRole("navigation", { name: "Footer" });
    await expect(footer.getByRole("link", { name: "Documents", exact: true })).toHaveAttribute("href", "/documents");
    await expect(footer.getByRole("link", { name: "Verify a document" })).toHaveAttribute("href", "/verify");
  });

  test("lists /documents in the sitemap and keeps the verification pages out of the crawl", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/documents<");
    expect(sitemap).not.toContain("/verify");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /verify/");
    expect(robots).toContain("Disallow: /api/");
  });

  test("no horizontal scroll, and every control in the index is at least 44px tall", async ({ page }) => {
    await page.goto("/documents");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const heights = await page
      .getByRole("navigation", { name: "Document categories" })
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5);
  });

  test("mobile: the index scrolls inside itself and the page does not", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "The sideways-scrolling index is a narrow-screen behaviour");
    await page.goto("/documents");
    const metrics = await page.getByRole("navigation", { name: "Document categories" }).locator("ol").evaluate((list) => ({
      scrollWidth: list.scrollWidth,
      clientWidth: list.clientWidth,
      viewport: window.innerWidth,
    }));
    expect(metrics.clientWidth).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  });

  test("reduced motion: the hero shows its finished state with nothing animating", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/documents");
    const animated = await page.locator("main h1 span span").first().evaluate((element) => getComputedStyle(element).animationName);
    expect(animated).toBe("none");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

/* ------------------------------------------------------------------ *
 * Records seeded through the admin API                                 *
 * ------------------------------------------------------------------ */

test.describe("with records in the registry", () => {
  test("a published public certificate appears with its seal, QR, verify link and file actions", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const title = `E2E Certificate ${RUN} ${testInfo.project.name}`;
    const record = await createRecord(store, certificationPayload(title));
    const code = record.verificationCode as string;
    expect(code).toMatch(/^ACV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);

    await page.goto("/documents");
    const card = page.locator("#certifications article", { has: page.getByRole("heading", { name: title }) });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Held by ACEVA");
    await expect(card).toContainText("E2E Standards Body");
    await expect(card).toContainText("testing");

    const qr = card.getByRole("img", { name: new RegExp(`QR code.*${escapeRegExp(title)}`) });
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute("src", /^data:image\/svg\+xml;base64,/);

    const verify = card.getByRole("link", { name: /Verify this certificate/ });
    await expect(verify).toHaveAttribute("href", `/verify/${code}`);
    await expect(card.getByRole("link", { name: /^View/ })).toHaveAttribute("href", `/api/documents/${record.id}/file?role=primary`);
    await expect(card.getByRole("link", { name: /^Download/ })).toHaveAttribute("href", `/api/documents/${record.id}/file?role=primary&download=1`);

    await verify.click();
    await expect(page).toHaveURL(new RegExp(`/verify/${code}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record is valid.");
  });

  test("the file link serves the PDF with the file-specific CSP that lets a browser draw it", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const record = await createRecord(store, certificationPayload(`E2E File ${RUN} ${testInfo.project.name}`));
    const inline = await page.request.get(`/api/documents/${record.id}/file?role=primary`);
    expect(inline.status()).toBe(200);
    expect(inline.headers()["content-type"]).toBe("application/pdf");
    expect(inline.headers()["content-disposition"]).toMatch(/^inline;/);
    expect(inline.headers()["x-content-type-options"]).toBe("nosniff");
    // next.config.ts applies a stricter site-wide policy (object-src 'none'); the file route must win over it
    expect(inline.headers()["content-security-policy"]).toContain("object-src 'self'");
    expect(inline.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(Buffer.from(await inline.body()).equals(PDF)).toBe(true);

    const attachment = await page.request.get(`/api/documents/${record.id}/file?role=primary&download=1`);
    expect(attachment.headers()["content-disposition"]).toMatch(/^attachment;/);
  });

  test("a document with public download off lists a request link and exposes no file URL", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const title = `E2E No Download ${RUN} ${testInfo.project.name}`;
    const record = await createRecord(store, certificationPayload(title, { allowDownload: false }));
    await page.goto("/documents");
    const card = page.locator("#certifications article", { has: page.getByRole("heading", { name: title }) });
    await expect(card.getByText("On request.")).toBeVisible();
    await expect(card.locator('a[href*="/file?"]')).toHaveCount(0);
    expect((await page.request.get(`/api/documents/${record.id}/file`)).status()).toBe(404);
  });

  test("unlisted, private and draft records are never listed, but an unlisted one still verifies by code", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN}-${testInfo.project.name}`;
    const letter = await createRecord(store, {
      category: "experience_letter",
      title: `E2E Letter ${tag}`,
      holderName: `Unlisted Person ${tag}`,
      referenceNo: `ACV/EL/E2E/${tag}`,
      issuedOn: "2026-02-01",
      status: "published",
      visibility: "unlisted",
      allowDownload: true,
      enableVerification: true,
      data: { designation: "Engineer", employment_type: "full_time", start_date: "2024-01-01", currently_employed: true, signatory_name: "Head of People" },
    });
    await createRecord(store, certificationPayload(`E2E Private ${tag}`, { visibility: "private" }));
    await createRecord(store, certificationPayload(`E2E Draft ${tag}`, { status: "draft" }));

    const html = await (await page.request.get("/documents")).text();
    for (const hidden of [`Unlisted Person ${tag}`, `E2E Letter ${tag}`, `E2E Private ${tag}`, `E2E Draft ${tag}`]) {
      expect(html, hidden).not.toContain(hidden);
    }

    await page.goto(`/verify/${letter.verificationCode}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record is valid.");
    await expect(page.getByText(`Unlisted Person ${tag}`)).toBeVisible();
  });

  test("a person appears only with consent, shows a monogram without a photo, and the photo when they opted in", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN}-${testInfo.project.name}`;
    const person = (name: string, extra: Record<string, unknown>, data: Record<string, unknown>) => ({
      category: "program_record",
      title: `E2E Intern ${name}`,
      holderName: name,
      status: "published",
      allowDownload: false,
      enableVerification: true,
      data: {
        hierarchy_level: "trainee",
        role_title: "E2E Frontend Intern",
        record_kind: "intern",
        program_name: "E2E Summer",
        cohort: "Cohort 03",
        start_date: "2026-06-01",
        record_status: "alumni",
        ...data,
      },
      ...extra,
    });

    const withPhoto = `Photo Person ${tag}`;
    const noPhoto = `Plain Person ${tag}`;
    const unlisted = `Hidden Person ${tag}`;
    await createRecord(store, person(withPhoto, { visibility: "public" }, { consent_to_publish: true, show_photo: true }), { photo: true });
    await createRecord(store, person(noPhoto, { visibility: "public" }, { consent_to_publish: true }), {});
    await createRecord(store, person(unlisted, { visibility: "unlisted" }, {}), { photo: true });

    await page.goto("/documents");
    const section = page.locator("#team");
    await expect(section.getByRole("heading", { name: withPhoto })).toBeVisible();
    await expect(section.getByRole("heading", { name: noPhoto })).toBeVisible();
    await expect(section.getByText(unlisted)).toHaveCount(0);

    const photoCard = section.locator("article", { has: page.getByRole("heading", { name: withPhoto }) });
    const image = photoCard.getByRole("img", { name: `Portrait of ${withPhoto}` });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", /\/file\?role=photo$/);
    await expect.poll(async () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    const plainCard = section.locator("article", { has: page.getByRole("heading", { name: noPhoto }) });
    await expect(plainCard.locator("img")).toHaveCount(0);
    await expect(plainCard).toContainText("Cohort 03");
  });

  test("the team is shown as tiers in rank order, with counts, reporting lines and a department filter", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN}-${testInfo.project.name}`;
    const member = (name: string, level: string, data: Record<string, unknown>) => ({
      category: "program_record",
      title: `E2E ${name}`,
      holderName: name,
      status: "published",
      visibility: "public",
      allowDownload: false,
      enableVerification: true,
      data: {
        hierarchy_level: level,
        role_title: `${name} role`,
        record_kind: "employee",
        start_date: "2024-01-01",
        record_status: "active",
        consent_to_publish: true,
        ...data,
      },
    });

    const boss = `Boss ${tag}`;
    const lead = `Lead ${tag}`;
    const intern = `Intern ${tag}`;
    await createRecord(store, member(boss, "leadership", { department: `E2E Exec ${tag}` }), {});
    await createRecord(store, member(lead, "team_lead", { department: `E2E Eng ${tag}`, reports_to: boss.toUpperCase() }), {});
    await createRecord(store, member(intern, "trainee", { department: `E2E Eng ${tag}`, reports_to: `Someone Outside ${tag}` }), {});

    await page.goto("/documents");
    const team = page.locator("section#team");

    // tiers appear in rank order; the connector pieces are only decoration
    const headings = await team.locator("h3[id^='team-tier-']").evaluateAll((nodes) => nodes.map((node) => node.id));
    const order = ["leadership", "team_lead", "trainee"].map((level) => headings.indexOf(`team-tier-${level}`));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // a reporting line to a listed person uses that person's own spelling and is plain text; an outsider is printed as typed
    const leadCard = team.locator("article", { has: page.getByRole("heading", { name: lead }) });
    await expect(leadCard).toContainText(`Reports to ${boss}`);
    await expect(leadCard.getByRole("link", { name: new RegExp(boss) })).toHaveCount(0);
    await expect(team.locator("article", { has: page.getByRole("heading", { name: intern }) })).toContainText(`Reports to Someone Outside ${tag}`);

    // with 2+ departments the filter exists; choosing one hides the others' cards and empties a tier without removing it
    const filter = team.getByRole("group", { name: "Department" });
    await expect(filter).toBeVisible();
    const eng = filter.getByRole("button", { name: new RegExp(`E2E Eng ${tag}`) });
    await expect(eng).toHaveAttribute("aria-pressed", "false");
    await eng.click();
    await expect(eng).toHaveAttribute("aria-pressed", "true");
    await expect(team.getByRole("heading", { name: boss })).toBeHidden();
    await expect(team.getByRole("heading", { name: lead })).toBeVisible();
    await expect(team.getByRole("heading", { name: intern })).toBeVisible();
    await expect(team.getByRole("status")).toContainText(`in E2E Eng ${tag}`);
    await expect(team.locator("#team-tier-leadership")).toBeHidden();

    await filter.getByRole("button", { name: /^All/ }).click();
    await expect(team.getByRole("heading", { name: boss })).toBeVisible();
  });

  test("certifications and letters share one filtered section: the chips toggle the panels and the held / issued cards", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN}-${testInfo.project.name}`;
    const heldTitle = `E2E Held ${tag}`;
    const issuedTitle = `E2E Issued ${tag}`;
    await createRecord(store, certificationPayload(heldTitle));
    await createRecord(store, certificationPayload(issuedTitle, { data: { direction: "issued", issuing_body: "ACEVA Technology" } }));

    await page.goto("/documents");
    const section = page.locator("section#certifications");
    const certs = section.locator('[data-panel="certifications"]');
    const letters = section.locator('[data-panel="letters"]');
    const views = section.getByRole("group", { name: "Show" });
    const directions = section.getByRole("group", { name: "Certificates" });

    // everything is visible by default
    await expect(views.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    await expect(certs).toBeVisible();
    await expect(letters).toBeVisible();
    await expect(section.getByRole("heading", { name: heldTitle })).toBeVisible();
    await expect(directions).toBeVisible();

    await views.getByRole("button", { name: "Experience letters" }).click();
    await expect(certs).toBeHidden();
    await expect(letters).toBeVisible();
    await expect(directions).toBeHidden();
    await expect(section.getByRole("status")).toContainText("Showing experience letters");

    await views.getByRole("button", { name: /^Certifications/ }).click();
    await expect(certs).toBeVisible();
    await expect(letters).toBeHidden();
    await expect(directions).toBeVisible();
    await expect(section.getByRole("status")).toContainText(/Showing \d+ certifications?\./);

    await directions.getByRole("button", { name: /Issued by ACEVA/ }).click();
    await expect(section.getByRole("heading", { name: issuedTitle })).toBeVisible();
    await expect(section.getByRole("heading", { name: heldTitle })).toBeHidden();
    await directions.getByRole("button", { name: /^All/ }).click();
    await expect(section.getByRole("heading", { name: heldTitle })).toBeVisible();
  });

  test("the old #experience-letters link lands in the merged section and selects the Experience letters filter", async ({ page }) => {
    await page.goto("/documents#experience-letters");
    const section = page.locator("section#certifications");
    await expect(section.getByRole("button", { name: "Experience letters" })).toHaveAttribute("aria-pressed", "true");
    await expect(section.locator('[data-panel="certifications"]')).toBeHidden();
    await expect(section.locator('[data-panel="letters"]')).toBeVisible();

    // following the link again from within the page (a hashchange) does the same
    await page.getByRole("button", { name: "All", exact: true }).first().click();
    await expect(section.locator('[data-panel="certifications"]')).toBeVisible();
    await page.evaluate(() => {
      window.location.hash = "#team";
      window.location.hash = "#experience-letters";
    });
    await expect(section.locator('[data-panel="certifications"]')).toBeHidden();
  });

  test("the filter chips are at least 44px tall and keep a visible focus ring", async ({ page }) => {
    await page.goto("/documents");
    // the view row is always shown; the held / issued row hides when only one kind of certificate exists
    const chips = page.locator("section#certifications").getByRole("group", { name: "Show" }).getByRole("button");
    const heights = await chips.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThanOrEqual(3);
    for (const height of heights) expect(height).toBeGreaterThanOrEqual(43.5);

    await chips.first().focus();
    // a key press makes the browser treat focus as keyboard focus, which is what :focus-visible answers to
    await page.keyboard.press("Shift");
    const outline = await chips.first().evaluate((button) => getComputedStyle(button).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("on a narrow screen the seeded content still does not scroll sideways", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const longTitle = `E2E Long ${RUN} Information Security Management System Certification With An Unreasonably Long Title ${testInfo.project.name}`;
    await createRecord(store, certificationPayload(longTitle, { referenceNo: "ACV/E2E/A-VERY-LONG-REFERENCE-NUMBER-THAT-KEEPS-GOING-0000000000001" }));
    await page.goto("/documents");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/* ------------------------------------------------------------------ *
 * Without JavaScript                                                   *
 * ------------------------------------------------------------------ */

test.describe("the server-rendered page, before any script runs", () => {
  // Checked on the raw HTML, not in a browser with JavaScript off: a page that streams from the server keeps its
  // content inside a hidden holder until a script moves it into place, for every dynamic page on the site, so a
  // no-script browser cannot show it. What this section controls is what the HTML says by default.
  test("the combined section ships both halves visible by default, and hides chips that could not work", async ({ request }) => {
    const html = await (await request.get("/documents")).text();
    expect(html).toMatch(/<div data-panel="certifications">/);
    expect(html).toMatch(/<div data-panel="letters">/);
    expect(html).not.toMatch(/<div data-panel="(certifications|letters)" hidden/);
    expect(html).toContain("Verified by QR");
    expect(html).toContain('id="experience-letters"');
    // Without scripts the chips would do nothing, so a no-script style hides them.
    expect(html).toContain("<noscript><style>[data-filter-bar]{display:none!important}</style></noscript>");
  });
});
