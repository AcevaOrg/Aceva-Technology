import { expect, test } from "@playwright/test";

test("desktop primary navigation reaches the capabilities page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Capabilities" }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("mobile menu opens without horizontal overflow and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only layout check");
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toBeInViewport();
  await menuButton.click();
  const mobileMenu = page.getByRole("button", { name: "Close menu" }).locator("../..");
  await expect(mobileMenu.getByRole("button", { name: "Close menu" })).toBeVisible();
  await mobileMenu.getByRole("link", { name: "How We Work" }).click();
  await expect(page).toHaveURL(/\/process$/);
});
