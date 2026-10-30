import { expect, test } from "@playwright/test";

/* "The Paper Trail": the dossier on wide screens, the sticky rail on phones. */

const TRAIL = "[data-phases]";

test("scrolling into a phase deals its deliverables into the dossier", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The dossier is a wide-screen layout");
  await page.goto("/process#build");
  const trail = page.locator(TRAIL);
  await expect(trail).toHaveAttribute("data-n", "3");
  await expect.poll(() => trail.evaluate((el) => el.style.getPropertyValue("--landed"))).toBe("9");

  const stage = page.locator(`${TRAIL} > [aria-hidden="true"]`).last();
  await expect(stage).toBeVisible();
  const before = await stage.evaluate((el) => el.getBoundingClientRect().top);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  const after = await stage.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(2); // docked, not scrolling away
});

test("the last phase completes the kit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The dossier is a wide-screen layout");
  await page.goto("/process#improve");
  const trail = page.locator(TRAIL);
  await expect(trail).toHaveAttribute("data-n", "5");
  await expect.poll(() => trail.evaluate((el) => el.style.getPropertyValue("--landed"))).toBe("15");
});

test("phones get the sticky rail instead of the dossier", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Phone layout");
  await page.goto("/process#design");
  const rail = page.locator(`${TRAIL} > [aria-hidden="true"]`).first();
  await expect(rail).toBeVisible();
  // the rail holds every phase's label; only the active one is shown
  await expect(rail.locator('[data-ph="2"]')).toBeVisible();
  await expect(rail.locator('[data-ph="3"]')).toBeHidden();
  await expect(page.locator(`${TRAIL} > [aria-hidden="true"]`).last()).toBeHidden();
});

test("under reduced motion the finished kit shows and nothing is tracked", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/process#design");
  const trail = page.locator(TRAIL);
  await page.waitForTimeout(800);
  await expect(trail).not.toHaveAttribute("data-n", /.*/);
  const hidden = await trail.evaluate((el) =>
    Array.from(el.querySelectorAll("[style*='--ph']")).filter((p) => getComputedStyle(p).opacity !== "1").length
  );
  expect(hidden).toBe(0);
});
