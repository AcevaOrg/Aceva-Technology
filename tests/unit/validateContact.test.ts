import { describe, expect, it } from "vitest";
import { CONTACT_LIMITS, errorSummary, validateContact } from "@/lib/validateContact";

describe("validateContact", () => {
  it("accepts a valid contact", () => {
    expect(validateContact({
      name: "Jordan Ellis",
      email: "jordan@example.com",
      details: "We need help rebuilding our customer portal.",
    })).toEqual({});
  });

  it("rejects missing, malformed, and short values", () => {
    expect(validateContact({ name: " ", email: "invalid", details: "Too short" })).toEqual({
      name: true,
      email: true,
      details: true,
    });
  });

  it("enforces maximum lengths", () => {
    expect(validateContact({
      name: "n".repeat(CONTACT_LIMITS.name + 1),
      email: `${"a".repeat(CONTACT_LIMITS.email)}@example.com`,
      details: "d".repeat(CONTACT_LIMITS.detailsMax + 1),
    })).toEqual({ name: true, email: true, details: true });
  });

  it("builds a useful error summary", () => {
    expect(errorSummary({ email: true, company: true })).toContain("valid work email");
    expect(errorSummary({ email: true, company: true })).toContain("shorter company name");
  });
});
