import { describe, expect, it } from "vitest";
import {
  attentionTotal,
  buildAttention,
  describeMissing,
  draftsMissingFiles,
  expiredButPublished,
  missingRequiredFiles,
} from "@/components/admin/pages/attention";
import { barHeight, barShare } from "@/components/admin/pages/chartMath";
import { sparkGeometry } from "@/components/admin/pages/sparkGeometry";
import type { DocumentFileMeta, DocumentRecord } from "@/lib/documents/types";
import { requirePhoto } from "../helpers/specOverrides";

/**
 * The dashboard's "Needs attention" rules and the little bits of arithmetic behind its charts.
 * Missing one of these (an expired certificate still public, a draft that can never publish) is
 * exactly what the panel exists to prevent, so each rule is checked on its own and together.
 */

const NOW = new Date("2026-03-12T10:00:00.000Z");

function file(role: "primary" | "photo"): DocumentFileMeta {
  return { id: `f-${role}`, documentId: "d", role, filename: `${role}.pdf`, mimeType: "application/pdf", sizeBytes: 10, sha256: "0".repeat(64), createdAt: "2026-01-01T00:00:00.000Z" };
}

let counter = 0;
function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  counter += 1;
  return {
    id: `0000000${counter}-0000-4000-8000-000000000000`,
    category: "certification",
    title: `Record ${counter}`,
    summary: "",
    status: "published",
    visibility: "public",
    allowDownload: false,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: "",
    referenceNo: "",
    issuedOn: "2026-01-01",
    expiresOn: null,
    verificationCode: null,
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [file("primary")],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

describe("missingRequiredFiles", () => {
  it("flags a missing primary file where the category insists on one", () => {
    expect(missingRequiredFiles(record({ category: "certification", files: [] }))).toEqual(["file"]);
    expect(missingRequiredFiles(record({ category: "certification", files: [file("primary")] }))).toEqual([]);
  });

  it("flags a missing photo where the category requires one", () => {
    // No shipped category requires a photo, so the requirement is switched on for one category here.
    const undo = requirePhoto("program_record");
    try {
      expect(missingRequiredFiles(record({ category: "program_record", files: [] }))).toEqual(["photo"]);
      expect(missingRequiredFiles(record({ category: "program_record", files: [file("photo")] }))).toEqual([]);
    } finally {
      undo();
    }
  });

  it("requires nothing from a category with optional uploads", () => {
    expect(missingRequiredFiles(record({ category: "program_record", files: [] }))).toEqual([]);
  });

  it("words the gap", () => {
    expect(describeMissing(["file"])).toBe("Missing its document file");
    expect(describeMissing(["photo"])).toBe("Missing a photo");
    expect(describeMissing(["file", "photo"])).toBe("Missing its document file and a photo");
  });
});

describe("draftsMissingFiles", () => {
  it("lists drafts that cannot yet be published", () => {
    const stuck = record({ status: "draft", files: [] });
    const ready = record({ status: "draft" });
    const live = record({ status: "published", files: [] });
    expect(draftsMissingFiles([stuck, ready, live])).toEqual([stuck]);
  });

  it("ignores revoked drafts, which are not going anywhere", () => {
    expect(draftsMissingFiles([record({ status: "draft", files: [], revokedAt: "2026-02-01T00:00:00.000Z" })])).toEqual([]);
  });
});

describe("expiredButPublished", () => {
  it("catches a published record past its expiry date", () => {
    const stale = record({ expiresOn: "2026-03-01" });
    expect(expiredButPublished([stale], NOW)).toEqual([stale]);
  });

  it("treats the expiry day itself as still valid", () => {
    expect(expiredButPublished([record({ expiresOn: "2026-03-12" })], NOW)).toEqual([]);
    expect(expiredButPublished([record({ expiresOn: "2026-03-11" })], NOW)).toHaveLength(1);
  });

  it("leaves out records that are not exposed, revoked, or open-ended", () => {
    const candidates = [
      record({ expiresOn: "2026-01-01", status: "draft" }),
      record({ expiresOn: "2026-01-01", status: "archived" }),
      record({ expiresOn: "2026-01-01", visibility: "private" }),
      record({ expiresOn: "2026-01-01", revokedAt: "2026-02-01T00:00:00.000Z" }),
      record({ expiresOn: null }),
    ];
    expect(expiredButPublished(candidates, NOW)).toEqual([]);
  });

  it("still flags an unlisted record, which is reachable by its code", () => {
    expect(expiredButPublished([record({ expiresOn: "2026-01-01", visibility: "unlisted" })], NOW)).toHaveLength(1);
  });
});

describe("buildAttention", () => {
  const base = { now: NOW, soonDays: 60 };

  it("is empty when there is nothing to report", () => {
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: { items: [], total: 0 }, published: { items: [], total: 0 } });
    expect(groups).toEqual([]);
    expect(attentionTotal(groups)).toBe(0);
  });

  it("builds the expiring group from the store's list but only inside the window", () => {
    const near = record({ expiresOn: "2026-04-01", title: "Near" });
    const far = record({ expiresOn: "2027-03-01", title: "Far" });
    const groups = buildAttention({ ...base, soonestExpiring: [near, far], expiringTotal: 9, drafts: null, published: null });
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "expiring", title: "Expiring soon", total: 9, moreHref: "/admin/documents?expiring=1" });
    expect(groups[0].items.map((item) => item.title)).toEqual(["Near"]);
    expect(groups[0].items[0].detail).toBe("Expires 1 Apr 2026, in 20 days");
  });

  it("limits each group but keeps the real total", () => {
    const drafts = Array.from({ length: 8 }, () => record({ status: "draft", files: [] }));
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: { items: drafts, total: 8 }, published: null, perGroup: 3 });
    expect(groups[0].items).toHaveLength(3);
    expect(groups[0].total).toBe(8);
    expect(groups[0].partial).toBe(false);
  });

  it("marks a group partial when the query only saw part of the records", () => {
    const drafts = [record({ status: "draft", files: [] })];
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: { items: drafts, total: 500 }, published: null });
    expect(groups[0].partial).toBe(true);
  });

  it("describes expired-but-live records by how exposed they still are", () => {
    const publicOne = record({ expiresOn: "2026-03-02", visibility: "public", title: "P" });
    const unlisted = record({ expiresOn: "2026-03-02", visibility: "unlisted", title: "U" });
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: null, published: { items: [publicOne, unlisted], total: 2 } });
    expect(groups[0].kind).toBe("expired_published");
    expect(groups[0].items.map((item) => [item.title, item.detail, item.tone])).toEqual([
      ["P", "Expired 10 days ago, still public", "danger"],
      ["U", "Expired 10 days ago, still reachable by its code", "danger"],
    ]);
  });

  it("skips a rule whose query failed, so the caller can say the list is incomplete", () => {
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: null, published: null });
    expect(groups).toEqual([]);
  });

  it("links every item to its editor and sums the groups", () => {
    const stuck = record({ status: "draft", files: [] });
    const stale = record({ expiresOn: "2026-01-01" });
    const groups = buildAttention({ ...base, soonestExpiring: [], expiringTotal: 0, drafts: { items: [stuck], total: 1 }, published: { items: [stale], total: 1 } });
    expect(groups.map((group) => group.kind)).toEqual(["missing_file", "expired_published"]);
    expect(groups[0].items[0].href).toBe(`/admin/documents/${stuck.id}`);
    expect(attentionTotal(groups)).toBe(2);
  });
});

describe("barShare", () => {
  it("is each category's share of the busiest one", () => {
    expect(barShare(10, 10)).toBe(100);
    expect(barShare(5, 10)).toBe(50);
    expect(barShare(1, 3)).toBeCloseTo(33.3, 1);
  });

  it("is zero when there is nothing to compare", () => {
    expect(barShare(0, 10)).toBe(0);
    expect(barShare(3, 0)).toBe(0);
    expect(barShare(-2, 10)).toBe(0);
  });
});

describe("barHeight", () => {
  it("scales to the busiest day and leaves headroom for the count", () => {
    expect(barHeight(10, 10)).toBe(82);
    expect(barHeight(5, 10)).toBe(41);
  });

  it("never rounds a real day down to nothing", () => {
    expect(barHeight(1, 1000)).toBeGreaterThanOrEqual(3);
  });

  it("is flat for a quiet day", () => {
    expect(barHeight(0, 10)).toBe(0);
    expect(barHeight(0, 0)).toBe(0);
  });
});

describe("sparkGeometry", () => {
  it("lays points left to right, with the tallest count at the top padding", () => {
    const geometry = sparkGeometry([0, 5, 10]);
    expect(geometry.points).toHaveLength(3);
    expect(geometry.points[0].x).toBeLessThan(geometry.points[1].x);
    expect(geometry.points[1].x).toBeLessThan(geometry.points[2].x);
    expect(geometry.points[0].y).toBe(geometry.baseline);
    expect(geometry.points[2].y).toBeLessThan(geometry.points[1].y);
    expect(geometry.points[1].y).toBeLessThan(geometry.points[0].y);
  });

  it("draws a flat baseline for an all-zero series rather than dividing by zero", () => {
    const geometry = sparkGeometry([0, 0, 0, 0]);
    expect(new Set(geometry.points.map((point) => point.y))).toEqual(new Set([geometry.baseline]));
    expect(geometry.line.startsWith("M")).toBe(true);
    expect(geometry.line).not.toContain("NaN");
  });

  it("closes the area along the baseline", () => {
    const geometry = sparkGeometry([1, 3, 2]);
    expect(geometry.area.endsWith("Z")).toBe(true);
    expect(geometry.area).toContain(` ${geometry.baseline}`);
  });

  it("copes with one point, none, and bad numbers", () => {
    expect(sparkGeometry([4]).points).toHaveLength(1);
    expect(sparkGeometry([]).line).toBe("");
    expect(sparkGeometry([]).area).toBe("");
    expect(sparkGeometry([Number.NaN, -3, 2]).line).not.toContain("NaN");
  });
});
