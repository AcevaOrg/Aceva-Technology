import { describe, expect, it } from "vitest";
import { checkSpamContent, isDisposableEmail } from "@/lib/spamFilter";

describe("spam filtering", () => {
  it("allows an ordinary project enquiry", () => {
    expect(checkSpamContent("Our operations team needs a dashboard to replace several spreadsheets.").isSpam).toBe(false);
  });

  it("rejects content with several strong spam indicators", () => {
    const result = checkSpamContent("SEO services and link building will improve your ranking on the first page of Google.");
    expect(result.isSpam).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(5);
  });

  it("detects known disposable domains case-insensitively", () => {
    expect(isDisposableEmail("person@MAILINATOR.COM")).toBe(true);
    expect(isDisposableEmail("person@company.com")).toBe(false);
  });
});
