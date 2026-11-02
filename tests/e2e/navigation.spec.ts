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

test("each experiment is reachable from the index and the page links back to the homepage", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only navigation check");

  const experiments = [
    ["Operations dashboard", "operations-dashboard"],
    ["Mobile journey", "mobile-journey"],
    ["Automation with approval", "automation-with-approval"],
    ["Rescue Report", "rescue-report"],
  ];

  await page.goto("/experiments");
  const index = page.getByRole("navigation", { name: "Experiments" });
  for (const [name, slug] of experiments) {
    await index.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page).toHaveURL(new RegExp(`#${slug}$`));
    await expect(page.locator(`#${slug}-title`)).toBeInViewport();
  }

  const homeLink = page.getByRole("link", { name: "Back to the homepage" });
  await expect(homeLink).toHaveAttribute("href", "/");
  await homeLink.click();
  await expect(page).toHaveURL(/\/$/);
});

test("a path row opens its first engagement and closes again", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Desktop-only interaction check");
  await page.goto("/");

  const pathToggle = page.getByRole("button", { name: /I am starting something new/ });
  await expect(pathToggle).toHaveAttribute("aria-expanded", "false");
  await pathToggle.click();
  await expect(pathToggle).toHaveAttribute("aria-expanded", "true");
  const cta = page.locator("#path-new-panel").getByRole("link", { name: "Scope my idea" });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/contact?situation=new");
  await pathToggle.click();
  await expect(pathToggle).toHaveAttribute("aria-expanded", "false");
  await expect(cta).toBeHidden();
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
  const hero = page.locator("[data-home-hero]");
  await expect(hero.getByRole("heading", { level: 1 })).toContainText("Build what’s next.");
  await expect(hero.getByRole("link", { name: "Start a project" })).toHaveAttribute("href", "/contact");
  await page.locator("#paths").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("#paths [data-reveal]").first().evaluate((reveal) => getComputedStyle(reveal).opacity)).toBe("1");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  await expect(menuButton).toBeInViewport();
  await menuButton.click();
  const mobileMenu = page.getByRole("button", { name: "Close menu" }).locator("../..");
  await expect(mobileMenu.getByRole("button", { name: "Close menu" })).toBeVisible();
  await mobileMenu.getByRole("link", { name: "How We Work" }).click();
  await expect(page).toHaveURL(/\/process$/);
});
