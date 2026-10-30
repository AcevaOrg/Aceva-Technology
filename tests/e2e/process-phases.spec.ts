import { expect, test, type Locator } from "@playwright/test";

/* "The Loop": the sticky ring on wide screens, the sticky rail on phones, Build's weekly loop. */

const LOOP = "[data-phases]";

/** How much of an arc is still undrawn (0 = fully drawn, 100 = not at all). Track, main, close. */
const undrawn = (stage: Locator, arc: number) =>
  stage.locator("svg path").nth(arc).evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset));

test("reading a phase lights its node, shows its name and draws the arc part-way", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The sticky ring is a wide-screen layout");
  await page.goto("/process#build");
  const loop = page.locator(LOOP);
  await expect(loop).toHaveAttribute("data-n", "3");

  const stage = loop.locator(":scope > div").nth(1);
  await expect(stage.locator('[data-ph="3"]')).toBeVisible();
  await expect(stage.locator('[data-ph="2"]')).toBeHidden();
  const main = await undrawn(stage, 1);
  expect(main).toBeGreaterThan(0);
  expect(main).toBeLessThan(100);
  expect(await undrawn(stage, 2)).toBeCloseTo(100, 0); // the closing arc waits for Improve

  const before = await stage.evaluate((el) => el.getBoundingClientRect().top);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  const after = await stage.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(2); // docked, not scrolling away
});

test("Improve closes the loop back to Understand", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The sticky ring is a wide-screen layout");
  await page.goto("/process#improve");
  const loop = page.locator(LOOP);
  await expect(loop).toHaveAttribute("data-n", "5");
  await expect(loop.getByText("Then back to Understand")).toBeVisible();
  const stage = loop.locator(":scope > div").nth(1);
  expect(await undrawn(stage, 1)).toBeCloseTo(0, 0);
});

test("phones get the sticky rail instead of the ring", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Phone layout");
  await page.goto("/process#design");
  const rail = page.locator(`${LOOP} > [aria-hidden="true"]`).first();
  await expect(rail).toBeVisible();
  await expect(rail.locator('[data-ph="2"]')).toBeVisible();
  await expect(rail.locator('[data-ph="3"]')).toBeHidden();
  await expect(page.locator(LOOP).locator(":scope > div").nth(1)).toBeHidden();
});

test("Build carries the weekly loop as an ordered list", async ({ page }) => {
  await page.goto("/process#build");
  const steps = page.locator("#build ol li");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toContainText("Build");
  await expect(steps.nth(2)).toContainText("A working demo every week");
});

test("under reduced motion nothing is tracked and the whole loop is drawn", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/process#design");
  await page.waitForTimeout(800);
  const loop = page.locator(LOOP);
  await expect(loop).not.toHaveAttribute("data-n", /.*/);
  test.skip(testInfo.project.name !== "desktop-chromium", "The ring is a wide-screen layout");
  const stage = loop.locator(":scope > div").nth(1);
  expect(await undrawn(stage, 1)).toBeCloseTo(0, 0);
  expect(await undrawn(stage, 2)).toBeCloseTo(0, 0);
});
