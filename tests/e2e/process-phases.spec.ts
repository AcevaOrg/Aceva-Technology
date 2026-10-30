import { expect, test } from "@playwright/test";

/* "The Loop": the sticky ring on wide screens, the sticky rail on phones, Build's weekly loop. */

const LOOP = "[data-phases]";

test("reading a phase lights its node and draws the arc", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The sticky ring is a wide-screen layout");
  await page.goto("/process#build");
  const loop = page.locator(LOOP);
  await expect(loop).toHaveAttribute("data-n", "3");

  const stage = loop.locator(":scope > div").nth(1);
  await expect(stage).toBeVisible();
  await expect(stage).toContainText("Build");
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
});

test("phones get the sticky rail instead of the ring", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Phone layout");
  await page.goto("/process#design");
  const rail = page.locator(`${LOOP} > [aria-hidden="true"]`).first();
  await expect(rail).toBeVisible();
  await expect(rail).toContainText("02 · Design");
  await expect(page.locator(LOOP).locator(":scope > div").nth(1)).toBeHidden();
});

test("Build carries the weekly loop as an ordered list", async ({ page }) => {
  await page.goto("/process#build");
  const steps = page.locator("#build ol li");
  await expect(steps).toHaveCount(4);
  await expect(steps.first()).toContainText("Build");
  await expect(steps.nth(2)).toContainText("A working demo every week");
});

test("under reduced motion the whole loop shows and nothing is tracked", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/process#design");
  await page.waitForTimeout(800);
  await expect(page.locator(LOOP)).not.toHaveAttribute("data-n", /.*/);
});
