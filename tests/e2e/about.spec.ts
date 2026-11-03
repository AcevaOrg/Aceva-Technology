import { expect, test } from "@playwright/test";

test("server HTML carries the whole page with nothing pre-hidden by motion", async ({ request }) => {
  const html = await (await request.get("/about")).text();
  expect(html).toContain("proving");
  expect(html).toContain("Familiar services. A clearer way to buy them.");
  expect(html).toContain("Every promise points at something you can open.");
  expect(html).toContain("A named senior signs off");
  expect(html).not.toContain("data-armed");
  // Claims the team has not confirmed must stay off the page.
  expect(html).not.toContain("New York");
  expect(html).not.toContain("one-month");
});

test("keeps its title and canonical metadata", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle("Why ACEVA — How We Position, Sell and Deliver");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/about$/);
});

test("renders one h1, the five compete-on points, and five proof rows", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("proving more");
  await expect(page.getByRole("list", { name: "What we compete on" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.locator("#proof a[href]").filter({ hasText: /^0[1-5]/ })).toHaveCount(5);
});

test("each proof row links to the page that backs it", async ({ page }) => {
  await page.goto("/about");
  const hrefs = await page.locator("#proof a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(hrefs).toEqual(["/", "/experiments", "/experiments#rescue-report", "/process", "/process"]);
});

test("calls to action lead to contact and company", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("link", { name: "Start a Project" }).first()).toHaveAttribute("href", "/contact");
  await expect(page.getByRole("link", { name: "About the company" })).toHaveAttribute("href", "/company");
});

test("no horizontal scroll", async ({ page }) => {
  await page.goto("/about");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
