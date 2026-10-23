import { expect, test } from "@playwright/test";

test("footer lists every section with working destinations", async ({ page }) => {
  await page.goto("/services");
  const nav = page.locator("footer").getByRole("navigation", { name: "Footer" });
  await expect(nav.getByRole("link", { name: "Product Rescue" })).toHaveAttribute("href", "/services/rescue");
  await expect(nav.getByRole("link", { name: "How We Work" })).toHaveAttribute("href", "/process");
  await expect(nav.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
  await expect(nav.getByRole("link", { name: /LinkedIn/ })).toHaveAttribute("target", "_blank");
  await expect(page.locator("footer").getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/legal/privacy");
});

test("footer copies the email address", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const copy = page.locator("footer").getByRole("button", { name: "Copy email address" });
  await copy.scrollIntoViewIfNeeded();
  await copy.click();
  await expect(page.locator("footer").getByRole("status")).toHaveText("Email address copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("contact@acevatech.com");
});

test("footer opens Aceva Pulse", async ({ page }) => {
  await page.goto("/services");
  const button = page.locator("footer").getByRole("button", { name: "Ask Aceva Pulse" });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await expect(page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" })).toBeVisible();
});

test("legal links stay clear of the mobile action bar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "The fixed action bar is mobile-only");
  await page.goto("/services");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const terms = page.locator("footer").getByRole("link", { name: "Terms of Service" });
  await expect(terms).toBeInViewport();
  const onTop = await terms.evaluate((link) => {
    const box = link.getBoundingClientRect();
    return link.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  });
  expect(onTop).toBe(true);
});
