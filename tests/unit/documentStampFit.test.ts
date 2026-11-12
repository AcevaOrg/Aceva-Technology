import { createHash } from "node:crypto";
import jsQR from "jsqr";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFStream, StandardFonts, decodePDFRawStream, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { InspectedUpload } from "@/lib/documents/files";
import { analysePage, type Rect } from "@/lib/documents/pageContent";
import { stampFile, visibleToNative, type PagePlacement } from "@/lib/documents/stamp";
import { fitStamp, nativeToVisible, placePanel, toVisibleRect, type Rotation } from "@/lib/documents/stampFit";
import { verificationUrl } from "@/lib/documents/qr";
import type { StampOptions } from "@/lib/documents/types";

/**
 * Auto-fit: the stamp keeps clear of the page's text, footer and graphics. The integration tests check it against the
 * exact rectangles of text drawn by the test, never against the reader's own estimates.
 */

const CODE = "ACV-7K3M-9QXD-4TRH";
const OPTIONS: StampOptions = { position: "bottom-right", size: "medium", pages: "first" };
const A4: [number, number] = [595, 842];

// A 40x30 light-grey PNG.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAYAAABe3VzdAAAARUlEQVR4Ac3BAQEAAAiAIPP/2CbUDGH2ESZxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidxBwRJA/ywn2asAAAAAElFTkSuQmCC",
  "base64",
);

function upload(filename: string, mimeType: string, bytes: Buffer): InspectedUpload {
  return { filename, mimeType, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), bytes };
}
const asUpload = (bytes: Uint8Array) => upload("certificate.pdf", "application/pdf", Buffer.from(bytes));

const overlaps = (a: Rect, b: Rect, gap = 0) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap;
const rectOf = (p: { x: number; y: number; width: number; height: number }): Rect => ({ x0: p.x, y0: p.y, x1: p.x + p.width, y1: p.y + p.height });

interface Text {
  text: string;
  x: number;
  y: number;
  size: number;
}

/** Where a line of Helvetica text really is: its width from the font's own metrics, and its usual ascent and descent. */
function truth(font: PDFFont, line: Text): Rect {
  return { x0: line.x, y0: line.y - 0.22 * line.size, x1: line.x + font.widthOfTextAtSize(line.text, line.size), y1: line.y + 0.78 * line.size };
}

async function pageWith(lines: Text[], options: { size?: [number, number]; rotate?: number; draw?: (page: PDFPage, font: PDFFont) => void } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage(options.size ?? A4);
  for (const line of lines) page.drawText(line.text, { x: line.x, y: line.y, size: line.size, font });
  options.draw?.(page, font);
  if (options.rotate) page.setRotation(degrees(options.rotate));
  return { bytes: Buffer.from(await doc.save()), font, truth: lines.map((line) => truth(font, line)) };
}

const FOOTER: Text[] = [
  { text: "ACEVA Technology (Private) Limited  |  www.acevatech.com  |  contact@acevatech.com", x: 60, y: 48, size: 9 },
  { text: "Page 1 of 1", x: 490, y: 34, size: 9 },
];
const BODY: Text[] = [
  { text: "CERTIFICATE OF COMPLETION", x: 120, y: 600, size: 24 },
  { text: "This certifies that the holder has completed the programme.", x: 90, y: 560, size: 12 },
];

/** Reads the stamp's QR back out of the PDF's own drawing instructions, like a phone would. */
async function readStampedQr(bytes: Buffer): Promise<string | null> {
  const doc = await PDFDocument.load(bytes);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream) || String(object.dict.get(PDFName.of("Subtype"))) !== "/Form") continue;
    const box = String(object.dict.get(PDFName.of("BBox"))).replace(/[[\]]/g, "").trim().split(/\s+/).map(Number);
    const content = Buffer.from(object instanceof PDFRawStream ? decodePDFRawStream(object).decode() : object.getContents()).toString("latin1");
    const scale = 8;
    const w = Math.ceil(box[2] * scale);
    const h = Math.ceil(box[3] * scale);
    const pixels = new Uint8ClampedArray(w * h * 4).fill(255);
    for (const match of content.matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g)) {
      const [x, y, rw, rh] = match.slice(1).map(Number);
      for (let row = Math.max(0, Math.round((box[3] - y - rh) * scale)); row < Math.min(h, Math.round((box[3] - y) * scale)); row += 1) {
        for (let col = Math.max(0, Math.round(x * scale)); col < Math.min(w, Math.round((x + rw) * scale)); col += 1) {
          const at = (row * w + col) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
      }
    }
    return jsQR(pixels, w, h)?.data ?? null;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Reading a page                                                       *
 * ------------------------------------------------------------------ */

describe("analysePage", () => {
  it("boxes every line of text, a little generously, never short", async () => {
    const { bytes, truth: real } = await pageWith([...BODY, ...FOOTER]);
    const content = analysePage((await PDFDocument.load(bytes)).getPage(0));
    expect(content.blind).toBe(false);
    for (const line of real) {
      const covering = content.boxes.filter((box) => box.x0 <= line.x0 && box.x1 >= line.x1 && box.y0 <= line.y0 && box.y1 >= line.y1);
      expect(covering.length, JSON.stringify(line)).toBeGreaterThan(0);
      // ...but not absurdly large: within 40% of the real width, and a few points of height.
      const tight = covering.sort((a, b) => a.x1 - a.x0 - (b.x1 - b.x0))[0];
      expect(tight.x1 - tight.x0).toBeLessThan((line.x1 - line.x0) * 1.4 + 10);
      expect(tight.y1 - tight.y0).toBeLessThan(line.y1 - line.y0 + 12);
    }
  });

  it("reports an empty page as clear", async () => {
    const { bytes } = await pageWith([]);
    expect(analysePage((await PDFDocument.load(bytes)).getPage(0))).toMatchObject({ boxes: [], blind: false });
  });

  it("ignores a page-sized background fill, but not a smaller filled shape", async () => {
    const { bytes } = await pageWith([], {
      draw: (page) => {
        page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.95, 0.95, 1) });
        page.drawRectangle({ x: 400, y: 40, width: 150, height: 70, color: rgb(0.8, 0.8, 0.9) });
      },
    });
    const { boxes } = analysePage((await PDFDocument.load(bytes)).getPage(0));
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toMatchObject({ x0: 400, y0: 40, x1: 550, y1: 110 });
  });

  it("treats a page-sized outline as a frame: its lines count, the page inside it does not", async () => {
    const { bytes } = await pageWith([], {
      draw: (page) => page.drawRectangle({ x: 20, y: 20, width: 555, height: 802, borderColor: rgb(0.1, 0.2, 0.6), borderWidth: 3 }),
    });
    const { boxes } = analysePage((await PDFDocument.load(bytes)).getPage(0));
    expect(boxes.length).toBe(4);
    const inside = (x: number, y: number) => boxes.some((box) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1);
    expect(inside(297, 421)).toBe(false);
    expect(inside(20, 400)).toBe(true);
    expect(inside(575, 400)).toBe(true);
    expect(inside(300, 20)).toBe(true);
    expect(inside(300, 822)).toBe(true);
  });

  it("counts the lines of a table, and a small filled box, as things to avoid", async () => {
    const { bytes } = await pageWith([], {
      draw: (page) => {
        page.drawLine({ start: { x: 60, y: 100 }, end: { x: 300, y: 100 }, thickness: 1 });
        page.drawRectangle({ x: 450, y: 700, width: 80, height: 30, color: rgb(0, 0, 0) });
      },
    });
    const { boxes } = analysePage((await PDFDocument.load(bytes)).getPage(0));
    expect(boxes.some((box) => box.x0 <= 60 && box.x1 >= 300 && box.y0 <= 100 && box.y1 >= 100)).toBe(true);
    expect(boxes.some((box) => box.x0 <= 450 && box.x1 >= 530 && box.y0 <= 700 && box.y1 >= 730)).toBe(true);
  });

  it("reads text inside an embedded page (a form), where many exporters put everything", async () => {
    const inner = await PDFDocument.create();
    const innerFont = await inner.embedFont(StandardFonts.Helvetica);
    inner.addPage([300, 100]).drawText("Inside a form", { x: 10, y: 40, size: 14, font: innerFont });
    const outer = await PDFDocument.create();
    const embedded = await outer.embedPage(inner.getPage(0));
    const page = outer.addPage(A4);
    page.drawPage(embedded, { x: 100, y: 400 });
    const { boxes, blind } = analysePage((await PDFDocument.load(await outer.save())).getPage(0));
    expect(blind).toBe(false);
    // The text sits at (100 + 10, 400 + 40) on the page.
    expect(boxes.some((box) => box.x0 <= 110 && box.x1 >= 110 + 60 && box.y0 <= 440 && box.y1 >= 446)).toBe(true);
  });

  it("sees pictures: a background picture is ignored, a small one counts, and a page that is only a picture is blind", async () => {
    const onlyBackground = await PDFDocument.create();
    const bg = await onlyBackground.embedPng(TINY_PNG);
    onlyBackground.addPage(A4).drawImage(bg, { x: 0, y: 0, width: 595, height: 842 });
    const alone = analysePage((await PDFDocument.load(await onlyBackground.save())).getPage(0));
    expect(alone.blind).toBe(true);

    const withText = await PDFDocument.create();
    const font = await withText.embedFont(StandardFonts.Helvetica);
    const image = await withText.embedPng(TINY_PNG);
    const page = withText.addPage(A4);
    page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 });
    page.drawImage(image, { x: 60, y: 700, width: 80, height: 60 });
    page.drawText("Text over a picture", { x: 100, y: 400, size: 14, font });
    const mixed = analysePage((await PDFDocument.load(await withText.save())).getPage(0));
    expect(mixed.blind).toBe(false);
    expect(mixed.boxes.some((box) => box.x0 <= 60 && box.x1 >= 140 && box.y0 <= 700 && box.y1 >= 760)).toBe(true);
    // The page-sized picture itself is not a box (that would block the whole page).
    expect(mixed.boxes.every((box) => box.x1 - box.x0 < 500)).toBe(true);
  });

  it("counts form fields, which the viewer draws and the content stream never mentions", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4);
    doc.getForm().createTextField("name").addToPage(page, { x: 300, y: 100, width: 200, height: 24 });
    const { boxes } = analysePage((await PDFDocument.load(await doc.save())).getPage(0));
    expect(boxes.some((box) => box.x0 <= 300 && box.x1 >= 500 && box.y0 <= 100 && box.y1 >= 124)).toBe(true);
  });

  it("gives up on a page that is too long to read, rather than reading it halfway", async () => {
    const lines = Array.from({ length: 200 }, (_, i) => ({ text: `Line ${i}`, x: 40, y: 20 + i * 4, size: 3 }));
    const { bytes } = await pageWith(lines);
    expect(analysePage((await PDFDocument.load(bytes)).getPage(0), 50).blind).toBe(true);
  });

  it("is blind to a page whose drawing instructions it cannot decode", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4);
    const dict = doc.context.obj({ Filter: "NoSuchFilter" });
    const stream = PDFRawStream.of(dict as never, new Uint8Array([1, 2, 3, 4]));
    page.node.set(PDFName.of("Contents"), doc.context.register(stream));
    const content = analysePage((await PDFDocument.load(await doc.save())).getPage(0));
    expect(content.blind).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * Choosing a spot                                                      *
 * ------------------------------------------------------------------ */

describe("fitStamp", () => {
  const visible = { width: 595, height: 842 };
  const panel = { width: 83, height: 111, bleed: 5 };
  const blockOf = (fit: { x: number; y: number; width: number; height: number }): Rect => ({ x0: fit.x, y0: fit.y + panel.bleed, x1: fit.x + fit.width - panel.bleed, y1: fit.y + fit.height });

  it("keeps the chosen corner when it is clear", () => {
    const fit = fitStamp({ visible, panel, position: "bottom-right", boxes: [], blind: false });
    expect(fit).toMatchObject({ outcome: "as-chosen", band: null });
    expect(fit).toMatchObject(placePanel(visible, panel, "bottom-right"));
  });

  it("slides up and clear of a footer", () => {
    const footer: Rect = { x0: 50, y0: 30, x1: 545, y1: 60 };
    const fit = fitStamp({ visible, panel, position: "bottom-right", boxes: [footer], blind: false });
    expect(fit.outcome).toBe("moved");
    expect(overlaps(blockOf(fit), footer)).toBe(false);
    // It stayed in the corner it was asked for: the right-hand side, near the bottom.
    expect(fit.x + fit.width).toBeGreaterThan(500);
    expect(fit.y).toBeLessThan(200);
  });

  it("goes to another corner when sliding would carry it a long way", () => {
    // The whole lower 60% of the page is taken.
    const lower: Rect = { x0: 0, y0: 0, x1: 595, y1: 505 };
    const fit = fitStamp({ visible, panel, position: "bottom-right", boxes: [lower], blind: false });
    expect(fit.outcome).toBe("moved");
    expect(fit.y).toBeGreaterThan(505);
  });

  it("adds a strip when nothing on the page is clear, on the side of the chosen corner", () => {
    const everything: Rect = { x0: 0, y0: 0, x1: 595, y1: 842 };
    const bottom = fitStamp({ visible, panel, position: "bottom-left", boxes: [everything], blind: false });
    expect(bottom).toMatchObject({ outcome: "strip" });
    expect(bottom.band?.side).toBe("bottom");
    // The artwork lies inside the strip: below the original content, which now starts `size` up.
    expect(bottom.y).toBeGreaterThanOrEqual(0);
    expect(bottom.y + bottom.height).toBeLessThanOrEqual((bottom.band?.size ?? 0) + 0.001);

    const top = fitStamp({ visible, panel, position: "top-right", boxes: [everything], blind: false });
    expect(top.band?.side).toBe("top");
    expect(top.y).toBeGreaterThanOrEqual(visible.height - 0.001);
    expect(top.y + top.height).toBeLessThanOrEqual(visible.height + (top.band?.size ?? 0) + 0.001);
  });

  it("adds a strip for a page it cannot read, however empty it looks", () => {
    expect(fitStamp({ visible, panel, position: "bottom-right", boxes: [], blind: true }).outcome).toBe("strip");
  });

  it("never overlaps anything, whatever the page holds (random busy pages, every corner)", () => {
    let seed = 1234567;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 40; round += 1) {
      const boxes: Rect[] = Array.from({ length: 5 + Math.floor(random() * 40) }, () => {
        const x0 = random() * 540;
        const y0 = random() * 800;
        return { x0, y0, x1: x0 + 10 + random() * 150, y1: y0 + 6 + random() * 30 };
      });
      for (const position of ["bottom-right", "bottom-left", "top-right", "top-left"] as const) {
        const fit = fitStamp({ visible, panel, position, boxes, blind: false });
        if (fit.outcome === "strip") continue;
        for (const box of boxes) expect(overlaps(blockOf(fit), box), `${position} round ${round}`).toBe(false);
        expect(fit.x).toBeGreaterThanOrEqual(8);
        expect(fit.x + fit.width - panel.bleed).toBeLessThanOrEqual(595 - 8);
        expect(fit.y + panel.bleed).toBeGreaterThanOrEqual(8);
        expect(fit.y + fit.height).toBeLessThanOrEqual(842 - 8);
      }
    }
  });

  it("may shrink a little to fit a pocket, never below a size that scans", () => {
    // Leave only a pocket in the bottom-right corner, big enough for a smaller stamp but not the full-size one.
    const wall: Rect[] = [
      { x0: 0, y0: 0, x1: 595, y1: 842 },
    ];
    const pocket = { x0: 595 - 120, y0: 20, x1: 595 - 20, y1: 150 };
    const around: Rect[] = [
      { x0: 0, y0: 0, x1: pocket.x0, y1: 842 },
      { x0: pocket.x1, y0: 0, x1: 595, y1: 842 },
      { x0: pocket.x0, y0: pocket.y1, x1: pocket.x1, y1: 842 },
      { x0: pocket.x0, y0: 0, x1: pocket.x1, y1: pocket.y0 },
    ];
    void wall;
    const fit = fitStamp({ visible, panel, position: "bottom-right", boxes: around, blind: false });
    if (fit.outcome !== "strip") {
      expect(fit.width).toBeLessThan(panel.width);
      expect(fit.width).toBeGreaterThanOrEqual(panel.width * 0.72 - 0.001);
      expect(overlaps(blockOf(fit), { x0: 0, y0: 0, x1: pocket.x0, y1: 842 })).toBe(false);
    }
  });
});

describe("page coordinates", () => {
  it.each([0, 90, 180, 270] as const)("turns a point of the page into the reader's view and back, for a page turned %i degrees", (rotation: Rotation) => {
    const box = { x: 12, y: 7, width: 300, height: 500 };
    const [a, b, c, d, e, f] = visibleToNative(rotation, box);
    for (const [x, y] of [[12, 7], [312, 507], [100, 300], [250, 40]]) {
      const [vx, vy] = nativeToVisible(rotation, box, x, y);
      expect([a * vx + c * vy + e, b * vx + d * vy + f]).toEqual([x, y].map((value) => expect.closeTo(value, 9)));
    }
  });

  it("turns a rectangle into the reader's view, still axis-aligned", () => {
    const box = { x: 0, y: 0, width: 300, height: 500 };
    expect(toVisibleRect({ x0: 10, y0: 20, x1: 60, y1: 40 }, 90, box)).toEqual({ x0: 20, y0: 240, x1: 40, y1: 290 });
  });
});

/* ------------------------------------------------------------------ *
 * The stamper, end to end                                              *
 * ------------------------------------------------------------------ */

describe("stampFile keeps clear of the page's content", () => {
  const stampedRect = (placement: PagePlacement) => rectOf(placement.rect);

  it("leaves a clean page where the admin put it", async () => {
    const { bytes } = await pageWith(BODY);
    const { placements, stamp } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("as-chosen");
    expect(stamp.fit).toBe("as-chosen");
    expect(placements[0].strip).toBeNull();
  });

  it("moves up out of a footer, and does not touch a single letter of it", async () => {
    const { bytes, truth: real } = await pageWith([...BODY, ...FOOTER]);
    const { placements, stamp } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("moved");
    expect(stamp.fit).toBe("moved");
    for (const line of real) expect(overlaps(stampedRect(placements[0]), line, 4)).toBe(false);
  });

  it("finds room when there is text in all four corners", async () => {
    const corners: Text[] = [
      { text: "Signature line text", x: 420, y: 60, size: 10 },
      { text: "Signature line text", x: 60, y: 60, size: 10 },
      { text: "Signature line text", x: 420, y: 770, size: 10 },
      { text: "Signature line text", x: 60, y: 770, size: 10 },
    ];
    for (const position of ["bottom-right", "bottom-left", "top-right", "top-left"] as const) {
      const { bytes, truth: real } = await pageWith(corners);
      const { placements } = await stampFile(asUpload(bytes), CODE, { ...OPTIONS, position });
      for (const line of real) expect(overlaps(stampedRect(placements[0]), line, 4), position).toBe(false);
    }
  });

  it("stays inside a printed frame and off its lines", async () => {
    const { bytes } = await pageWith(BODY, {
      draw: (page) => page.drawRectangle({ x: 20, y: 20, width: 555, height: 802, borderColor: rgb(0.1, 0.2, 0.6), borderWidth: 3 }),
    });
    const { placements } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    const spot = stampedRect(placements[0]);
    expect(spot.x1).toBeLessThan(575 - 1.5);
    expect(spot.y0).toBeGreaterThan(20 + 1.5);
  });

  it("avoids a footer bar drawn as a coloured band", async () => {
    const { bytes } = await pageWith(BODY, { draw: (page) => page.drawRectangle({ x: 0, y: 0, width: 595, height: 90, color: rgb(0.1, 0.2, 0.5) }) });
    const { placements } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("moved");
    expect(placements[0].rect.y + 5).toBeGreaterThanOrEqual(90);
  });

  it("adds a strip to a page with no clear room, and puts the stamp in it", async () => {
    const dense = Array.from({ length: 56 }, (_, i) => ({ text: "Dense paragraph text that fills the page from edge to edge across the whole width", x: 24, y: 28 + i * 14, size: 10 }));
    const { bytes, truth: real } = await pageWith(dense);
    const { upload: out, placements, stamp } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("strip");
    expect(stamp.fit).toBe("strip");
    const strip = placements[0].strip;
    expect(strip?.side).toBe("bottom");
    const page = (await PDFDocument.load(out.bytes)).getPage(0);
    expect(page.getHeight()).toBeCloseTo(842 + (strip?.size ?? 0), 3);
    // The stamp lies wholly in the new strip; the page's own content did not move (it starts `size` higher).
    expect(placements[0].rect.y + placements[0].rect.height).toBeLessThanOrEqual((strip?.size ?? 0) + 0.001);
    for (const line of real) expect(line.y0 + (strip?.size ?? 0)).toBeGreaterThan(placements[0].rect.y + placements[0].rect.height - 0.001);
    expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
  });

  it("puts the strip on top when the chosen corner is at the top", async () => {
    const dense = Array.from({ length: 56 }, (_, i) => ({ text: "Dense paragraph text that fills the page from edge to edge across the whole width", x: 24, y: 28 + i * 14, size: 10 }));
    const { bytes } = await pageWith(dense);
    const { placements } = await stampFile(asUpload(bytes), CODE, { ...OPTIONS, position: "top-left" });
    expect(placements[0].strip?.side).toBe("top");
    expect(placements[0].rect.y).toBeGreaterThanOrEqual(842 - 0.001);
  });

  it("an uploaded picture always gets the strip: nothing can be said about what is in it", async () => {
    const { upload: out, placements, stamp } = await stampFile(upload("scan.png", "image/png", TINY_PNG), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("strip");
    expect(stamp.fit).toBe("strip");
    const page = (await PDFDocument.load(out.bytes)).getPage(0);
    // The picture keeps its shape (40x30 fitted to A4 landscape: 793x595); the strip is added beneath it.
    expect(page.getWidth()).toBeCloseTo(793, 0);
    expect(page.getHeight()).toBeGreaterThan(595);
    expect(page.getHeight()).toBeLessThan(595 * 1.35);
  });

  it("adds a strip rather than guess at a page it cannot read", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage(A4);
    page.node.set(PDFName.of("Contents"), doc.context.register(PDFRawStream.of(doc.context.obj({ Filter: "NoSuchFilter" }) as never, new Uint8Array([1, 2, 3]))));
    const { placements } = await stampFile(asUpload(await doc.save()), CODE, OPTIONS);
    expect(placements[0].outcome).toBe("strip");
  });

  it("works out each page on its own, and reports the most adjusted one", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const first = doc.addPage(A4);
    for (const line of FOOTER) first.drawText(line.text, { x: line.x, y: line.y, size: line.size, font });
    doc.addPage(A4);
    const { placements, stamp } = await stampFile(asUpload(await doc.save()), CODE, { ...OPTIONS, pages: "all" });
    expect(placements.map((placement) => placement.outcome)).toEqual(["moved", "as-chosen"]);
    expect(stamp.fit).toBe("moved");
  });

  it.each([90, 180, 270])("keeps clear of text sitting under the chosen corner of a page turned %i degrees", async (rotate) => {
    const box = { x: 0, y: 0, width: 595, height: 842 };
    // The middle of the chosen corner as the reader sees the page (landscape-shaped when turned a quarter), converted
    // to the page's own coordinates: that is where the text must be drawn to sit right under the stamp.
    const quarter = rotate === 90 || rotate === 270;
    const view = { width: quarter ? 842 : 595, height: quarter ? 595 : 842 };
    const corner = placePanel(view, { width: 83, height: 111, bleed: 5 }, "bottom-right");
    const [a, b, c, d, e, f] = visibleToNative(rotate as Rotation, box);
    const [cx, cy] = [corner.x + corner.width / 2, corner.y + corner.height / 2];
    const [x, y] = [a * cx + c * cy + e, b * cx + d * cy + f];
    const { bytes, truth: native } = await pageWith([{ text: "Signed and sealed", x, y, size: 10 }, { text: "Second line", x, y: y + 12, size: 10 }], { rotate });
    const { placements } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    const visible = native.map((rect) => toVisibleRect(rect, rotate as Rotation, box));
    expect(placements[0].outcome).toBe("moved");
    for (const line of visible) expect(overlaps(stampedRect(placements[0]), line, 4), `rotated ${rotate}`).toBe(false);
  });

  it("grows the right side of a turned page when it needs a strip", async () => {
    const dense = Array.from({ length: 56 }, (_, i) => ({ text: "Dense paragraph text that fills the page from edge to edge across the whole width", x: 24, y: 28 + i * 14, size: 10 }));
    const { bytes } = await pageWith(dense, { rotate: 90 });
    const { upload: out, placements } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    const strip = placements[0].strip;
    expect(strip).not.toBeNull();
    const crop = (await PDFDocument.load(out.bytes)).getPage(0).getCropBox();
    // /Rotate 90: the reader's bottom is the page's own right edge, so it is the native WIDTH that grew.
    expect(crop.width).toBeCloseTo(595 + (strip?.size ?? 0), 3);
    expect(crop.height).toBeCloseTo(842, 3);
  });

  it("the QR still decodes wherever it ended up", async () => {
    const { bytes } = await pageWith([...BODY, ...FOOTER]);
    const { upload: out } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    expect(await readStampedQr(out.bytes)).toBe(verificationUrl(CODE));
  });

  it("does not change what was already on the page", async () => {
    const { bytes } = await pageWith([...BODY, ...FOOTER]);
    const before = analysePage((await PDFDocument.load(bytes)).getPage(0)).boxes;
    const { upload: out } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    const after = analysePage((await PDFDocument.load(out.bytes)).getPage(0)).boxes;
    // Every original box is still there, unmoved (the stamp only adds boxes of its own).
    for (const box of before) expect(after.some((other) => other.x0 === box.x0 && other.y0 === box.y0 && other.x1 === box.x1 && other.y1 === box.y1)).toBe(true);
  });

  it("is the same page count and the same contents array shape as before, plus the stamp", async () => {
    const { bytes } = await pageWith(BODY);
    const { upload: out } = await stampFile(asUpload(bytes), CODE, OPTIONS);
    const doc = await PDFDocument.load(out.bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).node.Contents() instanceof PDFArray || doc.getPage(0).node.Contents() instanceof PDFStream).toBe(true);
  });
});
