import { createHash } from "node:crypto";
import jsQR from "jsqr";
import { PDFDocument, PDFName, PDFRawStream, PDFStream, decodePDFRawStream, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { InspectedUpload } from "@/lib/documents/files";
import { StampError, canStampMime, placePanel, stampFile, stampMatches, visibleToNative } from "@/lib/documents/stamp";
import { verificationUrl } from "@/lib/documents/qr";
import type { StampOptions } from "@/lib/documents/types";

/**
 * The verification stamp. The strongest check here rebuilds the stamp's QR from the PDF's own drawing
 * instructions and decodes it with a QR reader: the squares really do spell the verification address.
 */

const CODE = "ACV-7K3M-9QXD-4TRH";
const OPTIONS: StampOptions = { position: "bottom-right", size: "medium", pages: "first" };

// A 40x30 light-grey PNG.
const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAYAAABe3VzdAAAARUlEQVR4Ac3BAQEAAAiAIPP/2CbUDGH2ESZxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxBwRJA/ywn2asAAAAAElFTkSuQmCC", "base64");

// 16x10 red JPEG, a few hundred bytes.
const TINY_JPEG = Buffer.from(
  "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAAKABADAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAMG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AkoNOAAA//9k=",
  "base64",
);

function upload(filename: string, mimeType: string, bytes: Buffer): InspectedUpload {
  return { filename, mimeType, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), bytes };
}

async function pdf(options: { pages?: number; size?: [number, number]; rotate?: number } = {}): Promise<InspectedUpload> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < (options.pages ?? 1); i += 1) {
    const page = doc.addPage(options.size ?? [595, 842]);
    if (options.rotate) page.setRotation(degrees(options.rotate));
  }
  return upload("certificate.pdf", "application/pdf", Buffer.from(await doc.save()));
}

/** How many pages of a PDF draw the stamp (a page that does has the embedded artwork in its resources). */
async function stampedPages(bytes: Buffer): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc
    .getPages()
    .map((page, index) => {
      const xobjects = page.node.Resources()?.lookup(PDFName.of("XObject"));
      const names = xobjects && "keys" in xobjects ? (xobjects as { keys(): PDFName[] }).keys().map((key) => key.decodeText()) : [];
      return names.some((name) => name.startsWith("EmbeddedPdfPage")) ? index : -1;
    })
    .filter((index) => index >= 0);
}

/** The stamp's drawing instructions (its own small page, embedded in the document). */
async function stampArtwork(bytes: Buffer): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Form") continue;
    return Buffer.from(object instanceof PDFRawStream ? decodePDFRawStream(object).decode() : object.getContents()).toString("latin1");
  }
  throw new Error("no stamp artwork found");
}

/** The size of the stamp artwork's own drawing area; anything drawn outside it is clipped by the viewer. */
async function stampBox(bytes: Buffer): Promise<{ width: number; height: number }> {
  const doc = await PDFDocument.load(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Form") continue;
    const box = String(object.dict.get(PDFName.of("BBox")))
      .replace(/[[\]]/g, "")
      .trim()
      .split(/\s+/)
      .map(Number);
    return { width: box[2] - box[0], height: box[3] - box[1] };
  }
  throw new Error("no stamp artwork found");
}

/** Rebuilds the stamp's QR from its vector rectangles and reads it, like a phone would. */
async function readStampedQr(bytes: Buffer): Promise<string | null> {
  const doc = await PDFDocument.load(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Form") continue;
    const box = String(object.dict.get(PDFName.of("BBox")))
      .replace(/[[\]]/g, "")
      .trim()
      .split(/\s+/)
      .map(Number);
    const [width, height] = [box[2], box[3]];
    const content = Buffer.from(object instanceof PDFRawStream ? decodePDFRawStream(object).decode() : object.getContents()).toString("latin1");
    const scale = 8;
    const w = Math.ceil(width * scale);
    const h = Math.ceil(height * scale);
    const pixels = new Uint8ClampedArray(w * h * 4).fill(255);
    for (const match of content.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g)) {
      const [x, y, rw, rh] = match.slice(1).map(Number);
      const left = Math.round(x * scale);
      const right = Math.round((x + rw) * scale);
      const top = Math.round((height - y - rh) * scale);
      const bottom = Math.round((height - y) * scale);
      for (let row = Math.max(0, top); row < Math.min(h, bottom); row += 1) {
        for (let col = Math.max(0, left); col < Math.min(w, right); col += 1) {
          const at = (row * w + col) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    }
    return jsQR(pixels, w, h)?.data ?? null;
  }
  return null;
}

describe("stampFile: a PDF", () => {
  it("keeps the PDF, adds the stamp, and says what it did", async () => {
    const source = await pdf();
    const { upload: out, stamp } = await stampFile(source, CODE, OPTIONS);
    expect(out.mimeType).toBe("application/pdf");
    expect(out.filename).toBe("certificate.pdf");
    expect(out.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(out.sizeBytes).toBe(out.bytes.length);
    expect(out.sha256).toBe(createHash("sha256").update(out.bytes).digest("hex"));
    expect(stamp).toMatchObject({ code: CODE, position: "bottom-right", size: "medium", pages: "first" });
    expect(Number.isNaN(Date.parse(stamp.at))).toBe(false);
    expect(await stampedPages(out.bytes)).toEqual([0]);
  });

  it("draws a QR that a reader decodes to the record's verification address", async () => {
    const { upload: out } = await stampFile(await pdf(), CODE, OPTIONS);
    expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
  });

  it.each(["small", "medium", "large"] as const)("the %s QR still decodes", async (size) => {
    const { upload: out } = await stampFile(await pdf(), CODE, { ...OPTIONS, size });
    expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
  });

  it("prints the code itself, so the paper can be checked by typing it", async () => {
    const { upload: out } = await stampFile(await pdf(), CODE, OPTIONS);
    const doc = await PDFDocument.load(out.bytes);
    // The marker is in the PDF's metadata; the printed text is in the artwork's content stream.
    expect(doc.getKeywords()).toContain(`aceva-verification:${CODE}`);
    let printed = false;
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Form") continue;
      const content = Buffer.from(object instanceof PDFRawStream ? decodePDFRawStream(object).decode() : object.getContents()).toString("latin1");
      printed = printed || /Tj|TJ/.test(content);
    }
    expect(printed).toBe(true);
  });

  it("puts the stamp on the first, the last, or every page", async () => {
    const three = await pdf({ pages: 3 });
    expect(await stampedPages((await stampFile(three, CODE, { ...OPTIONS, pages: "first" })).upload.bytes)).toEqual([0]);
    expect(await stampedPages((await stampFile(three, CODE, { ...OPTIONS, pages: "last" })).upload.bytes)).toEqual([2]);
    expect(await stampedPages((await stampFile(three, CODE, { ...OPTIONS, pages: "all" })).upload.bytes)).toEqual([0, 1, 2]);
  });

  it("copes with rotated pages", async () => {
    for (const rotate of [90, 180, 270]) {
      const { upload: out } = await stampFile(await pdf({ rotate }), CODE, { ...OPTIONS, position: "top-left" });
      expect(await stampedPages(out.bytes)).toEqual([0]);
      expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
    }
  });

  it("works on a tiny page without overflowing it", async () => {
    const { upload: out } = await stampFile(await pdf({ size: [150, 100] }), CODE, { ...OPTIONS, size: "large" });
    expect(await stampedPages(out.bytes)).toEqual([0]);
  });
});

describe("stampFile: images become a one-page PDF", () => {
  it("turns a PNG into a PDF named .pdf, keeping the picture's shape, with the QR in a strip beneath it", async () => {
    const { upload: out } = await stampFile(upload("scan.2026.png", "image/png", TINY_PNG), CODE, OPTIONS);
    expect(out.mimeType).toBe("application/pdf");
    expect(out.filename).toBe("scan.2026.pdf");
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    // The picture (40x30, fitted to A4 landscape: 793x595) keeps its shape; the strip is added underneath it.
    expect(width).toBeCloseTo(793, 0);
    expect(height).toBeGreaterThan(595);
    expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
  });

  it("turns a JPEG into a PDF too", async () => {
    const { upload: out } = await stampFile(upload("letter.jpg", "image/jpeg", TINY_JPEG), CODE, OPTIONS);
    expect(out.mimeType).toBe("application/pdf");
    expect(out.filename).toBe("letter.pdf");
    expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(1);
  });
});

describe("stampFile: what it refuses, in words an admin can act on", () => {
  const refuses = async (source: InspectedUpload, code = CODE) => {
    try {
      await stampFile(source, code, OPTIONS);
    } catch (error) {
      expect(error).toBeInstanceOf(StampError);
      return error as StampError;
    }
    throw new Error("expected the stamp to be refused");
  };

  it("a WEBP image", async () => {
    const error = await refuses(upload("scan.webp", "image/webp", Buffer.from("RIFF....WEBPVP8 ")));
    expect(error.code).toBe("unsupported");
    expect(error.message).toMatch(/PDF, PNG or JPEG/);
    expect(canStampMime("image/webp")).toBe(false);
    for (const mime of ["application/pdf", "image/png", "image/jpeg"]) expect(canStampMime(mime)).toBe(true);
  });

  it("a password-protected PDF", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.context.trailerInfo.Encrypt = doc.context.register(doc.context.obj({}));
    const error = await refuses(upload("locked.pdf", "application/pdf", Buffer.from(await doc.save())));
    expect(error.code).toBe("encrypted");
    expect(error.message).toMatch(/password/i);
  });

  it("a PDF that cannot be read", async () => {
    const error = await refuses(upload("broken.pdf", "application/pdf", Buffer.from("%PDF-1.7\nthis is not a pdf at all")));
    expect(error.code).toBe("unreadable");
  });

  it("a PDF that already carries a verification QR (it would end up with two)", async () => {
    const once = (await stampFile(await pdf(), CODE, OPTIONS)).upload;
    const error = await refuses(once);
    expect(error.code).toBe("already_stamped");
    expect(error.message).toMatch(/original/i);
  });

  it("a code that is not a verification code", async () => {
    const error = await refuses(await pdf(), "NOT-A-CODE");
    expect(error.code).toBe("bad_code");
  });
});

describe("the stamp's look", () => {
  const numbers = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((match) => match.slice(1).map(Number));

  it("draws no backing and no outline, so it never cuts into a printed frame", async () => {
    const art = await stampArtwork((await stampFile(await pdf(), CODE, OPTIONS)).upload.bytes);
    // A stroked path needs a stroke colour (RG) and a paint operator that strokes (S, s, B, b).
    expect(art).not.toMatch(/\sRG\s/);
    expect(art).not.toMatch(/\n(?:S|s|B|b|B\*|b\*)\n/);
    // No white tile behind the block (the one fill left is the dark QR modules).
    expect(art).not.toMatch(/\n1 1 1 rg\n/);
    expect(art).toMatch(/\nf\n/);
  });

  it.each(["small", "medium", "large"] as const)("the %s block has straight edges: the code spans exactly the QR's width, flush to its left", async (size) => {
    const art = await stampArtwork((await stampFile(await pdf(), CODE, { ...OPTIONS, size })).upload.bytes);
    const rects = numbers(art, /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g);
    const left = Math.min(...rects.map(([x]) => x));
    const right = Math.max(...rects.map(([x, , w]) => x + w));
    const lines = numbers(art, /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g);
    const sizes = numbers(art, /\/[A-Za-z0-9_-]+ (-?[\d.]+) Tf/g).map(([value]) => value);
    expect(lines.length).toBe(2);
    // Both lines start on the QR's left edge...
    for (const [x] of lines) expect(x).toBeCloseTo(left, 2);
    // ...and the code (Courier: 0.6 em per character) ends just inside its right edge: set to 97% of the QR's width, so
    // a font a viewer substitutes for Courier cannot run past it.
    const codeWidth = CODE.length * 0.6 * sizes[0];
    expect(left + codeWidth).toBeLessThanOrEqual(right + 1e-6);
    expect(codeWidth).toBeGreaterThanOrEqual((right - left) * 0.95);
  });

  it("keeps empty room beyond the block, so a line that comes out slightly wide is not clipped in half", async () => {
    const stamped = (await stampFile(await pdf(), CODE, OPTIONS)).upload.bytes;
    const art = await stampArtwork(stamped);
    const box = await stampBox(stamped);
    const rects = numbers(art, /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g);
    const qrRight = Math.max(...rects.map(([x, , w]) => x + w));
    const qrBottom = Math.min(...rects.map(([, y]) => y));
    expect(box.width - qrRight).toBeGreaterThanOrEqual(4);
    // Below the QR sit two lines of text, and below those the same room again.
    expect(qrBottom).toBeGreaterThan(box.height * 0.2);
  });

  it("keeps the printed code legible at every size", async () => {
    for (const size of ["small", "medium", "large"] as const) {
      const art = await stampArtwork((await stampFile(await pdf(), CODE, { ...OPTIONS, size })).upload.bytes);
      const codeSize = numbers(art, /\/[A-Za-z0-9_-]+ (-?[\d.]+) Tf/g)[0][0];
      expect(codeSize).toBeGreaterThanOrEqual(5.5);
    }
  });
});

describe("placement maths", () => {
  const page = { width: 595, height: 842 };
  const panel = { width: 87, height: 104 };

  it("puts the panel in the chosen corner, clear of the edge", () => {
    const br = placePanel(page, panel, "bottom-right");
    const tl = placePanel(page, panel, "top-left");
    expect(br.x + br.width).toBeLessThan(page.width);
    expect(br.y).toBeGreaterThan(0);
    expect(tl.x).toBeGreaterThan(0);
    expect(tl.y + tl.height).toBeLessThan(page.height);
    expect(placePanel(page, panel, "bottom-left").x).toBe(tl.x);
    expect(placePanel(page, panel, "top-right").y).toBe(tl.y);
  });

  it("puts every corner the same distance in from the edges it touches, so the QR lines up wherever it goes", () => {
    const block = { width: 78, height: 102 };
    const spots = Object.fromEntries((["bottom-right", "bottom-left", "top-right", "top-left"] as const).map((corner) => [corner, placePanel(page, block, corner)]));
    const gap = (corner: keyof typeof spots) => ({
      left: spots[corner].x,
      right: page.width - (spots[corner].x + spots[corner].width),
      bottom: spots[corner].y,
      top: page.height - (spots[corner].y + spots[corner].height),
    });
    expect(gap('bottom-right').right).toBeCloseTo(gap('top-right').right, 6);
    expect(gap('bottom-left').left).toBeCloseTo(gap('top-left').left, 6);
    expect(gap('bottom-right').bottom).toBeCloseTo(gap('bottom-left').bottom, 6);
    expect(gap('top-right').top).toBeCloseTo(gap('top-left').top, 6);
    // The same distance on both edges of a corner, and far enough in to clear a printed border.
    expect(gap('bottom-right').right).toBeCloseTo(gap('bottom-right').bottom, 6);
    expect(gap('bottom-right').right).toBeGreaterThanOrEqual(30);
  });

  it("lines the block up with the margin, not the empty room kept beside and below it", () => {
    const withBleed = { width: 83, height: 107, bleed: 5 };
    const right = placePanel(page, withBleed, "bottom-right");
    const left = placePanel(page, withBleed, "top-left");
    // The block ends `bleed` short of the artwork's right and bottom edges; its distance to the page edge is the margin.
    const blockRightGap = page.width - (right.x + right.width - withBleed.bleed);
    const blockBottomGap = right.y + withBleed.bleed;
    const blockLeftGap = left.x;
    const blockTopGap = page.height - (left.y + left.height);
    expect(blockRightGap).toBeCloseTo(blockLeftGap, 6);
    expect(blockBottomGap).toBeCloseTo(blockTopGap, 6);
    expect(blockRightGap).toBeCloseTo(blockBottomGap, 6);
    // And the artwork itself stays on the page.
    expect(right.x + right.width).toBeLessThan(page.width);
    expect(right.y).toBeGreaterThan(0);
  });

  it("stays wholly on the page, even a tiny one", () => {
    const spot = placePanel({ width: 120, height: 90 }, { width: 78, height: 102 }, "top-left");
    expect(spot.x).toBeGreaterThan(0);
    expect(spot.y).toBeGreaterThan(0);
    expect(spot.y + spot.height).toBeLessThan(90);
    expect(spot.x + spot.width).toBeLessThan(120);
  });

  it("never enlarges the panel, and shrinks it on a small page", () => {
    const big = placePanel({ width: 2000, height: 3000 }, panel, "bottom-right");
    expect(big.width).toBe(panel.width);
    const small = placePanel({ width: 150, height: 100 }, panel, "bottom-right");
    expect(small.height).toBeLessThanOrEqual(100 * 0.26 + 0.001);
    expect(small.width / small.height).toBeCloseTo(panel.width / panel.height, 5);
  });

  it.each([0, 90, 180, 270] as const)("maps the reader's view onto a page turned %i degrees, and back", (rotation) => {
    const box = { x: 12, y: 7, width: 300, height: 500 };
    const [a, b, c, d, e, f] = visibleToNative(rotation, box);
    // The page as the reader sees it is 500x300 when turned a quarter, else 300x500.
    const quarter = rotation === 90 || rotation === 270;
    const visible = { width: quarter ? box.height : box.width, height: quarter ? box.width : box.height };
    // The reader's four corners must land on the page's own four corners (in some order), never outside it.
    const corners = [
      [0, 0],
      [visible.width, 0],
      [0, visible.height],
      [visible.width, visible.height],
    ].map(([vx, vy]) => [a * vx + c * vy + e, b * vx + d * vy + f]);
    const wanted = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x, box.y + box.height],
      [box.x + box.width, box.y + box.height],
    ];
    for (const [x, y] of corners) expect(wanted.some(([wx, wy]) => Math.abs(wx - x) < 1e-9 && Math.abs(wy - y) < 1e-9)).toBe(true);
  });

  it("puts the reader's bottom-right in the right native corner for each turn", () => {
    const box = { x: 0, y: 0, width: 300, height: 500 };
    const native = (rotation: 0 | 90 | 180 | 270, vx: number, vy: number) => {
      const [a, b, c, d, e, f] = visibleToNative(rotation, box);
      return [a * vx + c * vy + e, b * vx + d * vy + f];
    };
    // /Rotate is clockwise: the page's own bottom-left ends up at the reader's top-left after 90 degrees.
    expect(native(0, 300, 0)).toEqual([300, 0]);
    expect(native(90, 500, 0)).toEqual([300, 500]);
    expect(native(180, 300, 0)).toEqual([0, 500]);
    expect(native(270, 500, 0)).toEqual([0, 0]);
  });
});

describe("stampMatches", () => {
  const stored = { code: CODE, position: "bottom-right", size: "medium", pages: "first", at: "2026-01-01T00:00:00.000Z" } as const;

  it("is true for the same code and placement, whatever the time", () => {
    expect(stampMatches(stored, { code: CODE, ...OPTIONS })).toBe(true);
  });

  it("is false for a different code, corner, size or pages", () => {
    expect(stampMatches(stored, { code: "ACV-AAAA-AAAA-AAAA", ...OPTIONS })).toBe(false);
    expect(stampMatches(stored, { code: CODE, ...OPTIONS, position: "top-left" })).toBe(false);
    expect(stampMatches(stored, { code: CODE, ...OPTIONS, size: "large" })).toBe(false);
    expect(stampMatches(stored, { code: CODE, ...OPTIONS, pages: "all" })).toBe(false);
  });

  it("treats 'no stamp wanted' and 'no stamp stored' as already in step", () => {
    expect(stampMatches(null, null)).toBe(true);
    expect(stampMatches(undefined, null)).toBe(true);
    expect(stampMatches(stored, null)).toBe(false);
    expect(stampMatches(null, { code: CODE, ...OPTIONS })).toBe(false);
  });
});
