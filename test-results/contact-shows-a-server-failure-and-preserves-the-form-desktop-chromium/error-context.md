# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: contact.spec.ts >> shows a server failure and preserves the form
- Location: tests\e2e\contact.spec.ts:21:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Your name')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]: Internal Server Error
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | async function completeForm(page: import("@playwright/test").Page) {
> 4  |   await page.getByLabel("Your name").fill("Jordan Ellis");
     |                                      ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  5  |   await page.getByLabel("Work email").fill("jordan@example.com");
  6  |   await page.getByLabel("What is the problem, in your own words").fill("We need help rebuilding our customer portal this quarter.");
  7  | }
  8  | 
  9  | test("submits a valid contact enquiry", async ({ page }) => {
  10 |   await page.route("**/api/contact", (route) => route.fulfill({
  11 |     status: 200,
  12 |     contentType: "application/json",
  13 |     body: JSON.stringify({ ok: true }),
  14 |   }));
  15 |   await page.goto("/contact");
  16 |   await completeForm(page);
  17 |   await page.getByRole("button", { name: "Send to a senior" }).click();
  18 |   await expect(page.getByText("Received. A senior will read this.")).toBeVisible();
  19 | });
  20 | 
  21 | test("shows a server failure and preserves the form", async ({ page }) => {
  22 |   await page.route("**/api/contact", (route) => route.fulfill({
  23 |     status: 502,
  24 |     contentType: "application/json",
  25 |     body: JSON.stringify({ ok: false, message: "Email delivery is temporarily unavailable." }),
  26 |   }));
  27 |   await page.goto("/contact");
  28 |   await completeForm(page);
  29 |   await page.getByRole("button", { name: "Send to a senior" }).click();
  30 |   await expect(page.getByText("Email delivery is temporarily unavailable.")).toBeVisible();
  31 |   await expect(page.getByLabel("Your name")).toHaveValue("Jordan Ellis");
  32 | });
  33 | 
```