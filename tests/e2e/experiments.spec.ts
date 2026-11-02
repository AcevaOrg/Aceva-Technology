import { expect, test } from "@playwright/test";

const SLUGS = [
  "this-website",
  "operations-dashboard",
  "mobile-journey",
  "automation-with-approval",
  "rescue-report",
  "aceva-pulse",
];

const INDEX = 'nav[aria-label="Experiments"]';

test("server HTML carries every chapter, in full, with nothing pre-hidden by motion", async ({ request }) => {
  const html = await (await request.get("/experiments")).text();
  for (const slug of SLUGS) {
    expect(html).toContain(`id="${slug}"`);
    expect(html).toContain(`id="${slug}-title"`);
  }
  // Content that used to live only in JS-rendered tabs.
  expect(html).toContain("Refund request — INV-2291");
  expect(html).toContain("Admin panel");
  expect(html).toContain("None of these are client projects.");
  // The first frame is complete: KPI values are real, and nothing is armed before hydration.
  expect(html).toMatch(/>128</);
  expect(html).not.toContain("data-armed");
  expect(html).not.toContain('role="tablist"');
});

test("keeps its title and canonical metadata", async ({ page }) => {
  await page.goto("/experiments");
  await expect(page).toHaveTitle("Experiments — Concept Demos & Internal Products");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/experiments$/);
});

test("revealed chapters end fully visible after scrolling", async ({ page }) => {
  await page.goto("/experiments");
  for (const slug of SLUGS) {
    const heading = page.locator(`#${slug}-title`);
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect
      .poll(() => heading.evaluate((el) => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity))
      .toBe("1");
  }
});

test("under reduced motion nothing is armed or animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/experiments");
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-armed]")).toHaveCount(0);
  const running = await page.evaluate(() => {
    const root = document.querySelector("[data-experiments-root]")!;
    return document
      .getAnimations()
      .filter((a) => a.playState === "running" && root.contains((a.effect as KeyframeEffect | null)?.target ?? null)).length;
  });
  expect(running).toBe(0);
});

test("deep links land below the header and the docked index", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Header geometry differs on phones");
  // Smooth scrolling would still be animating when the next link loads; this checks where chapters land.
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const slug of SLUGS) {
    await page.goto(`/experiments#${slug}`);
    const heading = page.locator(`#${slug}-title`);
    await expect(heading).toBeInViewport();
    await expect
      .poll(async () => {
        const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
        const dockBottom = await page.locator(`${INDEX} > div`).evaluate((el) => el.getBoundingClientRect().bottom);
        return top >= dockBottom - 1;
      })
      .toBe(true);
    await expect(page.locator(`${INDEX} a[href="#${slug}"]`)).toHaveAttribute("aria-current", "true");
  }
});

test("the index docks under the header while reading", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "The index only docks from 768px up");
  await page.goto("/experiments#operations-dashboard");
  const pillBottom = await page.locator("header > div").first().evaluate((el) => el.getBoundingClientRect().bottom);
  const indexTop = await page.locator(`${INDEX} > div`).evaluate((el) => el.getBoundingClientRect().top);
  expect(indexTop).toBeGreaterThanOrEqual(pillBottom - 1);
});

test("the approval automation needs a decision, keeps focus on a real element and logs on time", async ({ page }) => {
  await page.goto("/experiments#automation-with-approval");
  const log = page.getByRole("log", { name: "Activity log" });
  await expect(log.getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: /Look up the record/ }).click();
  await expect(log.getByRole("listitem")).toHaveCount(2);
  await page.getByRole("button", { name: /Propose an action/ }).click();
  await expect(page.getByRole("button", { name: "Approve refund" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Update the systems/ })).toHaveCount(0);
  await expect(log).toContainText("Awaiting human approval");

  await page.getByRole("button", { name: "Approve refund" }).click();
  await expect(log).toContainText("Approved by R. Okafor");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");

  await page.getByRole("button", { name: /Update the systems/ }).click();
  await expect(log).toContainText("Refund issued");
  await page.getByRole("button", { name: "Run it again" }).click();
  await expect(log.getByRole("listitem")).toHaveCount(1);
});

test("sending the refund to review stops the automation", async ({ page }) => {
  await page.goto("/experiments#automation-with-approval");
  await page.getByRole("button", { name: /Look up the record/ }).click();
  await page.getByRole("button", { name: /Propose an action/ }).click();
  await page.getByRole("button", { name: "Send to review" }).click();
  const log = page.getByRole("log", { name: "Activity log" });
  await expect(log).toContainText("Sent to manual review");
  await expect(log).not.toContainText("Refund issued");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

test("roles lock and unlock dashboard actions", async ({ page }) => {
  await page.goto("/experiments#operations-dashboard");
  const approve = page.getByRole("button", { name: "Approve", exact: true });
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("radio", { name: "Finance" }).check({ force: true });
  await expect(approve).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("status").filter({ hasText: "Finance:" })).toContainText("1 action available");
});

test("the Rescue report toggles views and filters by severity", async ({ page }) => {
  await page.goto("/experiments#rescue-report");
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(10); // header + 9 findings

  await page.getByRole("radio", { name: "Triage matrix" }).check({ force: true });
  await expect(page.getByRole("heading", { name: /Keep/, level: 4 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Defer/, level: 4 })).toBeVisible();

  await page.getByRole("radio", { name: "Critical" }).check({ force: true });
  await expect(page.getByText("Showing 2 of 9 findings")).toBeVisible();
});

test("Ask Aceva Pulse opens the assistant", async ({ page }) => {
  await page.goto("/experiments#aceva-pulse");
  await page.locator("#aceva-pulse").getByRole("button", { name: "Ask Aceva Pulse" }).click();
  await expect(page.getByRole("dialog", { name: "ACEVA Pulse Chatbot" })).toBeVisible();
});

test("never scrolls sideways and meets the footer with no gap", async ({ page }) => {
  await page.goto("/experiments");
  for (let step = 0; step < 30; step++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const gap = await page.evaluate(() => {
    const main = document.querySelector("main")!.getBoundingClientRect().bottom;
    const footer = document.querySelector("footer")!.getBoundingClientRect().top;
    return Math.round(footer - main);
  });
  expect(gap).toBe(0);
  await expect(page.locator("[data-bg]")).toBeHidden();
});
