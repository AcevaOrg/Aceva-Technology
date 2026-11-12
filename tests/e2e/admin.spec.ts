import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

/**
 * The internal console, end to end.
 *
 * The "closed door" tests need nothing but the dev server. The signed-in tests need it to run with
 * ADMIN_PASSKEY (read from the environment or .env.local here too, at least 8 characters) and
 * ACEVA_LOCAL_DB=1 or DATABASE_URL; they skip themselves, saying why, otherwise. Every record they make is
 * titled with a per-run tag and deleted afterwards, so the suite is safe to run against a database that
 * already holds real documents.
 *
 * The console is reached only by typing its address, so nothing here clicks a link to it from the public
 * site. A per-test fake client address (X-Forwarded-For) keeps the login limiter and the persistent lockout
 * from coupling parallel tests, and from locking the real developer out of their own console.
 */

const RUN = Date.now().toString(36);

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

/**
 * A fake client address that is unique per test AND per run. The persistent lockout lasts 15 minutes, so a
 * fixed address would still be locked on the next run of the lockout test.
 */
function clientIp(testInfo: TestInfo, salt = ""): string {
  let hash = 0;
  for (const char of `${RUN}|${salt}|${testInfo.project.name}|${testInfo.titlePath.join(">")}`) hash = (hash * 31 + char.charCodeAt(0)) % 64000;
  return `198.18.${Math.floor(hash / 250)}.${(hash % 250) + 1}`;
}

const PDF = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n% admin e2e ${RUN}\n%%EOF\n`);

const CODE = /ACV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/;

/** Signs in through the real form. */
async function signIn(page: Page, passkey: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Pass key" }).fill(passkey);
  await page.getByRole("button", { name: /Unlock console/ }).click();
  await page.waitForURL((url) => url.pathname === "/admin", { timeout: 20_000 });
}

/** The sign-out button lives in the sidebar on desktop and in the drawer on a phone. */
async function signOut(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Sign out" }).filter({ visible: true });
  if ((await button.count()) === 0) await page.getByRole("button", { name: "Open menu" }).filter({ visible: true }).first().click();
  await button.first().click();
  await page.waitForURL((url) => url.pathname === "/admin/login", { timeout: 15_000 });
}

/** A signed-in API client used only to clean up what the tests created. */
let cleanupPromise: Promise<{ api: APIRequestContext; ids: string[] } | string> | null = null;

async function cleanup(baseURL: string | undefined, workerIndex: number): Promise<{ api: APIRequestContext; ids: string[] } | string> {
  cleanupPromise ??= (async () => {
    const passkey = readPasskey();
    if (!passkey) return "ADMIN_PASSKEY is not set (environment or .env.local).";
    const api = await playwrightRequest.newContext({
      baseURL: baseURL ?? "http://127.0.0.1:3100",
      extraHTTPHeaders: { "x-forwarded-for": `198.19.${workerIndex % 200}.${(Date.now() % 200) + 1}` },
    });
    const login = await api.post("/api/admin/login", { data: { passkey } });
    if (!login.ok()) {
      await api.dispose();
      return `Admin sign-in answered ${login.status()}. Start the dev server with the same ADMIN_PASSKEY (at least 8 characters) and ACEVA_LOCAL_DB=1.`;
    }
    return { api, ids: [] };
  })();
  return cleanupPromise;
}

/** Skips the test, with the reason, unless the console and a database are available. */
async function requireConsole(baseURL: string | undefined, testInfo: TestInfo): Promise<{ passkey: string; track: (url: string) => void }> {
  const opened = await cleanup(baseURL, testInfo.workerIndex);
  if (typeof opened === "string") {
    test.skip(true, opened);
    throw new Error(opened);
  }
  const passkey = readPasskey();
  if (!passkey) throw new Error("unreachable: the cleanup client signed in with a pass key");
  const status = await opened.api.get("/api/admin/documents?limit=1");
  if (status.status() === 503) {
    test.skip(true, "The console answered 503: start the dev server with ACEVA_LOCAL_DB=1 or DATABASE_URL.");
    throw new Error("no database");
  }
  return {
    passkey,
    track: (url: string) => {
      const id = /\/admin\/documents\/([0-9a-f-]{36})/.exec(url)?.[1];
      if (id) opened.ids.push(id);
    },
  };
}

test.afterAll(async () => {
  const opened = cleanupPromise ? await cleanupPromise : null;
  if (!opened || typeof opened === "string") return;
  for (const id of opened.ids) await opened.api.delete(`/api/admin/documents/${id}`).catch(() => undefined);
  await opened.api.dispose();
  cleanupPromise = null;
});

test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": clientIp(testInfo) });
});

/* ------------------------------------------------------------------ *
 * The closed door: no database or pass key needed                      *
 * ------------------------------------------------------------------ */

test.describe("closed to everyone without the pass key", () => {
  test("the console redirects to the sign-in page and the API answers 401", async ({ page, request }) => {
    test.skip(readPasskey() === null, "With no pass key the console does not exist at all (404), which the next test covers.");

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
    await expect(page.getByRole("heading", { name: /Internal console/ })).toBeVisible();
    // The marketing header and footer give way to the console's own frame.
    await expect(page.getByRole("link", { name: "Capabilities" }).filter({ visible: true })).toHaveCount(0);

    const documents = await request.get("/api/admin/documents");
    expect(documents.status()).toBe(401);
    expect((await documents.json()).code).toBe("UNAUTHENTICATED");
    expect((await request.get("/api/admin/documents/0a1b2c3d-1111-4222-8333-444455556666/file")).status()).toBe(401);
    expect((await request.get("/api/admin/documents/0a1b2c3d-1111-4222-8333-444455556666/qr")).status()).toBe(401);

    const session = await (await request.get("/api/admin/session")).json();
    expect(session).toMatchObject({ ok: true, authenticated: false });
  });

  test("the pass key can never end up in the address bar, even if the form is submitted before the page is ready", async ({ page, context }) => {
    test.skip(readPasskey() === null, "The console is disabled without a pass key.");
    // None of the page's scripts load, which is exactly the situation of someone who types and presses Enter
    // before hydration finishes. A native GET submit would put the key in the URL (history, logs, referrers).
    await context.route(/\/_next\/static\/.*\.js(\?.*)?$/, (route) => route.abort());
    const loginRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/admin/login")) loginRequests.push(`${request.method()} ${request.url()}`);
    });

    await page.goto("/admin/login");
    const field = page.getByRole("textbox", { name: "Pass key" });
    await field.fill("a-secret-that-must-stay-secret");
    await expect(page.getByRole("button", { name: /Unlock console/ })).toBeDisabled();
    await field.press("Enter");
    await page.waitForTimeout(1000);

    expect(page.url()).not.toMatch(/passkey|a-secret-that-must-stay-secret/);
    expect(loginRequests.every((entry) => entry.startsWith("GET ") && !entry.includes("passkey"))).toBe(true);
  });

  test("deep console pages remember where you were going", async ({ page }) => {
    test.skip(readPasskey() === null, "The console is disabled without a pass key.");
    await page.goto("/admin/documents/new?category=certifications");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fdocuments%2Fnew/);
  });

  test("look-alike addresses are ordinary 404s that reveal nothing", async ({ request }) => {
    for (const address of ["/Admin", "/ADMIN", "/administrator", "/login", "/dashboard", "/wp-admin"]) {
      const response = await request.get(address);
      expect(response.status(), address).toBe(404);
      const html = await response.text();
      expect(html, address).not.toMatch(/pass key|Internal console/i);
    }
  });

  test("a wrong pass key is refused with the same plain words, then repeated failures lock the form", async ({ page, request, baseURL }, testInfo) => {
    test.skip(readPasskey() === null, "The console is disabled without a pass key.");
    test.setTimeout(90_000);

    await page.goto("/admin/login");
    await page.getByRole("textbox", { name: "Pass key" }).fill("definitely-not-the-key");
    await page.getByRole("button", { name: /Unlock console/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "That pass key did not work." })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
    // The refusal never says why: nothing about length, closeness or format.
    expect(await page.locator("body").innerText()).not.toMatch(/too short|too long|characters|almost/i);

    // Four more failures from the same address (five in all) trip the lockout.
    const attacker = await playwrightRequest.newContext({
      baseURL: baseURL ?? "http://127.0.0.1:3100",
      extraHTTPHeaders: { "x-forwarded-for": clientIp(testInfo, "attacker") },
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const refused = await attacker.post("/api/admin/login", { data: { passkey: `wrong-${attempt}` } });
      expect(refused.status()).toBe(401);
    }
    const locked = await attacker.post("/api/admin/login", { data: { passkey: "wrong-again" } });
    expect(locked.status()).toBe(429);
    expect(Number(locked.headers()["retry-after"])).toBeGreaterThan(0);

    // Even the right key is refused while locked: the lock belongs to the address, not to the key.
    const passkey = readPasskey() as string;
    const stillLocked = await attacker.post("/api/admin/login", { data: { passkey } });
    expect(stillLocked.status()).toBe(429);
    expect(stillLocked.headers()["set-cookie"]).toBeUndefined();
    await attacker.dispose();

    // The form says so too, with a visible countdown, and sets no session.
    const lockedPage = await page.context().newPage();
    await lockedPage.context().setExtraHTTPHeaders({ "x-forwarded-for": clientIp(testInfo, "attacker") });
    await lockedPage.goto("/admin/login");
    await lockedPage.getByRole("textbox", { name: "Pass key" }).fill(passkey);
    await lockedPage.getByRole("button", { name: /Unlock console/ }).click();
    await expect(lockedPage.getByRole("alert").filter({ hasText: "Too many attempts." })).toBeVisible();
    await expect(lockedPage.getByRole("button", { name: /Try again in/ })).toBeDisabled();
    expect((await request.get("/api/admin/session")).status()).toBe(200);
  });
});

test.describe("the public site never points at the console", () => {
  test("no public page, sitemap, robots file or manifest names it", async ({ request }) => {
    for (const address of ["/", "/about", "/services", "/contact", "/documents", "/verify", "/faq", "/legal/privacy", "/sitemap.xml", "/robots.txt", "/manifest.webmanifest"]) {
      const response = await request.get(address);
      expect(response.status(), address).toBe(200);
      const text = await response.text();
      expect(text, `${address} mentions the console`).not.toMatch(/\/admin|admin console|pass key|passkey/i);
    }
  });

  test("the sitemap lists the Documents hub but never a verification code", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/documents");
    expect(sitemap).not.toContain("/verify/");
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow:\s*\/verify\//);
  });
});

/* ------------------------------------------------------------------ *
 * Signed in                                                            *
 * ------------------------------------------------------------------ */

test.describe("signed in", () => {
  test("a certification goes from the editor to a valid public check, to revoked, to signed out", async ({ page, request, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const { passkey, track } = await requireConsole(baseURL, testInfo);
    const holder = `E2E Holder ${RUN}`;

    await test.step("sign in through the form", async () => {
      await signIn(page, passkey);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    let code = "";
    await test.step("create a certification with its PDF and publish it", async () => {
      await page.goto("/admin/documents/new?category=certifications");
      await page.locator("#ed-b-title").fill(`E2E Flow Certificate ${RUN}`);
      await page.locator("#ed-b-holderName").fill(holder);
      await page.locator("#ed-b-referenceNo").fill(`ACV-E2E-${RUN}`);
      await page.locator("#ed-b-issuedOn").fill("2026-01-05");
      await page.locator("#ed-b-expiresOn").fill("2030-01-04");
      await page.locator("#ed-f-direction").selectOption("issued");
      await page.locator("#ed-f-issuing_body").fill("E2E Flow Academy");
      await page.locator("#ed-f-internal_notes").fill(`E2E private note ${RUN}`);
      await page.locator('input[type="file"][aria-labelledby="ed-primary-label"]').setInputFiles({ name: "certificate.pdf", mimeType: "application/pdf", buffer: PDF });
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page.waitForURL(/\/admin\/documents\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      track(page.url());

      // The edit page carries the QR and the verification code.
      await expect(page.getByText(CODE).first()).toBeVisible({ timeout: 15_000 });
      code = (await page.locator("body").innerText()).match(CODE)?.[0] ?? "";
      expect(code).toMatch(CODE);
    });

    await test.step("the public check says valid and shows the holder and issuer, never the private fields", async () => {
      const response = await request.get(`/verify/${code}`, { headers: { "x-forwarded-for": clientIp(testInfo, "verify") } });
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain('data-kind="valid"');
      expect(html).toContain("This record is valid.");
      expect(html).toContain(holder);
      expect(html).toContain("E2E Flow Academy");
      expect(html).not.toContain(`E2E private note ${RUN}`);
      expect(html).toMatch(/noindex/i);
    });

    await test.step("the print page offers QR labels for it", async () => {
      await page.getByRole("link", { name: /Print QR labels/ }).first().click();
      await expect(page).toHaveURL(/\/card$/);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("QR labels");
      // The strip is the label design shown first; it carries the QR and the verified-by line.
      await expect(page.getByText("Verified by ACEVA").first()).toBeVisible({ timeout: 15_000 });
    });

    await test.step("revoke it from the record's own panel, and the public check follows at once", async () => {
      await page.goBack();
      await page.getByRole("button", { name: /^Revoke/ }).first().click();
      const dialog = page.getByRole("alertdialog");
      await dialog.getByRole("textbox").fill("Issued in error during an automated test.");
      await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
      await expect(dialog).toBeHidden({ timeout: 15_000 });

      const response = await request.get(`/verify/${code}`, { headers: { "x-forwarded-for": clientIp(testInfo, "verify") } });
      const html = await response.text();
      expect(html).toContain('data-kind="revoked"');
      expect(html).toContain("This record has been revoked.");
      // A revoked record shows the bare minimum, and never the reason it was revoked.
      expect(html).not.toContain("Issued in error during an automated test.");
      expect(html).not.toContain("E2E Flow Academy");
      expect(html).not.toContain(holder);
    });

    await test.step("sign out ends access in this browser", async () => {
      await signOut(page);
      await page.goto("/admin/documents");
      await expect(page).toHaveURL(/\/admin\/login/);
      const session = await (await page.request.get("/api/admin/session")).json();
      expect(session.authenticated).toBe(false);
      expect((await page.request.get("/api/admin/documents")).status()).toBe(401);
    });
  });

  test("a certification with a PDF is published, verifiable, and its file is served with a PDF-safe policy", async ({ page, request, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const { passkey, track } = await requireConsole(baseURL, testInfo);
    await signIn(page, passkey);

    await page.goto("/admin/documents/new?category=certifications");
    await page.locator("#ed-b-title").fill(`E2E Certification ${RUN}`);
    await page.locator("#ed-b-holderName").fill("ACEVA Technology");
    await page.locator("#ed-b-referenceNo").fill(`ACV/E2E/${RUN}`);
    await page.locator("#ed-b-issuedOn").fill("2026-02-10");
    await page.locator("#ed-f-direction").selectOption("held");
    await page.locator("#ed-f-issuing_body").fill("E2E Standards Body");
    await page.locator('input[type="file"][aria-labelledby="ed-primary-label"]').setInputFiles({ name: "certificate.pdf", mimeType: "application/pdf", buffer: PDF });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.waitForURL(/\/admin\/documents\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    track(page.url());
    const id = /\/admin\/documents\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
    await expect(page.getByText(CODE).first()).toBeVisible({ timeout: 15_000 });
    const code = (await page.locator("body").innerText()).match(CODE)?.[0] ?? "";

    // The public check and the public listing.
    const ip = { "x-forwarded-for": clientIp(testInfo, "public") };
    const verify = await (await request.get(`/verify/${code}`, { headers: ip })).text();
    expect(verify).toContain('data-kind="valid"');
    const hub = await (await request.get("/documents", { headers: ip })).text();
    expect(hub).toContain(`E2E Certification ${RUN}`);

    // The public file route, with the headers that let Chrome draw a PDF inline.
    const file = await request.get(`/api/documents/${id}/file`, { headers: ip });
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toContain("application/pdf");
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(file.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(file.headers()["content-security-policy"]).toContain("object-src 'self'");
    expect(file.headers()["content-disposition"]).toMatch(/^inline/);

    // The console's own preview of the same file, and its QR, behind the session.
    const preview = await page.request.get(`/api/admin/documents/${id}/file?role=primary`);
    expect(preview.status()).toBe(200);
    expect(preview.headers()["content-security-policy"]).toContain("object-src 'self'");
    expect(preview.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    const svg = await page.request.get(`/api/admin/documents/${id}/qr?format=svg`);
    expect(svg.status()).toBe(200);
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
    expect(svg.headers()["content-security-policy"]).toContain("default-src 'none'");
    const png = await page.request.get(`/api/admin/documents/${id}/qr?format=png&download=1`);
    expect(png.status()).toBe(200);
    expect(png.headers()["content-disposition"]).toMatch(/^attachment/);

    // Unpublish from the row menu's API, and the public side goes dark: the file and the code both vanish.
    const unpublish = await page.request.post(`/api/admin/documents/${id}/actions`, { data: { action: "unpublish" } });
    expect(unpublish.status()).toBe(200);
    expect((await request.get(`/api/documents/${id}/file`, { headers: ip })).status()).toBe(404);
    const dark = await (await request.get(`/verify/${code}`, { headers: ip })).text();
    expect(dark).toContain('data-kind="not_found"');
  });

  test("saving with missing required fields explains what is missing and keeps what was typed", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const { passkey } = await requireConsole(baseURL, testInfo);
    await signIn(page, passkey);

    await page.goto("/admin/documents/new?category=certifications");
    await page.locator("#ed-b-title").fill(`E2E Incomplete ${RUN}`);
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/documents\/new/);
    await expect(page.getByRole("alert").filter({ hasText: /Awarded to|Certificate no|Issued on|Issuing body/ }).first()).toBeVisible();
    await expect(page.locator("#ed-b-title")).toHaveValue(`E2E Incomplete ${RUN}`);
  });

  test("every console page renders, and settings shows the host lock without ever printing the key", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const { passkey } = await requireConsole(baseURL, testInfo);
    await signIn(page, passkey);

    for (const [address, heading] of [
      ["/admin/documents", /Documents/i],
      ["/admin/verification", /Verification|Lookups/],
      ["/admin/activity", /What happened|Activity|Audit|trail/i],
      ["/admin/settings", /Health check/],
    ] as const) {
      const response = await page.goto(address);
      expect(response?.status(), address).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      // Console pages are never indexed.
      expect(response?.headers()["x-robots-tag"] ?? "", address).toMatch(/noindex/);
    }

    await page.goto("/admin/settings");
    // Wait for the row to be VISIBLE, not merely present in the document: while a page streams in, its text can
    // already be in the DOM (inside a hidden container) a moment before it is swapped into view, and reading
    // innerText in that gap returns the loading placeholder instead of the page.
    await expect(page.getByText("Host lock").filter({ visible: true }).first()).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/host lock/i);
    expect(body).toMatch(/pass key/i);
    expect(body).not.toContain(passkey);
  });
});

test.describe("signed in: the Team category", () => {
  test("is named Team throughout, opens with the Position fieldset, and refuses a profile without a level and a job title", async ({ page, baseURL }, testInfo) => {
    test.setTimeout(120_000);
    const { passkey } = await requireConsole(baseURL, testInfo);
    await signIn(page, passkey);

    // The picker, the list and the editor all use the new name; the old address is not kept as an alias.
    await page.goto("/admin/documents/new");
    await expect(page.getByRole("link", { name: /Team member/ }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Interns, team|People & program/);
    await page.goto("/admin/documents/new?category=people-programs");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What are you adding?");
    await page.goto("/admin/documents?category=team");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team");

    await page.goto("/admin/documents/new?category=team");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team member");
    const legends = (await page.locator("fieldset legend").allTextContents()).map((text) => text.trim());
    expect(legends).toContain("Position");
    expect(legends.indexOf("Position")).toBeLessThan(legends.indexOf("Program"));
    expect(legends.indexOf("Program")).toBeLessThan(legends.indexOf("Dates & status"));

    // The level is a required select whose last five options are the ranks, highest first.
    const level = page.locator("#ed-f-hierarchy_level");
    const labels = await level.locator("option").allTextContents();
    expect(labels.slice(-5)).toEqual(["Leadership", "Management", "Team lead", "Team member", "Intern / trainee"]);
    await expect(page.locator("#ed-f-reports_to")).toBeVisible();
    await expect(page.locator("#ed-f-role_title")).toBeVisible();

    // Nothing is saved without a level and a job title.
    await page.locator("#ed-b-title").fill(`E2E Team ${RUN}`);
    await page.locator("#ed-b-holderName").fill(`E2E Person ${RUN}`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Level in the team is required/).first()).toBeVisible();
    await expect(page.getByText(/Role \/ job title is required/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/documents\/new/);
  });
});
