import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

/**
 * /verify and /verify/<code>.
 *
 * The first group needs only the dev server. The "seeded" group creates records through the admin
 * API, so it needs the dev server to run with ADMIN_PASSKEY (taken from the environment or
 * .env.local here too) and ACEVA_LOCAL_DB=1 or DATABASE_URL; it skips itself, saying why, otherwise.
 * Records carry a per-run tag and are deleted afterwards.
 */

const RUN = Date.now().toString(36);
const UNKNOWN_CODE = "ACV-0000-0000-0000";

const PDF = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n% verify ${RUN}\n%%EOF\n`);
const PDF_SHA256 = createHash("sha256").update(PDF).digest("hex");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/* ------------------------------------------------------------------ *
 * Helpers                                                              *
 * ------------------------------------------------------------------ */

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
  return `192.0.2.${hash + 10}`;
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
    extraHTTPHeaders: { "x-forwarded-for": `198.18.0.${(workerIndex % 200) + 1}` },
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
  if (files.primary) multipart.primary = { name: "verify-e2e.pdf", mimeType: "application/pdf", buffer: PDF };
  if (files.photo) multipart.photo = { name: "verify-e2e.png", mimeType: "image/png", buffer: PNG };
  const response = await api.post("/api/admin/documents", { multipart });
  expect(response.status(), await response.text()).toBe(201);
  const { document } = (await response.json()) as { document: Seeded };
  created.push(document.id);
  return document;
}

async function revoke({ api }: Seeder, id: string): Promise<void> {
  const response = await api.post(`/api/admin/documents/${id}/actions`, { data: { action: "revoke", reason: "e2e" } });
  expect(response.ok(), await response.text()).toBe(true);
}

const certification = (title: string, overrides: Record<string, unknown> = {}) => ({
  category: "certification",
  title,
  holderName: `E2E Holder ${RUN}`,
  referenceNo: `ACV/E2E/${RUN}`,
  issuedOn: "2026-01-10",
  status: "published",
  visibility: "public",
  allowDownload: true,
  enableVerification: true,
  data: { direction: "held", issuing_body: "E2E Standards Body", level: "Level 2", skills: ["testing"] },
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

/** Skips, with the reason, when the registry cannot be reached (no database configured for the dev server). */
async function skipIfRegistryDown(page: Page): Promise<void> {
  const down = await page.getByRole("heading", { level: 1, name: "Verification is temporarily unavailable." }).count();
  test.skip(down > 0, "The registry is unreachable: start the dev server with ACEVA_LOCAL_DB=1 or DATABASE_URL.");
}

/* ------------------------------------------------------------------ *
 * /verify                                                              *
 * ------------------------------------------------------------------ */

test.describe("the verify form", () => {
  test("server HTML carries the page, a plain GET form and nothing pre-hidden by motion", async ({ request }) => {
    const html = await (await request.get("/verify")).text();
    expect(html).toContain("Check a document.");
    expect(html).toMatch(/<form[^>]*action="\/verify"[^>]*method="get"/);
    expect(html).toContain('name="code"');
    expect(html).not.toContain("data-armed");
  });

  test("is noindex, and says how to scan", async ({ page }) => {
    await page.goto("/verify");
    await expect(page).toHaveTitle(/Verify a Document/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check a document.");
    await expect(page.getByText("Scan the QR on the document with your phone camera. It opens this page automatically.")).toBeVisible();
    for (const answer of ["Valid", "Expired", "Revoked", "Not found"]) {
      await expect(page.getByRole("heading", { level: 3, name: answer })).toBeVisible();
    }
  });

  test("formats a messy code as it is typed", async ({ page }) => {
    await page.goto("/verify");
    const box = page.getByRole("textbox", { name: "Verification code" });
    await box.pressSequentially("acv 7k3m-9qxd 4trh");
    await expect(box).toHaveValue("ACV-7K3M-9QXD-4TRH");
    await box.fill("");
    await box.fill("7k3m9qxd4trh");
    await expect(box).toHaveValue("ACV-7K3M-9QXD-4TRH");
    await box.fill("  acv7k3m9qxd4trh  ");
    await expect(box).toHaveValue("ACV-7K3M-9QXD-4TRH");
  });

  test("goes to the canonical result URL, however the code was typed", async ({ page }) => {
    await page.goto("/verify");
    await page.getByRole("textbox", { name: "Verification code" }).fill("acv.0000.0000.0000");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/verify/${UNKNOWN_CODE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("refuses an incomplete code in place, with a message and focus on the box", async ({ page }) => {
    await page.goto("/verify");
    const box = page.getByRole("textbox", { name: "Verification code" });
    await box.fill("ACV-7K3M");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("not a full verification code");
    await expect(box).toBeFocused();
    await expect(box).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/verify$/);
  });

  test("works as a plain link too: ?code= redirects to the result page, and a bad one comes back to the form", async ({ page }) => {
    await page.goto("/verify?code=acv0000-0000-0000");
    await expect(page).toHaveURL(new RegExp(`/verify/${UNKNOWN_CODE}$`));

    await page.goto("/verify?code=zzz");
    await expect(page).toHaveURL(/\/verify\?code=zzz$/);
    await expect(page.locator("form").getByRole("alert")).toContainText("not a full verification code");
    await expect(page.getByRole("textbox", { name: "Verification code" })).toHaveValue("ACV-ZZZ");
  });

  test("no horizontal scroll, and the field and button are comfortably tall", async ({ page }) => {
    await page.goto("/verify");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const control of [page.getByRole("textbox", { name: "Verification code" }), page.getByRole("button", { name: "Verify", exact: true })]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});

/* ------------------------------------------------------------------ *
 * /verify/<code>: with nothing seeded                                  *
 * ------------------------------------------------------------------ */

test.describe("an unknown or malformed code", () => {
  test("shows the neutral page: 200, noindex, no store, nothing about whether the code ever existed", async ({ page }) => {
    const response = await page.goto(`/verify/${UNKNOWN_CODE}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["cache-control"]).toMatch(/no-store|no-cache/);
    await skipIfRegistryDown(page);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not verify this code.");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('[data-kind="not_found"]').first()).toBeVisible();
    await expect(page.locator("main article")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Verify another" })).toHaveAttribute("href", "/verify");
    await expect(page.getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", /^mailto:contact@acevatech\.com\?subject=/);
    await expect(page.locator("main")).not.toContainText(/revoked|expired|deleted|private|draft/i);
  });

  test("treats a malformed code exactly the same way, without echoing it", async ({ page }) => {
    const response = await page.goto("/verify/not-a-code-at-all");
    expect(response?.status()).toBe(200);
    await skipIfRegistryDown(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not verify this code.");
    await expect(page.locator("main")).not.toContainText("not-a-code-at-all");
    const mailto = await page.getByRole("link", { name: "Report a problem" }).getAttribute("href");
    expect(decodeURIComponent(mailto ?? "")).not.toContain("not-a-code-at-all");
  });

  test("tells a spent lookup budget apart from a verdict", async ({ page }, testInfo) => {
    // explicit headers: the lookups must come from the same address the page visit will use
    const headers = { "x-forwarded-for": visitorIp(testInfo) };
    for (let i = 0; i < 30; i += 1) await page.request.get("/verify/nonsense", { headers });
    await page.goto(`/verify/${UNKNOWN_CODE}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Too many lookups just now.");
    await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute("href", `/verify/${UNKNOWN_CODE}`);
    await expect(page.locator('[data-kind="rate_limited"]').first()).toBeVisible();
    await expect(page.getByText("Checked just now")).toHaveCount(0);
  });

  test("the JSON endpoint answers the same neutral shape, and the 31st lookup is limited", async ({ request }, testInfo) => {
    const headers = { "x-forwarded-for": `${visitorIp(testInfo)}` };
    const first = await request.get(`/api/verify/${UNKNOWN_CODE}`, { headers });
    expect(first.status()).toBe(200);
    expect(first.headers()["cache-control"]).toBe("no-store");
    expect(first.headers()["access-control-allow-origin"]).toBeUndefined();
    const body = (await first.json()) as Record<string, unknown>;
    if (body.code === "SERVICE_UNAVAILABLE") test.skip(true, "The registry is unreachable: start the dev server with ACEVA_LOCAL_DB=1 or DATABASE_URL.");
    expect(body).toMatchObject({ ok: true, state: "not_found" });
    expect("document" in body).toBe(false);

    let last = first;
    for (let i = 0; i < 30; i += 1) last = await request.get("/api/verify/nonsense", { headers });
    expect(last.status()).toBe(429);
    expect(((await last.json()) as { code: string }).code).toBe("RATE_LIMITED");
  });

  test("no horizontal scroll", async ({ page }) => {
    await page.goto(`/verify/${UNKNOWN_CODE}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("the seal and motion", () => {
  test("draws itself when motion is allowed", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/verify/${UNKNOWN_CODE}`);
    const name = await page.locator('svg circle[pathLength="1"]').first().evaluate((element) => getComputedStyle(element).animationName);
    expect(name).not.toBe("none");
  });

  test("reduced motion: the finished seal is shown and nothing animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/verify/${UNKNOWN_CODE}`);
    const state = await page.locator('svg circle[pathLength="1"]').first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { animation: style.animationName, dashoffset: style.strokeDashoffset };
    });
    expect(state.animation).toBe("none");
    expect(parseFloat(state.dashoffset)).toBe(0);
    // the verdict is still plainly visible as text and as a mark
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await page.locator('svg:has(circle[pathLength="1"])').first().boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(100);
  });
});

/* ------------------------------------------------------------------ *
 * /verify/<code>: records seeded through the admin API                 *
 * ------------------------------------------------------------------ */

test.describe("with records in the registry", () => {
  test("a valid record: seal, paper card, facts, file, fingerprint and the way out", async ({ page, baseURL, context }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const title = `E2E Valid ${RUN} ${testInfo.project.name}`;
    const record = await createRecord(store, certification(title));
    const code = record.verificationCode as string;

    await page.goto(`/verify/${code}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record is valid.");
    await expect(page.locator('[data-kind="valid"]').first()).toBeVisible();

    const card = page.locator("main article");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(title);
    await expect(card).toContainText("Awarded to");
    await expect(card).toContainText(`E2E Holder ${RUN}`);
    await expect(card).toContainText("Certificate no.");
    await expect(card).toContainText("10 Jan 2026");
    await expect(card).toContainText("Held by ACEVA");
    await expect(card).toContainText("E2E Standards Body");

    // freshness: a UTC timestamp from the last minute
    const stamp = await page.locator("time").first().getAttribute("datetime");
    expect(Date.now() - Date.parse(stamp ?? "")).toBeLessThan(60_000);
    await expect(page.getByText("Checked just now")).toBeVisible();
    await expect(page.locator("time").first()).toContainText("UTC");

    // the file and its fingerprint
    await expect(card.getByText(PDF_SHA256)).toBeVisible();
    const open = card.getByRole("link", { name: /^View/ });
    await expect(open).toHaveAttribute("href", `/api/documents/${record.id}/file?role=primary&code=${code}`);
    await expect(card.getByRole("link", { name: /^Download/ })).toHaveAttribute("href", `/api/documents/${record.id}/file?role=primary&code=${code}&download=1`);
    const file = await page.request.get(`/api/documents/${record.id}/file?role=primary&code=${code}`);
    expect(file.status()).toBe(200);
    expect(createHash("sha256").update(await file.body()).digest("hex")).toBe(PDF_SHA256);

    await card.getByText("How to compare this with your copy").click();
    await expect(card.getByText("shasum -a 256")).toBeVisible();

    await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await card.getByRole("button", { name: "Copy" }).click();
    await expect(card.getByRole("status")).toHaveText("Fingerprint copied to the clipboard");

    // the way out
    await expect(page.getByRole("link", { name: "Verify another" })).toHaveAttribute("href", "/verify");
    const report = await page.getByRole("link", { name: "Report a problem" }).getAttribute("href");
    expect(decodeURIComponent(report ?? "")).toContain(`Verification problem: ${code}`);
  });

  test("any spelling of the code reaches the same record", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const record = await createRecord(store, certification(`E2E Spelling ${RUN} ${testInfo.project.name}`));
    const code = record.verificationCode as string;
    for (const spelled of [code.toLowerCase(), code.replaceAll("-", ""), code.replaceAll("-", "%20")]) {
      await page.goto(`/verify/${spelled}`);
      await expect(page.getByRole("heading", { level: 1 }), spelled).toHaveText("This record is valid.");
    }
  });

  test("an expired record says so, in words and on the date", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const record = await createRecord(store, certification(`E2E Expired ${RUN} ${testInfo.project.name}`, { issuedOn: "2019-01-01", expiresOn: "2020-01-01" }));
    await page.goto(`/verify/${record.verificationCode}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record has expired.");
    await expect(page.locator('[data-kind="expired"]').first()).toBeVisible();
    await expect(page.locator("main article")).toContainText("1 Jan 2020 (expired)");
    await expect(page.locator("main article")).toContainText(`E2E Expired ${RUN}`);
  });

  test("a revoked record shows the minimal view, with no holder, no file and no photo", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const title = `E2E Revoked ${RUN} ${testInfo.project.name}`;
    const record = await createRecord(store, certification(title));
    await revoke(store, record.id);

    await page.goto(`/verify/${record.verificationCode}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record has been revoked.");
    await expect(page.locator('[data-kind="revoked"]').first()).toBeVisible();
    const card = page.locator("main article");
    await expect(card).toContainText(title);
    await expect(card).toContainText("Revoked on");
    await expect(card).not.toContainText(`E2E Holder ${RUN}`);
    await expect(card).not.toContainText("E2E Standards Body");
    await expect(card).not.toContainText("SHA-256");
    await expect(card.locator('a[href*="/file?"]')).toHaveCount(0);

    // and the file itself is gone from the public route
    expect((await page.request.get(`/api/documents/${record.id}/file?role=primary&code=${record.verificationCode}`)).status()).toBe(404);
    const api = await page.request.get(`/api/verify/${record.verificationCode}`);
    const body = (await api.json()) as { state: string; document: { holderName: string; file: unknown } };
    expect(body.state).toBe("revoked");
    expect(body.document.holderName).toBe("");
    expect(body.document.file).toBeNull();
  });

  test("a draft, a private record and an archived one look exactly like an unknown code", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN} ${testInfo.project.name}`;
    const draft = await createRecord(store, certification(`E2E Draft ${tag}`, { status: "draft" }));
    const hidden = await createRecord(store, certification(`E2E Private ${tag}`, { visibility: "private" }));
    const archived = await createRecord(store, certification(`E2E Archived ${tag}`));
    const archive = await store.api.post(`/api/admin/documents/${archived.id}/actions`, { data: { action: "archive" } });
    expect(archive.ok(), await archive.text()).toBe(true);

    for (const record of [draft, hidden, archived]) {
      await page.goto(`/verify/${record.verificationCode}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("We could not verify this code.");
      await expect(page.locator("main")).not.toContainText(record.title);
      await expect(page.locator("main article")).toHaveCount(0);
    }
  });

  test("an unlisted record verifies by code, and its photo shows only when the holder opted in", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const tag = `${RUN}-${testInfo.project.name}`;
    const person = (name: string, show: boolean) => ({
      category: "program_record",
      title: `E2E Record ${name}`,
      holderName: name,
      status: "published",
      visibility: "unlisted",
      allowDownload: false,
      enableVerification: true,
      data: {
        hierarchy_level: "management",
        role_title: "E2E Engineering Manager",
        reports_to: "E2E Head of Engineering",
        record_kind: "employee",
        start_date: "2026-06-01",
        record_status: "active",
        show_photo: show,
        contact_email: `private-${tag}@example.com`,
        internal_notes: `private-note-${tag}`,
      },
    });
    const shown = await createRecord(store, person(`Shown Person ${tag}`, true), { photo: true });
    const hiddenPhoto = await createRecord(store, person(`Private Photo ${tag}`, false), { photo: true });

    await page.goto(`/verify/${shown.verificationCode}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record is valid.");
    const image = page.getByRole("img", { name: `Photo of Shown Person ${tag}` });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator("main")).not.toContainText(`private-${tag}@example.com`);
    await expect(page.locator("main")).not.toContainText(`private-note-${tag}`);
    // The record is a team profile: it names itself so, and shows its public position fields.
    await expect(page.locator("article").first()).toContainText("Team member");
    await expect(page.locator("article").first()).toContainText("Management");
    await expect(page.locator("article").first()).toContainText("E2E Engineering Manager");
    await expect(page.locator("article").first()).toContainText("E2E Head of Engineering");

    await page.goto(`/verify/${hiddenPhoto.verificationCode}`);
    await expect(page.getByText(`Private Photo ${tag}`).first()).toBeVisible();
    await expect(page.locator("article img")).toHaveCount(0);
    // the photo URL, even with the right code, is refused when the holder has not opted in
    expect((await page.request.get(`/api/documents/${hiddenPhoto.id}/file?role=photo&code=${hiddenPhoto.verificationCode}`)).status()).toBe(404);
    // and an unlisted photo without the code is refused too
    expect((await page.request.get(`/api/documents/${shown.id}/file?role=photo`)).status()).toBe(404);
  });

  test("the JSON endpoint returns the same public projection the page shows", async ({ request, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const record = await createRecord(store, certification(`E2E Json ${RUN} ${testInfo.project.name}`));
    const response = await request.get(`/api/verify/${record.verificationCode}`, { headers: { "x-forwarded-for": visitorIp(testInfo) } });
    expect(response.status()).toBe(200);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    const body = (await response.json()) as { ok: boolean; state: string; checkedAt: string; document: Record<string, unknown> };
    expect(body).toMatchObject({ ok: true, state: "valid" });
    expect(body.document).toMatchObject({ id: record.id, title: record.title, hasFile: true, state: "valid" });
    expect((body.document.file as { sha256: string }).sha256).toBe(PDF_SHA256);
    expect(JSON.stringify(body)).not.toMatch(/internal_notes|contact_email|consent_to_publish/);
  });

  test("a long title and a 64-character fingerprint never push the page sideways", async ({ page, baseURL }, testInfo) => {
    const store = await seeder(baseURL, testInfo);
    const record = await createRecord(
      store,
      certification(`E2E Long ${RUN} Information Security Management System Certification With An Unreasonably Long Title ${testInfo.project.name}`, {
        referenceNo: "ACV/E2E/A-VERY-LONG-REFERENCE-NUMBER-THAT-KEEPS-GOING-0000000000001",
        holderName: "A Holder With A Very Long Name That Goes On And On Across The Whole Card",
      }),
    );
    await page.goto(`/verify/${record.verificationCode}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This record is valid.");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const control of await page.locator("article a, article button, article summary").all()) {
      expect((await control.boundingBox())?.height ?? 44).toBeGreaterThanOrEqual(43.5);
    }
  });
});
