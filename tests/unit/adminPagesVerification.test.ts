import { describe, expect, it } from "vitest";
import {
  DAILY_WINDOW_DAYS,
  asVerificationState,
  codeStatus,
  dailyTotals,
  filterByResult,
  parseVerificationQuery,
  summariseDaily,
  verificationHref,
} from "@/components/admin/pages/verificationView";

/**
 * Verification page logic: the URL, the per-day counts behind the chart, and what a code would say if
 * someone scanned it. The daily counts are derived here (the store has no group-by-day query), so
 * their edges matter: a lookup just after midnight UTC must land on the right day.
 */

const NOW = new Date("2026-03-12T10:00:00.000Z");
const ID = "0a1b2c3d-1111-4222-8333-444455556666";

describe("parseVerificationQuery and verificationHref", () => {
  it("defaults to an unfiltered first page", () => {
    expect(parseVerificationQuery({})).toEqual({ result: null, doc: null, page: 1 });
    expect(verificationHref({ result: null, doc: null, page: 1 })).toBe("/admin/verification");
  });

  it("reads and writes a result, a record and a page", () => {
    const query = parseVerificationQuery({ result: "not_found", doc: ID, page: "2" });
    expect(query).toEqual({ result: "not_found", doc: ID, page: 2 });
    expect(verificationHref(query)).toBe(`/admin/verification?result=not_found&doc=${ID}&page=2`);
  });

  it("ignores values that are not real", () => {
    expect(parseVerificationQuery({ result: "maybe", doc: "'; DROP TABLE documents;--", page: "0" })).toEqual({ result: null, doc: null, page: 1 });
  });

  it("resets the page when a filter changes", () => {
    const query = { result: "valid" as const, doc: null, page: 5 };
    expect(verificationHref(query, { result: "revoked" })).toBe("/admin/verification?result=revoked");
    expect(verificationHref(query, { page: 6 })).toBe("/admin/verification?result=valid&page=6");
  });
});

describe("asVerificationState and filterByResult", () => {
  it("recognises the four public outcomes only", () => {
    for (const state of ["valid", "expired", "revoked", "not_found"]) expect(asVerificationState(state)).toBe(state);
    expect(asVerificationState("pending")).toBeNull();
    expect(asVerificationState("")).toBeNull();
  });

  it("filters events by result, or returns a copy of all of them", () => {
    const events = [{ result: "valid" }, { result: "not_found" }, { result: "valid" }];
    expect(filterByResult(events, "valid")).toHaveLength(2);
    expect(filterByResult(events, "revoked")).toEqual([]);
    const all = filterByResult(events, null);
    expect(all).toEqual(events);
    expect(all).not.toBe(events);
  });
});

describe("dailyTotals", () => {
  const stamp = (day: string, time = "12:00:00.000") => ({ at: `${day}T${time}Z` });

  it("returns one point per day, oldest first, ending today, with empty days present", () => {
    const points = dailyTotals([], DAILY_WINDOW_DAYS, NOW);
    expect(points).toHaveLength(DAILY_WINDOW_DAYS);
    expect(points[0].date).toBe("2026-02-27");
    expect(points.at(-1)?.date).toBe("2026-03-12");
    expect(points.every((point) => point.count === 0)).toBe(true);
    expect(points.at(-1)?.label).toBe("12 Mar");
  });

  it("counts each lookup on its UTC day", () => {
    const points = dailyTotals(
      [stamp("2026-03-12"), stamp("2026-03-12", "00:00:00.000"), stamp("2026-03-11", "23:59:59.999"), stamp("2026-03-10")],
      DAILY_WINDOW_DAYS,
      NOW,
    );
    const byDate = Object.fromEntries(points.map((point) => [point.date, point.count]));
    expect(byDate["2026-03-12"]).toBe(2);
    expect(byDate["2026-03-11"]).toBe(1);
    expect(byDate["2026-03-10"]).toBe(1);
    expect(byDate["2026-03-09"]).toBe(0);
  });

  it("ignores lookups outside the window and unparseable timestamps", () => {
    const points = dailyTotals([stamp("2026-02-26"), stamp("2026-03-13"), { at: "garbage" }, { at: "" }], DAILY_WINDOW_DAYS, NOW);
    expect(points.reduce((sum, point) => sum + point.count, 0)).toBe(0);
  });

  it("works for a window of one day", () => {
    expect(dailyTotals([stamp("2026-03-12")], 1, NOW)).toEqual([{ date: "2026-03-12", label: "12 Mar", count: 1 }]);
  });

  it("crosses a month and year boundary", () => {
    const points = dailyTotals([stamp("2025-12-31")], 3, new Date("2026-01-01T01:00:00.000Z"));
    expect(points.map((point) => point.date)).toEqual(["2025-12-30", "2025-12-31", "2026-01-01"]);
    expect(points[1].count).toBe(1);
  });
});

describe("summariseDaily", () => {
  it("totals the window and finds the busiest day", () => {
    const points = [
      { date: "2026-03-10", label: "10 Mar", count: 2 },
      { date: "2026-03-11", label: "11 Mar", count: 5 },
      { date: "2026-03-12", label: "12 Mar", count: 3 },
    ];
    const summary = summariseDaily(points);
    expect(summary.total).toBe(10);
    expect(summary.peak).toBe(5);
    expect(summary.peakDay?.date).toBe("2026-03-11");
  });

  it("has no busiest day when nothing happened", () => {
    expect(summariseDaily(dailyTotals([], 7, NOW))).toEqual({ total: 0, peak: 0, peakDay: null });
  });

  it("keeps the earlier day on a tie", () => {
    const points = [
      { date: "2026-03-10", label: "10 Mar", count: 4 },
      { date: "2026-03-11", label: "11 Mar", count: 4 },
    ];
    expect(summariseDaily(points).peakDay?.date).toBe("2026-03-10");
  });
});

describe("codeStatus", () => {
  const live = { status: "published" as const, visibility: "public" as const, revokedAt: null, expiresOn: null };

  it("reports what a scan of a live record says", () => {
    expect(codeStatus(live, NOW)).toEqual({ live: true, state: "valid" });
    expect(codeStatus({ ...live, visibility: "unlisted" }, NOW)).toEqual({ live: true, state: "valid" });
    expect(codeStatus({ ...live, expiresOn: "2026-03-01" }, NOW)).toEqual({ live: true, state: "expired" });
    expect(codeStatus({ ...live, revokedAt: "2026-02-01T00:00:00.000Z" }, NOW)).toEqual({ live: true, state: "revoked" });
  });

  it("explains why a hidden record scans as unknown", () => {
    for (const hidden of [{ status: "draft" as const }, { status: "archived" as const }, { visibility: "private" as const }]) {
      const status = codeStatus({ ...live, ...hidden }, NOW);
      expect(status.live).toBe(false);
      if (!status.live) expect(status.reason).toContain("not found");
    }
  });

  it("lets revocation win over expiry for a live record", () => {
    expect(codeStatus({ ...live, expiresOn: "2026-01-01", revokedAt: "2026-02-01T00:00:00.000Z" }, NOW)).toEqual({ live: true, state: "revoked" });
  });
});
