import { expect, test } from "@playwright/test";

test("server HTML carries every section with nothing pre-hidden by motion", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('id="home-hero-title"');
  for (const id of ["paths-title", "caps-title", "rescue-title", "how-title", "proof-title", "feedback-title", "start-title"]) {
    expect(html).toContain(`id="${id}"`);
  }
  // Reveal states are only ever armed client-side, below the fold.
  expect(html).not.toContain("data-armed");
});

test("revealed sections end fully visible after scrolling", async ({ page }) => {
  await page.goto("/");
  const headings = page.locator("[data-home-root] h2");
  await expect(headings).toHaveCount(7);
  for (const heading of await headings.all()) {
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect
      .poll(() => heading.evaluate((el) => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity))
      .toBe("1");
  }
});

test("reduced motion renders final states and no WebGL canvas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForTimeout(2000);
  await expect(page.locator("[data-home-hero] canvas")).toHaveCount(0);
  expect(await page.locator("[data-armed]").count()).toBe(0);
  await page.locator("#how-we-work").scrollIntoViewIfNeeded();
  const opacities = await page.locator("#how-title [aria-hidden] > span").evaluateAll((words) =>
    words.map((word) => getComputedStyle(word).opacity)
  );
  expect(new Set(opacities)).toEqual(new Set(["1"]));
});

test("the capability story tracks the panel in view", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Sticky story is desktop-only");
  await page.goto("/");
  await page.locator("#cap-mobile").evaluate((el) => el.scrollIntoView({ block: "center" }));
  const tab = page.getByRole("navigation", { name: "Capability index" }).getByRole("link", { name: /Mobile/ });
  await expect(tab).toHaveAttribute("aria-current", "true");
});

test("the Pulse tile opens the on-site assistant", async ({ page }) => {
  await page.goto("/");
  const tile = page.locator("#proof").getByRole("button", { name: "Ask Aceva Pulse" });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" })).toBeVisible();
});

test("demo reviews are labelled as demo content", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#feedback").getByText("Demo testimonials", { exact: true })).toBeVisible();
});

test("homepage metadata is unchanged", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ACEVA Technology — Custom Software, Web & Mobile Engineering");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
});
