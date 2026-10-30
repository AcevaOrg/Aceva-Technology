import { expect, test } from "@playwright/test";

const PHASES = ["understand", "design", "build", "launch", "improve"];
const SECTIONS = ["phases", "weekly-update", "ownership", "rules", "process-faq", "first-step"];

test("server HTML carries every phase and section, with nothing pre-hidden by motion", async ({ request }) => {
  const html = await (await request.get("/process")).text();
  for (const key of PHASES) {
    expect(html).toContain(`id="${key}"`);
    expect(html).toContain(`id="${key}-title"`);
  }
  for (const id of SECTIONS) expect(html).toContain(`id="${id}"`);
  expect(html).toContain("Five distinct phases with weekly demos and clear ownership.");
  expect(html).toContain("A feasibility evaluation from a senior engineer");
  expect(html).toContain("Documentation structured for another team to pick up");
  expect(html).toContain("Sample deliverable · Fictional project");
  expect(html).toContain("<table");
  expect(html.match(/<details/g)).toHaveLength(5);
  expect(html).not.toContain("data-armed");
});

test("keeps its title and canonical metadata", async ({ page }) => {
  await page.goto("/process");
  await expect(page).toHaveTitle("Our Development Process — ACEVA Technology");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/process$/);
});

test("has one h1 and never skips a heading level", async ({ page }) => {
  await page.goto("/process");
  await expect(page.locator("main h1")).toHaveCount(1);
  const levels = await page.locator("main :is(h1,h2,h3,h4)").evaluateAll((els) => els.map((el) => Number(el.tagName[1])));
  for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
});

test("revealed sections end fully visible after scrolling", async ({ page }) => {
  await page.goto("/process");
  for (const id of SECTIONS) {
    const heading = page.locator(`#${id}-title, #${id} h2`).first();
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    await expect
      .poll(() => heading.evaluate((el) => getComputedStyle(el.closest("[data-reveal]") ?? el).opacity))
      .toBe("1");
  }
});

test("under reduced motion nothing is armed or animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/process");
  await page.waitForTimeout(1500);
  await expect(page.locator("[data-armed]")).toHaveCount(0);
  const running = await page.evaluate(() => {
    const root = document.querySelector("[data-process-root]")!;
    return document
      .getAnimations()
      .filter((a) => a.playState === "running" && root.contains((a.effect as KeyframeEffect | null)?.target ?? null)).length;
  });
  expect(running).toBe(0);
});

test("the ownership ledger keeps its table semantics at every width", async ({ page }) => {
  await page.goto("/process#ownership");
  const table = page.getByRole("table", { name: "Who holds what, and where this page says so" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(8); // header + 7 rows
  await expect(table.getByRole("rowheader", { name: "Your repository" })).toBeVisible();
});

test("FAQ answers open in place", async ({ page }) => {
  await page.goto("/process#process-faq");
  const faq = page.locator("#process-faq details").first();
  await faq.locator("summary").click();
  await expect(faq).toHaveAttribute("open", "");
  await expect(faq.locator("p")).toContainText("we will not invent a number");
});

test("the close offers the three starting points and the proof", async ({ page }) => {
  await page.goto("/process#first-step");
  const close = page.locator("#first-step");
  for (const situation of ["new", "improve", "help"]) {
    await expect(close.locator(`a[href="/contact?situation=${situation}"]`)).toHaveCount(1);
  }
  await expect(close.getByRole("link", { name: /See the proof/ })).toHaveAttribute("href", "/experiments");
});

test("the hero links jump to each phase", async ({ page }) => {
  await page.goto("/process");
  const jump = page.getByRole("navigation", { name: "Phases" });
  await expect(jump.getByRole("link")).toHaveCount(5);
  await jump.getByRole("link", { name: /Launch/ }).click();
  await expect(page).toHaveURL(/#launch$/);
  await expect(page.locator("#launch-title")).toBeInViewport();
});

test("never scrolls sideways and meets the footer with no gap", async ({ page }) => {
  await page.goto("/process");
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

test("fits a 360px phone without sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/process");
  for (const id of ["process-title", ...SECTIONS]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
