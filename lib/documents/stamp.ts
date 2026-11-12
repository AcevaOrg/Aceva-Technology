import { createHash } from "node:crypto";
import QRCode from "qrcode";
import {
  EncryptedPDFError,
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingRgbColor,
  type PDFEmbeddedPage,
  type PDFPage,
} from "pdf-lib";
import { SITE_URL } from "@/lib/seo";
import { normalizeVerificationCode } from "./codes";
import { sanitizeFilename, type InspectedUpload } from "./files";
import { MAX_OPERATORS, analysePage } from "./pageContent";
import { verificationUrl } from "./qr";
import { fitStamp, toVisibleRect, type FitResult, type Rotation } from "./stampFit";
import { MAX_STAMPED_BYTES, type FileStamp, type StampFit, type StampOptions, type StampSize } from "./types";

// Where a stamp goes on a page is worked out in stampFit.ts; it is re-exported because it is part of how a stamp looks.
export { placePanel } from "./stampFit";

/**
 * The verification stamp: puts the record's QR and its printed code onto the uploaded file, so the
 * paper itself can be checked, with nothing for the admin to place by hand.
 *
 * - A PDF keeps every page exactly as it was; the stamp is added on top, in the corner chosen, as one small block:
 *   the QR, the code and a caption, printed straight onto the page with no backing and no outline, so it never
 *   cuts into a printed frame or pattern. It is set in from the edge so it sits inside a typical border.
 * - A PNG or JPEG cannot carry a drawing, so it becomes a one-page PDF of the same picture, and the
 *   stamp goes on that. (PDF-lib cannot read WEBP; that is refused with a plain message.)
 * - The QR is drawn as vector squares, not a picture, so it stays sharp at any print size.
 * - Rotated pages (/Rotate) and cropped pages are handled: the stamp lands in the corner the reader
 *   SEES, whatever the file's internal orientation.
 *
 * The stamp is a pure function of (file, code, options). It never reads or writes the database; the
 * store keeps the untouched original next to the stamped copy so a later change of code or placement
 * is applied to the original, never stacked on a stamped file.
 */

export type StampErrorCode = "unsupported" | "encrypted" | "unreadable" | "already_stamped" | "too_large" | "bad_code";

export class StampError extends Error {
  readonly code: StampErrorCode;
  constructor(code: StampErrorCode, message: string) {
    super(message);
    this.name = "StampError";
    this.code = code;
  }
}

export function isStampError(error: unknown): error is StampError {
  return error instanceof StampError;
}

/** The formats a stamp can be put on (a WEBP can be stored, but not stamped). */
export const STAMPABLE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export function canStampMime(mimeType: string): boolean {
  return (STAMPABLE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Written into the PDF's Keywords so a file that already carries a stamp is recognised, not stamped twice. */
const MARKER_PREFIX = "aceva-verification:";
const MARKER_PATTERN = /aceva-verification:(ACV-[0-9A-Z-]+)/;

/**
 * QR side in points, without its quiet zone. The code and the caption are each sized to span exactly this width, so the
 * side also decides how large that text can be: these sizes keep the printed code at 5.7 pt or more.
 */
const QR_SIDE: Record<StampSize, number> = { small: 62, medium: 78, large: 98 };

/** The caption is only worth printing if it can be set at least this large; below it the shorter form is used. */
const MIN_CAPTION_SIZE = 5;

/**
 * The code and the caption are set to this share of the QR's width, not all of it. A viewer that has no Courier or
 * Helvetica of its own substitutes a font whose letters run a hair wider, and a line set to exactly the QR's width
 * would then end past its edge.
 */
const TEXT_FIT = 0.97;

/**
 * Empty room, in points, kept to the right of and below the block inside the stamp's own drawing area. A PDF clips
 * an embedded page at its edge, so without it the last letter of a line that comes out slightly wide is cut in half.
 * Placement accounts for it: the block, not this room, is what lines up with the margin.
 */
const BLEED = 5;

const INK = rgb(0.04, 0.043, 0.055);
const MUTED = rgb(0.32, 0.34, 0.38);

/** An image is laid on a page this size (A4), turned to match the picture's orientation. */
const A4_LONG = 842;
const A4_SHORT = 595;

/* ------------------------------------------------------------------ *
 * The stamp panel                                                      *
 * ------------------------------------------------------------------ */

interface StampPanel {
  doc: PDFDocument;
  page: PDFPage;
  /** Including `bleed` on the right. */
  width: number;
  /** Including `bleed` below. */
  height: number;
  bleed: number;
}

/** The lines that can go under the code, longest first: where to go, down to the bare address, then a plain instruction. */
function captionCandidates(): string[] {
  try {
    const address = `${new URL(SITE_URL).host}/verify`;
    return [`Verify at ${address}`, address];
  } catch {
    return ["Scan to verify"];
  }
}

/**
 * One small PDF page that IS the stamp: the QR, the code in a monospaced face and a caption, with no backing and
 * no outline. Built once per file and embedded into each target page, so "every page" costs one copy of the
 * artwork however long the document is.
 *
 * The three lines are one block with straight edges: the code and the caption are each set to span exactly the
 * QR's width, and all of it is flush to the QR's left edge. The quiet zone a QR needs is the page itself: the
 * block is placed well in from the edge, so a clear margin surrounds it.
 */
async function buildPanel(code: string, url: string, size: StampSize): Promise<StampPanel> {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const side = QR_SIDE[size];
  const cell = side / modules;
  const width = side + BLEED;

  const doc = await PDFDocument.create();
  const codeFont = await doc.embedFont(StandardFonts.CourierBold);
  const captionFont = await doc.embedFont(StandardFonts.Helvetica);

  // Each line is set to span exactly the QR's width, so the block's left and right edges are straight. The caption is
  // never larger than the code, and the longer wording is dropped for the shorter one when it would be too small.
  const room = side * TEXT_FIT;
  const codeSize = Math.min(12, room / codeFont.widthOfTextAtSize(code, 1));
  const fitted = captionCandidates().map((text) => ({ text, size: Math.min(codeSize * 0.9, room / captionFont.widthOfTextAtSize(text, 1)) }));
  const chosen = fitted.find((candidate) => candidate.size >= MIN_CAPTION_SIZE) ?? fitted[fitted.length - 1];
  const caption = chosen.text;
  const captionSize = chosen.size;

  const codeHeight = codeSize * 1.05;
  const captionHeight = captionSize * 1.15;
  const gap = 3;
  const height = side + gap + codeHeight + gap * 0.6 + captionHeight + BLEED;

  // No backing and no outline: a tile behind the block cut notches into a printed frame, and a hairline round it
  // read as a label stuck onto the document.
  const page = doc.addPage([width, height]);

  // Dark modules, merged into horizontal runs so a 33x33 symbol is a few hundred rectangles, not a thousand.
  const operators = [setFillingRgbColor(INK.red, INK.green, INK.blue)];
  const top = height;
  for (let row = 0; row < modules; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= modules; col += 1) {
      const dark = col < modules && qr.modules.get(row, col) === 1;
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        operators.push(rectangle(runStart * cell, top - (row + 1) * cell, (col - runStart) * cell, cell));
        runStart = -1;
      }
    }
  }
  operators.push(fill());
  page.pushOperators(...operators);

  const codeY = top - side - gap - codeSize * 0.8;
  // Flush with the QR's left edge (x = 0), the same edge its first module starts on.
  page.drawText(code, { x: 0, y: codeY, size: codeSize, font: codeFont, color: INK });
  page.drawText(caption, { x: 0, y: codeY - gap * 0.6 - captionSize * 1.05, size: captionSize, font: captionFont, color: MUTED });

  return { doc, page, width, height, bleed: BLEED };
}

/* ------------------------------------------------------------------ *
 * Placing it on a page                                                 *
 * ------------------------------------------------------------------ */

function normalizeRotation(angle: number): Rotation {
  const turned = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return turned as Rotation;
}

/**
 * The matrix that maps the page AS THE READER SEES IT (origin bottom-left, y up) onto the page's own
 * coordinate system. A page with /Rotate 90 stores its content turned a quarter, so a plain "bottom
 * right" would land on the wrong edge without this. Derived from how /Rotate is defined (clockwise).
 */
export function visibleToNative(
  rotation: Rotation,
  box: { x: number; y: number; width: number; height: number },
): [number, number, number, number, number, number] {
  const { x, y, width, height } = box;
  switch (rotation) {
    case 90:
      return [0, 1, -1, 0, x + width, y];
    case 180:
      return [-1, 0, 0, -1, x + width, y + height];
    case 270:
      return [0, -1, 1, 0, x, y + height];
    default:
      return [1, 0, 0, 1, x, y];
  }
}

interface PageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Makes room for the stamp by growing the page: the visible bottom (or top) edge moves out by `size`, so the existing
 * content stays exactly where it was and the new strip is empty. The grown box is returned. The page's own
 * coordinate system may be turned (/Rotate), so the strip is built in the reader's view and converted.
 */
function extendPage(page: PDFPage, rotation: Rotation, box: PageBox, visible: { width: number; height: number }, band: { side: "bottom" | "top"; size: number }): PageBox {
  const matrix = visibleToNative(rotation, box);
  const strip =
    band.side === "bottom"
      ? [[0, -band.size], [visible.width, -band.size], [0, 0], [visible.width, 0]]
      : [[0, visible.height], [visible.width, visible.height], [0, visible.height + band.size], [visible.width, visible.height + band.size]];
  const native = strip.map(([vx, vy]) => [matrix[0] * vx + matrix[2] * vy + matrix[4], matrix[1] * vx + matrix[3] * vy + matrix[5]]);
  const x0 = Math.min(box.x, ...native.map(([x]) => x));
  const y0 = Math.min(box.y, ...native.map(([, y]) => y));
  const x1 = Math.max(box.x + box.width, ...native.map(([x]) => x));
  const y1 = Math.max(box.y + box.height, ...native.map(([, y]) => y));
  const grown = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };

  // The media box must contain the crop box; grow it to hold the new strip as well.
  const media = page.getMediaBox();
  const mediaX0 = Math.min(media.x, grown.x);
  const mediaY0 = Math.min(media.y, grown.y);
  const mediaX1 = Math.max(media.x + media.width, grown.x + grown.width);
  const mediaY1 = Math.max(media.y + media.height, grown.y + grown.height);
  page.setMediaBox(mediaX0, mediaY0, mediaX1 - mediaX0, mediaY1 - mediaY0);
  page.setCropBox(grown.x, grown.y, grown.width, grown.height);
  return grown;
}

export interface PagePlacement {
  /** 0-based page number. */
  page: number;
  outcome: StampFit;
  /** Where the artwork was drawn, in the page as the reader sees it (origin bottom-left), after any strip was added. */
  rect: { x: number; y: number; width: number; height: number };
  /** The strip added to the page, if any: on which side and how deep. */
  strip: { side: "bottom" | "top"; size: number } | null;
}

/**
 * Stamps one page: reads what is on it, finds where the stamp fits without covering any of it, grows the page by a
 * strip if nothing is clear, and draws. `budget` is how many drawing operations the file may still have read.
 * `picture` marks a page that is nothing but a picture we laid on it ourselves (an uploaded PNG or JPEG): its content
 * cannot be read, so it always gets the strip. (It cannot be read here at all: the library only writes a new image
 * into the file when saving, so the page would look empty and the QR would land on the picture.)
 */
function stampPage(
  page: PDFPage,
  embedded: PDFEmbeddedPage,
  panel: StampPanel,
  position: StampOptions["position"],
  budget: number,
  picture: boolean,
): { fit: FitResult; operatorsUsed: number } {
  const box = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const quarterTurned = rotation === 90 || rotation === 270;
  const visible = { width: quarterTurned ? box.height : box.width, height: quarterTurned ? box.width : box.height };

  let content: ReturnType<typeof analysePage>;
  try {
    content = budget > 0 && !picture ? analysePage(page, budget) : { boxes: [], blind: true, operatorsUsed: 0 };
  } catch {
    content = { boxes: [], blind: true, operatorsUsed: 0 };
  }
  const boxes = content.boxes.map((rect) => toVisibleRect(rect, rotation, box));
  const fit = fitStamp({ visible, panel: { width: panel.width, height: panel.height, bleed: panel.bleed }, position, boxes, blind: content.blind });

  const drawBox = fit.band ? extendPage(page, rotation, box, visible, fit.band) : box;
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...visibleToNative(rotation, drawBox)));
  page.drawPage(embedded, { x: fit.x, y: fit.y, width: fit.width, height: fit.height });
  page.pushOperators(popGraphicsState());
  return { fit, operatorsUsed: content.operatorsUsed };
}

/** The most adjusted outcome of several pages: a strip beats a move, and a move beats leaving it where it was chosen. */
function worstFit(placements: readonly PagePlacement[]): StampFit {
  if (placements.some((placement) => placement.outcome === "strip")) return "strip";
  if (placements.some((placement) => placement.outcome === "moved")) return "moved";
  return "as-chosen";
}

function pageIndexes(count: number, pages: StampOptions["pages"]): number[] {
  if (pages === "first") return [0];
  if (pages === "last") return [count - 1];
  return Array.from({ length: count }, (_, index) => index);
}

/* ------------------------------------------------------------------ *
 * Opening the uploaded file                                            *
 * ------------------------------------------------------------------ */

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    // `updateMetadata: false` keeps the file's own Producer / dates; only the Keywords marker is added.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    // The library accepts almost any bytes after "%PDF-" and only fails when the pages are first read, so read them
    // now: a file that is not really a PDF is refused here, with the same message as any other unreadable one.
    doc.getPageCount();
    return doc;
  } catch (error) {
    // The library's own EncryptedPDFError fails an `instanceof` test (its compiled class loses the prototype
    // chain), so the message is checked as well.
    if (error instanceof EncryptedPDFError || (error instanceof Error && /\bis encrypted\b/.test(error.message))) {
      throw new StampError(
        "encrypted",
        "This PDF is password-protected, so the QR cannot be added to it. Upload an unprotected copy, or turn the QR stamp off for this file.",
      );
    }
    throw new StampError("unreadable", "This PDF could not be read, so the QR cannot be added to it. Try saving it again from the program that made it.");
  }
}

async function pdfFromImage(bytes: Uint8Array, mimeType: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  try {
    // A private copy: the library reads a JPEG through `bytes.buffer`, and a small Node Buffer is a slice of a shared
    // pool, so without this a small image is read from the wrong place and refused as "not a JPEG".
    const data = Uint8Array.from(bytes);
    const image = mimeType === "image/png" ? await doc.embedPng(data) : await doc.embedJpg(data);
    const landscape = image.width >= image.height;
    const fit = Math.min((landscape ? A4_LONG : A4_SHORT) / image.width, (landscape ? A4_SHORT : A4_LONG) / image.height);
    const width = image.width * fit;
    const height = image.height * fit;
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  } catch {
    throw new StampError("unreadable", "This image could not be read, so the QR cannot be added to it. Try saving it again as a PNG or JPEG.");
  }
  return doc;
}

/* ------------------------------------------------------------------ *
 * Public API                                                           *
 * ------------------------------------------------------------------ */

export interface StampedFile {
  /** The stamped bytes, ready to store (always a PDF). */
  upload: InspectedUpload;
  /** What to remember about it, to tell later whether the printed QR still matches the record. */
  stamp: FileStamp;
  /** How each stamped page came out (0-based page number): where the QR was wanted, and whether it had to move. */
  placements: PagePlacement[];
}

/**
 * Stamps `source` with `code`. Throws `StampError` with a message fit to show the admin: encrypted or
 * unreadable PDFs, a WEBP, a file that already carries a stamp, or a result too large to serve.
 */
export async function stampFile(source: InspectedUpload, code: string, options: StampOptions): Promise<StampedFile> {
  const canonical = normalizeVerificationCode(code);
  if (!canonical) throw new StampError("bad_code", "A verification code is needed before the QR can be added.");
  if (!canStampMime(source.mimeType)) {
    throw new StampError(
      "unsupported",
      "The QR can only be added to a PDF, PNG or JPEG. Upload one of those, or turn the QR stamp off for this file.",
    );
  }

  const isPdf = source.mimeType === "application/pdf";
  const doc = isPdf ? await loadPdf(source.bytes) : await pdfFromImage(source.bytes, source.mimeType);

  if (isPdf && MARKER_PATTERN.test(doc.getKeywords() ?? "")) {
    throw new StampError(
      "already_stamped",
      "This PDF already carries a verification QR. Upload the original file, without one, and it will be added for you.",
    );
  }

  const panel = await buildPanel(canonical, verificationUrl(canonical), options.size);
  const embedded = await doc.embedPage(panel.page);
  const pages = doc.getPages();
  if (pages.length === 0) throw new StampError("unreadable", "This PDF has no pages, so the QR cannot be added to it.");
  // Each page is read and fitted on its own, so a footer on one page never decides where the QR goes on another.
  const placements: PagePlacement[] = [];
  let budget = MAX_OPERATORS;
  for (const index of pageIndexes(pages.length, options.pages)) {
    const { fit, operatorsUsed } = stampPage(pages[index], embedded, panel, options.position, budget, !isPdf);
    budget -= operatorsUsed;
    placements.push({ page: index, outcome: fit.outcome, rect: { x: fit.x, y: fit.y, width: fit.width, height: fit.height }, strip: fit.band });
  }

  const keywords = doc.getKeywords();
  doc.setKeywords([...(keywords ? [keywords] : []), `${MARKER_PREFIX}${canonical}`]);

  const bytes = Buffer.from(await doc.save());
  if (bytes.length > MAX_STAMPED_BYTES) {
    throw new StampError(
      "too_large",
      "With the QR added, this file would be too large to serve. Compress the PDF, or turn the QR stamp off for this file.",
    );
  }

  // An image becomes a PDF, so its name must say so ("scan.2026.png" -> "scan.2026.pdf").
  const filename = isPdf ? source.filename : sanitizeFilename(`${source.filename.replace(/\.[A-Za-z0-9]{1,8}$/, "")}.pdf`);
  return {
    upload: {
      filename,
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes,
    },
    stamp: {
      code: canonical,
      position: options.position,
      size: options.size,
      pages: options.pages,
      at: new Date().toISOString(),
      fit: worstFit(placements),
    },
    placements,
  };
}

/** True when a stored stamp matches what the record would be stamped with now (nothing to redo). */
export function stampMatches(current: FileStamp | null | undefined, wanted: (StampOptions & { code: string }) | null): boolean {
  if (!current || !wanted) return current == null && wanted == null;
  return current.code === wanted.code && current.position === wanted.position && current.size === wanted.size && current.pages === wanted.pages;
}
