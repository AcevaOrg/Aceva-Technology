import { describe, expect, it } from "vitest";
import {
  clip,
  daysBetween,
  dayNumber,
  describeExpiry,
  formatCount,
  formatDate,
  formatRelative,
  formatUtcStamp,
  plural,
  relativeFromIso,
  shortActor,
  shortId,
  utcDay,
  utcDayOffset,
} from "@/components/admin/pages/format";

/**
 * Formatting for the console pages. These sit between stored data and what an admin reads, so a wrong
 * day count ("expires in 12 days" when it is 11) or a timezone shift on a calendar date would be
 * user-visible and quietly misleading.
 */

describe("formatDate", () => {
  it("formats a calendar day without touching time zones", () => {
    expect(formatDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatDate("2026-12-01")).toBe("1 Dec 2026");
    expect(formatDate("2026-01-31T23:59:59.000Z")).toBe("31 Jan 2026");
  });

  it("shows an em dash for anything that is not a date", () => {
    for (const value of [null, undefined, "", "soon", "2026-13-01", "2026-00-10", "2026-05-00", "12/03/2026"]) {
      expect(formatDate(value)).toBe("—");
    }
  });
});

describe("dayNumber and daysBetween", () => {
  it("counts whole calendar days", () => {
    expect(daysBetween("2026-03-12", "2026-03-13")).toBe(1);
    expect(daysBetween("2026-03-12", "2026-03-12")).toBe(0);
    expect(daysBetween("2026-03-12", "2026-03-01")).toBe(-11);
    expect(daysBetween("2026-02-27", "2026-03-02")).toBe(3);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // leap year
  });

  it("rejects dates that do not exist instead of rolling them over", () => {
    expect(dayNumber("2026-02-30")).toBeNull();
    expect(dayNumber("2026-04-31")).toBeNull();
    expect(dayNumber("nonsense")).toBeNull();
    expect(daysBetween("2026-02-30", "2026-03-01")).toBeNull();
  });
});

describe("utcDay and utcDayOffset", () => {
  const now = new Date("2026-03-12T23:30:00.000Z");

  it("uses the UTC calendar day, whatever the machine's zone", () => {
    expect(utcDay(now)).toBe("2026-03-12");
    expect(utcDay(new Date("2026-03-13T00:00:00.000Z"))).toBe("2026-03-13");
  });

  it("offsets by whole days in both directions", () => {
    expect(utcDayOffset(now, 0)).toBe("2026-03-12");
    expect(utcDayOffset(now, -13)).toBe("2026-02-27");
    expect(utcDayOffset(now, 1)).toBe("2026-03-13");
  });
});

describe("describeExpiry", () => {
  const now = new Date("2026-03-12T09:00:00.000Z");

  it("has nothing to say for a record that does not expire", () => {
    expect(describeExpiry(null, now, 60)).toEqual({ relative: "", tone: "none", days: null });
    expect(describeExpiry("garbage", now, 60).tone).toBe("none");
  });

  it("treats the expiry day itself as still valid, and the next day as expired", () => {
    expect(describeExpiry("2026-03-12", now, 60)).toMatchObject({ relative: "today", tone: "soon", days: 0 });
    expect(describeExpiry("2026-03-11", now, 60)).toMatchObject({ relative: "1 day ago", tone: "expired", days: -1 });
  });

  it("words the near future and flags it as soon only inside the window", () => {
    expect(describeExpiry("2026-03-13", now, 60)).toMatchObject({ relative: "tomorrow", tone: "soon" });
    expect(describeExpiry("2026-03-22", now, 60)).toMatchObject({ relative: "in 10 days", tone: "soon" });
    expect(describeExpiry("2026-05-11", now, 60)).toMatchObject({ relative: "in 60 days", tone: "soon" });
    expect(describeExpiry("2026-05-12", now, 60)).toMatchObject({ relative: "in 61 days", tone: "ok" });
  });

  it("pluralises how long ago it expired", () => {
    expect(describeExpiry("2026-03-02", now, 60).relative).toBe("10 days ago");
  });
});

describe("formatRelative", () => {
  const now = Date.UTC(2026, 2, 12, 12, 0, 0);
  const ago = (ms: number) => formatRelative(now - ms, now);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it("rounds down and never says 0 of anything", () => {
    expect(ago(10_000)).toBe("just now");
    expect(ago(44_000)).toBe("just now");
    expect(ago(46_000)).toBe("1 min ago");
    expect(ago(59 * MIN + 59_000)).toBe("59 min ago");
    expect(ago(HOUR)).toBe("1 hour ago");
    expect(ago(5 * HOUR)).toBe("5 hours ago");
    expect(ago(23 * HOUR + 59 * MIN)).toBe("23 hours ago");
    expect(ago(DAY)).toBe("1 day ago");
    expect(ago(29 * DAY)).toBe("29 days ago");
    expect(ago(30 * DAY)).toBe("1 mo ago");
    expect(ago(364 * DAY)).toBe("12 mo ago");
    expect(ago(365 * DAY)).toBe("1 year ago");
    expect(ago(400 * DAY)).toBe("1 year ago");
    expect(ago(800 * DAY)).toBe("2 years ago");
  });

  it("describes the future too", () => {
    expect(formatRelative(now + 3 * HOUR, now)).toBe("in 3 hours");
    expect(formatRelative(now + 2 * DAY, now)).toBe("in 2 days");
  });

  it("is empty for unusable input", () => {
    expect(formatRelative(Number.NaN, now)).toBe("");
    expect(relativeFromIso("not a date", now)).toBe("");
    expect(relativeFromIso("2026-03-12T11:00:00.000Z", now)).toBe("1 hour ago");
  });
});

describe("formatUtcStamp", () => {
  it("prints the UTC fields with a zone label", () => {
    expect(formatUtcStamp("2026-03-12T14:05:09.000Z")).toBe("12 Mar 2026, 14:05 UTC");
    expect(formatUtcStamp("2026-01-01T00:00:00.000Z")).toBe("1 Jan 2026, 00:00 UTC");
  });

  it("returns an unparseable value unchanged", () => {
    expect(formatUtcStamp("later")).toBe("later");
  });
});

describe("shortActor", () => {
  it("shows the first six characters of the device handle", () => {
    expect(shortActor("admin:a1b2c3d4e5f60718")).toBe("a1b2c3");
    expect(shortActor("a1b2c3d4e5f60718")).toBe("a1b2c3");
  });

  it("copes with a missing or empty actor", () => {
    expect(shortActor("")).toBe("unknown");
    expect(shortActor("   ")).toBe("unknown");
    expect(shortActor("admin:")).toBe("unknown");
  });
});

describe("small helpers", () => {
  it("pluralises", () => {
    expect(plural(1, "document")).toBe("document");
    expect(plural(0, "document")).toBe("documents");
    expect(plural(2, "entry", "entries")).toBe("entries");
  });

  it("formats counts with separators and survives non-numbers", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatCount(Number.NaN)).toBe("0");
  });

  it("takes the first eight characters of an id", () => {
    expect(shortId("0a1b2c3d-1111-4222-8333-444455556666")).toBe("0a1b2c3d");
  });

  it("clips by characters and keeps short text untouched", () => {
    expect(clip("short", 10)).toBe("short");
    expect(clip("abcdefghij", 5)).toBe("abcd…");
    // An emoji is one character, not two UTF-16 units, so it is never split in half.
    expect(clip("\u{1F600}\u{1F600}\u{1F600}\u{1F600}", 3)).toBe("\u{1F600}\u{1F600}…");
  });
});
