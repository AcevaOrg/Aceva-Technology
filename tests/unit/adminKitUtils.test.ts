import { describe, expect, it } from "vitest";
import { fitWithin } from "@/components/admin/imageResize";
import {
  addTags,
  cx,
  describeAccepted,
  formatBytes,
  formatCountdown,
  formatDuration,
  inferMime,
  mimeLabel,
  safeAdminPath,
  toEpochMs,
  validateUpload,
} from "@/components/admin/utils";

/**
 * The admin UI kit's pure helpers. They sit between the browser and the upload/redirect rules, so a
 * wrong limit message or a loose redirect guard would be user-visible even though the server
 * re-checks everything.
 */

describe("cx", () => {
  it("joins the truthy parts only", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
    expect(cx()).toBe("");
  });
});

describe("formatBytes", () => {
  it("uses decimal units so the 4 MB upload limit reads as 4 MB", () => {
    expect(formatBytes(4_000_000)).toBe("4 MB");
    expect(formatBytes(1_000_000)).toBe("1 MB");
    expect(formatBytes(1_200_000)).toBe("1.2 MB");
    expect(formatBytes(12_345_678)).toBe("12 MB");
  });

  it("scales small sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(999)).toBe("999 B");
    expect(formatBytes(1_500)).toBe("1.5 KB");
    expect(formatBytes(380_000)).toBe("380 KB");
  });

  it("does not invent a size for a value that is not one", () => {
    expect(formatBytes(-1)).toBe("unknown size");
    expect(formatBytes(Number.NaN)).toBe("unknown size");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("unknown size");
  });
});

describe("mimeLabel and describeAccepted", () => {
  it("names the four upload types", () => {
    expect(mimeLabel("application/pdf")).toBe("PDF");
    expect(mimeLabel("image/png")).toBe("PNG");
    expect(mimeLabel("image/jpeg")).toBe("JPEG");
    expect(mimeLabel("image/webp")).toBe("WEBP");
    expect(mimeLabel("IMAGE/PNG")).toBe("PNG");
  });

  it("falls back to the subtype, or a generic word", () => {
    expect(mimeLabel("image/x-icon")).toBe("ICON");
    expect(mimeLabel("text/csv")).toBe("CSV");
    expect(mimeLabel("")).toBe("FILE");
  });

  it("reads as a sentence fragment", () => {
    expect(describeAccepted([])).toBe("supported");
    expect(describeAccepted(["application/pdf"])).toBe("PDF");
    expect(describeAccepted(["application/pdf", "image/png"])).toBe("PDF or PNG");
    expect(describeAccepted(["application/pdf", "image/png", "image/jpeg", "image/webp"])).toBe("PDF, PNG, JPEG or WEBP");
    expect(describeAccepted(["image/jpeg", "image/jpeg"])).toBe("JPEG");
  });
});

describe("inferMime", () => {
  it("trusts a reported type, lower-cased", () => {
    expect(inferMime({ name: "x.bin", type: "Application/PDF" })).toBe("application/pdf");
  });

  it("falls back to the extension when the browser reports nothing", () => {
    expect(inferMime({ name: "scan.PDF", type: "" })).toBe("application/pdf");
    expect(inferMime({ name: "a.b.jpeg", type: "" })).toBe("image/jpeg");
    expect(inferMime({ name: "photo.webp", type: "" })).toBe("image/webp");
  });

  it("returns an empty string for anything it cannot place", () => {
    expect(inferMime({ name: "archive.zip", type: "" })).toBe("");
    expect(inferMime({ name: "README", type: "" })).toBe("");
  });
});

describe("validateUpload", () => {
  const accept = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
  const LIMIT = 4_000_000;

  it("accepts a file inside the limit", () => {
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: 1_000 }, accept, LIMIT)).toBeNull();
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: LIMIT }, accept, LIMIT)).toBeNull();
  });

  it("accepts a file whose type the browser did not report, by extension", () => {
    expect(validateUpload({ name: "scan.pdf", type: "", size: 1_000 }, accept, LIMIT)).toBeNull();
  });

  it("rejects an empty file first", () => {
    expect(validateUpload({ name: "a.zip", type: "application/zip", size: 0 }, accept, LIMIT)).toBe("That file is empty.");
  });

  it("names the allowed types when the type is wrong", () => {
    expect(validateUpload({ name: "a.zip", type: "application/zip", size: 10 }, accept, LIMIT)).toBe(
      "Use a PDF, PNG, JPEG or WEBP file.",
    );
    expect(validateUpload({ name: "a.png", type: "image/png", size: 10 }, ["application/pdf"], LIMIT)).toBe("Use a PDF file.");
  });

  it("states both the size and the limit when the file is too large", () => {
    expect(validateUpload({ name: "a.pdf", type: "application/pdf", size: 5_000_000 }, accept, LIMIT)).toBe(
      "That file is 5 MB. The limit is 4 MB.",
    );
  });
});

describe("addTags", () => {
  const limits = { max: 12, maxLength: 40 };

  it("splits on commas, semicolons and newlines, trimming and collapsing spaces", () => {
    const result = addTags([], "  react ;  node   js,\nsecurity\r\n,", limits);
    expect(result.next).toEqual(["react", "node js", "security"]);
    expect(result.skipped).toBeNull();
  });

  it("ignores duplicates case-insensitively, including ones already present", () => {
    const result = addTags(["React"], "react, REACT, Vue, vue", limits);
    expect(result.next).toEqual(["React", "Vue"]);
    expect(result.skipped).toBeNull();
  });

  it("rejects an over-long tag instead of cutting it", () => {
    const result = addTags([], "ok, abcdefghij", { max: 5, maxLength: 5 });
    expect(result.next).toEqual(["ok"]);
    expect(result.skipped).toBe("length");
  });

  it("stops at the maximum and says so", () => {
    const result = addTags(["a"], "b, c, d", { max: 2, maxLength: 10 });
    expect(result.next).toEqual(["a", "b"]);
    expect(result.skipped).toBe("limit");
  });

  it("reports the limit even after an earlier over-long tag", () => {
    const result = addTags([], "toolong, a, b", { max: 1, maxLength: 3 });
    expect(result.next).toEqual(["a"]);
    expect(result.skipped).toBe("limit");
  });

  it("does not mutate the array it was given", () => {
    const current = ["a"];
    addTags(current, "b", limits);
    expect(current).toEqual(["a"]);
  });
});

describe("time helpers", () => {
  it("toEpochMs keeps milliseconds and promotes seconds", () => {
    expect(toEpochMs(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toEpochMs(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toEpochMs(1e11)).toBe(1e11);
  });

  it("formatDuration is coarse and never negative", () => {
    expect(formatDuration(0)).toBe("under a minute");
    expect(formatDuration(59_999)).toBe("under a minute");
    expect(formatDuration(-5_000)).toBe("under a minute");
    expect(formatDuration(Number.NaN)).toBe("under a minute");
    expect(formatDuration(60_000)).toBe("1m");
    expect(formatDuration(8 * 60_000)).toBe("8m");
    expect(formatDuration(60 * 60_000)).toBe("1h");
    expect(formatDuration((3 * 60 + 12) * 60_000)).toBe("3h 12m");
  });

  it("formatCountdown pads seconds and rounds up so the clock never shows 0:00 early", () => {
    expect(formatCountdown(42)).toBe("0:42");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(600)).toBe("10:00");
    expect(formatCountdown(41.2)).toBe("0:42");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("safeAdminPath (the client-side second lock on the post-login redirect)", () => {
  it("allows the admin home and anything beneath it", () => {
    expect(safeAdminPath("/admin")).toBe("/admin");
    expect(safeAdminPath("/admin/documents")).toBe("/admin/documents");
    expect(safeAdminPath("/admin/documents?category=certification")).toBe("/admin/documents?category=certification");
    expect(safeAdminPath("/admin?tab=1")).toBe("/admin?tab=1");
  });

  it("refuses everything else and returns the fallback", () => {
    for (const hostile of [
      "//evil.example",
      "https://evil.example/admin",
      "/administrator",
      "/admin//x",
      "/admin\\x",
      "/admin/\nx",
      "/",
      "",
      "admin",
      null,
      undefined,
      42,
      { next: "/admin" },
    ]) {
      expect(safeAdminPath(hostile)).toBe("/admin");
    }
  });

  it("honours a custom fallback", () => {
    expect(safeAdminPath("//evil.example", "/admin/documents")).toBe("/admin/documents");
    expect(safeAdminPath(undefined, "/admin/documents")).toBe("/admin/documents");
  });
});

describe("fitWithin", () => {
  it("scales the longer side down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scaled: true });
    expect(fitWithin(1000, 3000, 1500)).toEqual({ width: 500, height: 1500, scaled: true });
  });

  it("never enlarges, and leaves an exact fit alone", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600, scaled: false });
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600, scaled: false });
  });

  it("never produces a zero-pixel side", () => {
    expect(fitWithin(10_000, 1, 100)).toEqual({ width: 100, height: 1, scaled: true });
  });

  it("returns the input untouched for a limit that makes no sense", () => {
    expect(fitWithin(4000, 3000, 0)).toEqual({ width: 4000, height: 3000, scaled: false });
    expect(fitWithin(4000, 3000, -5)).toEqual({ width: 4000, height: 3000, scaled: false });
    expect(fitWithin(4000, 3000, Number.NaN)).toEqual({ width: 4000, height: 3000, scaled: false });
  });
});
