import { expect, test } from "@playwright/test";

test("desktop primary navigation reaches the capabilities page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Capabilities" }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("capability controls work with mouse and keyboard", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only interaction check");

  await page.goto("/services");
  const capabilityLinks = page.getByRole("link", { name: /Open capability/ });
  await expect(capabilityLinks.first()).toHaveAttribute("href", "/services/digital");
  await capabilityLinks.first().click();
  await expect(page).toHaveURL(/\/services\/digital$/);

  await page.goto("/services");
  const keyboardLink = page.getByRole("link", { name: /Open capability/ }).nth(1);
  await keyboardLink.focus();
  await expect(keyboardLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/services\/software$/);
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

test("each experiment links back to the homepage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");

  const experimentTabs = [
    "Operations dashboard",
    "Mobile journey",
    "Automation with approval",
    "Rescue Report",
  ];

  for (const tabName of experimentTabs) {
    await page.goto("/experiments");
    await page.getByRole("tab", { name: new RegExp(tabName) }).click();
    const homeLink = page.getByRole("link", { name: "Back to the homepage" });
    await expect(homeLink).toHaveAttribute("href", "/");
    await homeLink.click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test("the selected path can be closed with an accessible control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only interaction check");
  await page.goto("/");

  const pathCard = page.getByRole("button", { name: /I am starting something new/ });
  await pathCard.click();
  const closeButton = page.getByRole("button", { name: "Close", exact: true });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(closeButton).toBeHidden();
  await expect(pathCard).toHaveAttribute("aria-pressed", "false");
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
  await expect(hero.getByRole("link", { name: "Contact Us" })).toHaveAttribute("href", "mailto:acevatech.official@gmail.com");
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
