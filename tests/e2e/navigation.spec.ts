import { expect, test } from "@playwright/test";

test("desktop primary navigation reaches the capabilities page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Capabilities" }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("desktop more menu opens from the top-right icon and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");
  await page.goto("/");
  const moreButton = page.getByRole("button", { name: "More pages" });
  await expect(moreButton).toBeInViewport();
  await moreButton.click();
  await page.getByRole("menuitem", { name: "About Us" }).click();
  await expect(page).toHaveURL(/\/company$/);
});

test("mobile menu opens without horizontal overflow and navigates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile-only layout check");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    return main && footer ? footer.getBoundingClientRect().top - main.getBoundingClientRect().bottom : null;
  })).toBe(0);
  const hero = page.locator(".hero");
  await expect(hero.getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "mailto:acevatechnology@gmail.com");
  await expect.poll(() => hero.locator(".ac-section-image").evaluate((image) => getComputedStyle(image).animationName)).toBe("acDrift");
  await page.locator("#paths").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("#paths > div > div").first().evaluate((reveal) => getComputedStyle(reveal).opacity)).toBe("1");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toBeInViewport();
  await menuButton.click();
  const mobileMenu = page.getByRole("button", { name: "Close menu" }).locator("../..");
  await expect(mobileMenu.getByRole("button", { name: "Close menu" })).toBeVisible();
  await mobileMenu.getByRole("link", { name: "How We Work" }).click();
  await expect(page).toHaveURL(/\/process$/);
});
