import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * Focused browser coverage for the Pulse widget.
 *
 * Every test stubs POST /api/chat. Nothing here reaches the model or the
 * analytics table: `lib/pulse/turnLog.ts` only suppresses writes under vitest,
 * and these run against `npm run dev`, so an unmocked call would insert a real
 * row into the production `chat_turns` table. The blanket route in beforeEach
 * is what makes that impossible rather than merely unlikely.
 *
 * Assertions are on observable application state — dialog visibility, rendered
 * message text, the stop/retry controls — not on sleeps or computed CSS
 * animation state.
 */

const OPEN = { name: "Ask Aceva Pulse" };
const DIALOG = { name: "ACEVA Pulse Chatbot" };
const CLOSE = { name: "Close Pulse modal" };

/** The reply the stubbed endpoint sends unless a test overrides it. */
const DEFAULT_ANSWER = "Noted — tell me a little about your business.";

/** An SSE body in the exact shape components/pulse/PulseContext.tsx parses. */
function sseBody(deltas: string[], answer: string, isValid = false): string {
  const frames = deltas.map((text) => `data: ${JSON.stringify({ type: "delta", text })}\n\n`);
  frames.push(`data: ${JSON.stringify({ type: "done", answer, isValid })}\n\n`);
  return frames.join("");
}

async function fulfilStream(route: Route, answer: string, deltas = ["Noted — ", "tell me more."]) {
  await route.fulfill({
    status: 200,
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
    body: sseBody(deltas, answer),
  });
}

/**
 * Stops CSS animation from blocking actionability.
 *
 * The floating launcher carries `animation: floatingDrift 3.6s ... infinite`
 * with a translateY, so its bounding box never repeats and Playwright's
 * "stable" check never passes — a plain .click() waits forever (247 retries
 * observed). Disabling animation is preferable to force-clicking: the tests
 * then assert behaviour rather than racing presentation, and nothing is
 * skipped in the actionability check.
 */
async function stillAnimations(page: Page) {
  await page.addStyleTag({
    content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });
}

/**
 * Opens the widget, tolerating React hydration.
 *
 * Immediately after a navigation the launcher is in the DOM but its onClick is
 * not yet attached, so a single click can be swallowed and the dialog never
 * appears. `expect(...).toPass()` retries the click-then-assert pair until it
 * succeeds — Playwright's supported way to handle this, and not a sleep.
 */
async function openWidget(page: Page) {
  await expect(async () => {
    await page.getByRole("button", OPEN).click();
    await expect(page.getByRole("dialog", DIALOG)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/** Opens the widget and picks an intent, which is what sends the first turn. */
async function openAndStartConversation(page: Page) {
  await openWidget(page);
  await page.getByRole("button", { name: "Start something new" }).click();
}

/**
 * Serial, with a generous timeout, because `npm run dev` compiles routes on
 * demand: the first request to "/" regularly exceeds Playwright's default 30s
 * test timeout, and `fullyParallel` makes several workers trigger that
 * compilation at once. Serialising means the first test pays the cost and the
 * rest run against a warm server. This is scoped to this file deliberately —
 * the same cold-compile timeout is the likely cause of the pre-existing
 * navigation failures, but changing the shared config is a separate decision.
 */
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

test.beforeEach(async ({ page }) => {
  // Default stub. Individual tests re-route to override it.
  await page.route("**/api/chat", (route) => fulfilStream(route, DEFAULT_ANSWER));
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await stillAnimations(page);
});

test("opens, closes and reopens without losing the conversation", async ({ page }) => {
  await openAndStartConversation(page);
  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();

  await page.getByRole("button", CLOSE).click();
  await expect(page.getByRole("dialog", DIALOG)).toBeHidden();

  await openWidget(page);
  // Reopening must not restart the conversation.
  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();
});

test("persists the session to storage across a reload", async ({ page }) => {
  // The storage half of session memory, which is the half that works.
  await openAndStartConversation(page);
  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await stillAnimations(page);

  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem("aceva-pulse-v2");
    if (!raw) return { messageCount: 0, stage: "(none)" };
    const parsed = JSON.parse(raw) as { messages?: unknown[]; stage?: string };
    return {
      messageCount: Array.isArray(parsed.messages) ? parsed.messages.length : 0,
      stage: parsed.stage ?? "(none)",
    };
  });

  expect(stored.messageCount).toBeGreaterThan(0);
  expect(stored.stage).toBe("discovery");
});

test("restores the transcript into the UI after a reload", async ({ page }) => {
  // Regression guard for the save/restore ordering bug: the save effect used
  // to persist the pre-restore initialState over the stored session, so a
  // reload always landed on the intent picker with the transcript gone.
  await openAndStartConversation(page);
  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await stillAnimations(page);
  await openWidget(page);

  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();
  // The restored stage must be the conversation, not the opening picker.
  await expect(page.getByRole("button", { name: "Start something new" })).toHaveCount(0);
});

test("a second browser context starts a fresh session", async ({ page, browser }) => {
  // Two contexts, not two tabs: localStorage is shared between tabs of one
  // context, so only a separate context establishes isolation.
  await openAndStartConversation(page);
  await expect(page.getByText(DEFAULT_ANSWER)).toBeVisible();

  const fresh = await browser.newContext();
  const freshPage = await fresh.newPage();
  await freshPage.route("**/api/chat", (route) => fulfilStream(route, DEFAULT_ANSWER));
  await freshPage.goto("/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await stillAnimations(freshPage);
  await openWidget(freshPage);

  // No carried-over transcript, and the intent picker is on screen again.
  await expect(freshPage.getByText(DEFAULT_ANSWER)).toHaveCount(0);
  await expect(freshPage.getByRole("button", { name: "Start something new" })).toBeVisible();

  await fresh.close();
});

test("shows a stop control while a turn is in flight, then renders the streamed answer", async ({
  page,
}) => {
  // The route is held open so the in-flight state is observable without a
  // sleep: the assertion waits for the control, the test then releases.
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route("**/api/chat", async (route) => {
    await held;
    await fulfilStream(route, "Streamed answer assembled from frames.", ["Streamed ", "answer "]);
  });

  await openWidget(page);
  await page.getByRole("button", { name: "Start something new" }).click();

  // Loading state: StreamControls renders STOP for the whole turn.
  await expect(page.getByRole("button", { name: /STOP/ })).toBeVisible();

  release();

  await expect(page.getByText("Streamed answer assembled from frames.")).toBeVisible();
  await expect(page.getByRole("button", { name: /STOP/ })).toBeHidden();
});

test("surfaces a failed turn and recovers when the retry succeeds", async ({ page }) => {
  let attempt = 0;
  await page.route("**/api/chat", async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({
        status: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, code: "SERVICE_UNAVAILABLE" }),
      });
      return;
    }
    await fulfilStream(route, "Recovered answer after retry.");
  });

  await openWidget(page);
  await page.getByRole("button", { name: "Start something new" }).click();

  // The failure must be visible and offer a way forward.
  const retry = page.getByRole("button", { name: /RETRY/ });
  await expect(retry).toBeVisible();

  await retry.click();

  await expect(page.getByText("Recovered answer after retry.")).toBeVisible();
  await expect(retry).toBeHidden();
  expect(attempt).toBeGreaterThanOrEqual(2);
});
