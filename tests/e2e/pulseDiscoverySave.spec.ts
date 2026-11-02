import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Browser coverage for discovery skipping and Save Direction feedback.
 *
 * Both endpoints are stubbed: nothing here reaches the model, the analytics
 * table or the lead store. The route logic behind them is covered by
 * tests/api/pulseDiscoveryFlow.test.ts and tests/api/pulseSaveDirection.test.ts;
 * this file proves the widget acts on what those routes return.
 *
 * The floating launcher is located by its test id: the site renders three
 * "Ask Aceva Pulse" buttons (floating, footer, home proof tile).
 */

const RICH_OPENER =
  "We run two restaurants in Lahore. Orders over WhatsApp are chaotic and we lose orders. We want customers to be able to order online, launch in 6 weeks, budget around $8k.";

function sse(answer: string, extra: Record<string, unknown>): string {
  return [
    `data: ${JSON.stringify({ type: "delta", text: answer })}\n\n`,
    `data: ${JSON.stringify({ type: "done", answer, ...extra })}\n\n`,
  ].join("");
}

async function stubChat(page: Page, bodies: Record<string, unknown>[]) {
  await page.route("**/api/chat", async (route: Route) => {
    bodies.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream; charset=utf-8" },
      body: sse("Your project direction is now being assembled for the ACEVA team to review.", {
        isValid: true,
        nextStep: 5,
      }),
    });
  });
}

async function openWidget(page: Page) {
  await expect(async () => {
    await page.getByTestId("pulse-launcher").click();
    await expect(page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/** Rich opener → discovery skipped → direction → contact form. */
async function reachContactForm(page: Page, chatBodies: Record<string, unknown>[]) {
  await stubChat(page, chatBodies);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await openWidget(page);

  await page.getByPlaceholder("Or describe your project vision in your own wording").fill(RICH_OPENER);
  await page.getByRole("button", { name: /MAP THIS VISION/ }).click();

  await expect(page.getByText("06 / SYNTHESIS")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /CONTINUE WITH ACEVA/ }).click({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /SAVE DIRECTION/ })).toBeVisible();
}

async function fillLead(page: Page, contact: string) {
  await page.getByPlaceholder("Your full name").fill("Test Visitor");
  await page.getByPlaceholder("name@company.com or phone").fill(contact);
}

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("a rich first answer skips the questions it already answered", async ({ page }) => {
  const chatBodies: Record<string, unknown>[] = [];
  await reachContactForm(page, chatBodies);

  expect(chatBodies).toHaveLength(1);
  expect(chatBodies[0].step).toBe(0);
  // The answer's own words were recorded for the skipped steps.
  const context = chatBodies[0].context as Record<string, unknown>;
  expect(String(context.scale)).toMatch(/two restaurants/i);
  expect(String(context.timeline)).toMatch(/6 weeks/i);
});

test("Save Direction names the field to fix, then saves and shows the server's PULSE ID", async ({ page }) => {
  const saveBodies: Record<string, unknown>[] = [];
  let attempt = 0;
  await page.route("**/api/pulse/save-direction", async (route) => {
    saveBodies.push(JSON.parse(route.request().postData() ?? "{}"));
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({
        status: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ok: false,
          code: "VALIDATION_FAILED",
          error: "Please check your details — some required fields are missing or incorrect.",
          errors: { contact: true },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, pulseId: "PLS-261031-AB12-CD34" }),
    });
  });

  await reachContactForm(page, []);

  await fillLead(page, "not a phone");
  await page.getByRole("button", { name: /SAVE DIRECTION/ }).click();
  await expect(page.getByText(/Please enter a valid email address or phone number/)).toBeVisible();

  await fillLead(page, "(555) 123-4567");
  await page.getByRole("button", { name: /SAVE DIRECTION/ }).click();
  await expect(page.getByText("DIRECTION SAVED & SUBMITTED")).toBeVisible();
  await expect(page.getByText("PLS-261031-AB12-CD34")).toBeVisible();

  // The browser never chooses the reference, and sends the skipped steps' context.
  expect(saveBodies[1].pulseId).toBeUndefined();
  expect((saveBodies[1].context as Record<string, unknown>).budget).toBeTruthy();
});

test("Save Direction reports a store failure without pretending it saved", async ({ page }) => {
  await page.route("**/api/pulse/save-direction", (route) =>
    route.fulfill({
      status: 503,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        code: "SERVICE_UNAVAILABLE",
        error: "We could not save your project direction just now. Please try again in a moment.",
      }),
    })
  );

  await reachContactForm(page, []);
  await fillLead(page, "visitor@example.com");
  await page.getByRole("button", { name: /SAVE DIRECTION/ }).click();

  await expect(page.getByText(/could not save your project direction/)).toBeVisible();
  await expect(page.getByText("DIRECTION SAVED & SUBMITTED")).toBeHidden();
});
