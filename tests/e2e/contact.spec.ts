import { expect, test } from "@playwright/test";

async function completeForm(page: import("@playwright/test").Page) {
  await page.getByLabel("Your name").fill("Jordan Ellis");
  await page.getByLabel("Work email").fill("jordan@example.com");
  // Company and Budget range are required by ContactForm.tsx. They were added
  // after this helper was written, so every submit failed client-side
  // validation and neither test ever reached the server — which is why both
  // assertions below looked broken when the application was behaving
  // correctly. "Where you are right now" and "Capability of interest" are
  // selects that already default to a valid option.
  await page.getByLabel("Company").fill("Ellis & Co");
  await page.getByLabel("Budget range").selectOption("small");
  await page.getByLabel("What is the problem, in your own words").fill("We need help rebuilding our customer portal this quarter.");
}

test("submits a valid contact enquiry", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true }),
  }));
  await page.goto("/contact");
  await completeForm(page);
  await page.getByRole("button", { name: "Send to a senior" }).click();
  await expect(page.getByText("Received. A senior will read this.")).toBeVisible();
});

test("shows a server failure and preserves the form", async ({ page }) => {
  await page.route("**/api/contact", (route) => route.fulfill({
    status: 502,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, message: "Email delivery is temporarily unavailable." }),
  }));
  await page.goto("/contact");
  await completeForm(page);
  await page.getByRole("button", { name: "Send to a senior" }).click();
  await expect(page.getByText("Email delivery is temporarily unavailable.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Jordan Ellis");
});
