import { test, expect, type Page } from "@playwright/test";

/**
 * Company questions typed into the real Pulse panel, answered by the live
 * model (3 November 2026).
 *
 * "Who is CEO?" typed on the welcome screen used to draw a request for project
 * details: the panel sends every message as the answer to discovery step 0, and
 * the route treated a question as a failed answer. tests/api/pulseSideQuestions
 * covers the routing offline; this proves what a visitor actually sees.
 *
 * Opt-in, because it needs a running server with OPENAI_API_KEY and costs a few
 * completions: PULSE_E2E_LIVE=1 npx playwright test tests/e2e/pulseCompanyQuestions.spec.ts
 */

test.skip(!process.env.PULSE_E2E_LIVE, "live model check; set PULSE_E2E_LIVE=1");

const PROJECT_ASK =
  /(tell (me|us)( a (bit|little))? (more )?about (your|the) (business|project|idea)|what (would|do) you (like|want|need) to (build|create|develop)|describe (your|the) (project|business|idea))/i;

async function openWidget(page: Page) {
  await expect(async () => {
    await page.getByTestId("pulse-launcher").click();
    await expect(page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

async function lastPulseReply(page: Page): Promise<string> {
  const log = page.getByRole("log", { name: "Conversation with Pulse" });
  await expect(log).toHaveAttribute("aria-busy", "false", { timeout: 60_000 });
  return (await log.locator("> div").last().innerText()).trim();
}

test("company questions get direct answers, including follow-ups", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await openWidget(page);

  await page.getByPlaceholder("Or describe your project vision in your own wording").fill("Who is CEO?");
  await page.getByRole("button", { name: /MAP THIS VISION/ }).click();
  const ceo = await lastPulseReply(page);
  expect(ceo).toMatch(/Muhammad Kaif/);
  expect(ceo).not.toMatch(PROJECT_ASK);
  // The first step's "tell us about your project" heading no longer sits above the answer.
  const dialog = page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" });
  await expect(dialog.getByRole("heading", { name: "Ask anything about ACEVA." })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Tell us about your business or project." })).toHaveCount(0);

  const input = page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" }).getByRole("textbox").last();
  await input.fill("What about the CTO?");
  await input.press("Enter");
  await expect.poll(async () => lastPulseReply(page), { timeout: 60_000 }).toMatch(/Muhammad Yousif Khan/);

  await input.fill("Where is your office?");
  await input.press("Enter");
  await expect.poll(async () => lastPulseReply(page), { timeout: 60_000 }).toMatch(/Dadu/);
  expect(await lastPulseReply(page)).not.toMatch(PROJECT_ASK);
});
