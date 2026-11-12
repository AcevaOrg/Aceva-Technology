import { describe, expect, it } from "vitest";
import { ENDING_SOON_DAYS, describeValidity, formatSpan } from "@/components/documents/validity";

const at = (iso: string) => new Date(`${iso}T09:30:00.000Z`);

describe("describeValidity", () => {
  it("is open-ended without an expiry date, and draws nothing", () => {
    expect(describeValidity("2026-01-01", null, at("2026-06-01"))).toEqual({ phase: "open-ended", used: null, daysLeft: null, span: "" });
    expect(describeValidity(null, "", at("2026-06-01")).phase).toBe("open-ended");
  });

  it("treats a malformed expiry as no expiry rather than inventing one", () => {
    for (const bad of ["soon", "2026-13-40", "2026/01/01", "20260101"]) expect(describeValidity("2026-01-01", bad, at("2026-06-01")).phase, bad).toBe("open-ended");
  });

  it("reports the fraction of the period used, halfway through a year", () => {
    const v = describeValidity("2026-01-01", "2027-01-01", at("2026-07-02"));
    expect(v.phase).toBe("running");
    expect(v.used).toBeCloseTo(0.5, 2);
    expect(v.daysLeft).toBe(183);
    expect(v.span).toBe("6 months");
  });

  it("is valid THROUGH the expiry day, matching the verdict chip", () => {
    const last = describeValidity("2026-01-01", "2026-06-01", at("2026-06-01"));
    expect(last).toMatchObject({ phase: "ending", daysLeft: 0, span: "Today" });
    expect(last.used).toBeCloseTo(1, 1);
    const next = describeValidity("2026-01-01", "2026-06-01", at("2026-06-02"));
    expect(next).toMatchObject({ phase: "ended", daysLeft: -1, used: 1, span: "1 day" });
  });

  it("flags the last 90 days as ending, and not a day sooner", () => {
    const end = "2026-12-31";
    expect(describeValidity("2026-01-01", end, at("2026-10-02")).phase).toBe("ending"); // 90 days left
    expect(describeValidity("2026-01-01", end, at("2026-10-01")).phase).toBe("running"); // 91 days left
    expect(ENDING_SOON_DAYS).toBe(90);
  });

  it("pins a long-expired record at a full bar", () => {
    const v = describeValidity("2024-01-01", "2025-12-31", at("2026-11-06"));
    expect(v).toMatchObject({ phase: "ended", used: 1 });
    expect(v.daysLeft).toBeLessThan(0);
    expect(v.span).toBe("10 months");
  });

  it("clamps a record that has not started yet to an empty bar", () => {
    expect(describeValidity("2027-01-01", "2028-01-01", at("2026-06-01")).used).toBe(0);
  });

  it("gives no bar when the start is missing or not before the end, but still says how long is left", () => {
    expect(describeValidity(null, "2027-01-01", at("2026-06-01"))).toMatchObject({ phase: "running", used: null });
    expect(describeValidity("2027-01-01", "2027-01-01", at("2026-06-01")).used).toBeNull();
    expect(describeValidity("2028-01-01", "2027-01-01", at("2026-06-01")).used).toBeNull();
  });

  it("does not drift with the time of day", () => {
    const morning = describeValidity("2026-01-01", "2027-01-01", new Date("2026-07-02T00:00:01.000Z"));
    const night = describeValidity("2026-01-01", "2027-01-01", new Date("2026-07-02T23:59:59.000Z"));
    expect(morning.daysLeft).toBe(night.daysLeft);
  });
});

describe("formatSpan", () => {
  it.each([
    [0, "Today"],
    [-5, "Today"],
    [1, "1 day"],
    [40, "40 days"],
    [60, "60 days"],
    [61, "2 months"],
    [365, "11 months"],
    [730, "23 months"], // 730 days is a hair under 24 average months
    [731, "2 years"],
    [900, "2 years 5 months"],
    [1827, "5 years"],
  ])("%s days reads %j", (days, text) => {
    expect(formatSpan(days)).toBe(text);
  });
});
