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
import { verificationUrl } from "./qr";
import { MAX_STAMPED_BYTES, type FileStamp, type StampOptions, type StampPosition, type StampSize } from "./types";

/**
 * The verification stamp: puts the record's QR and its printed code onto the uploaded file, so the
 * paper itself can be checked, with nothing for the admin to place by hand.
 *
 * - A PDF keeps every page exactly as it was; the stamp is added on top, in the corner chosen, as one
 *   small panel with a white backing (so the QR stays scannable on a coloured or patterned page).
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

/** QR side in points, without its quiet zone. A US-letter page is 612 wide, so even "large" stays modest. */
const QR_SIDE: Record<StampSize, number> = { small: 54, medium: 70, large: 92 };

/** The stamp may take at most this share of the page's shorter side, so it never swamps a small page. */
const MAX_SHARE_OF_PAGE = 0.26;

const INK = rgb(0.04, 0.043, 0.055);
const PAPER = rgb(1, 1, 1);
const HAIRLINE = rgb(0.62, 0.64, 0.68);
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
  width: number;
  height: number;
}

/** The text under the QR: where to go. Falls back to the bare word when the site address cannot be read. */
function captionText(): string {
  try {
    return `Verify at ${new URL(SITE_URL).host}/verify`;
  } catch {
    return "Scan to verify";
  }
}

/**
 * One small PDF page that IS the stamp: white panel, QR, the code in a monospaced face, and a
 * caption. Built once per file and embedded into each target page, so "every page" costs one copy of
 * the artwork however long the document is.
 */
async function buildPanel(code: string, url: string, size: StampSize): Promise<StampPanel> {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const modules = qr.modules.size;
  const side = QR_SIDE[size];
  const cell = side / modules;
  // The QR specification asks for a quiet zone of four modules; never less than 5 pt on paper.
  const pad = Math.max(5, cell * 4);
  const width = side + pad * 2;

  const doc = await PDFDocument.create();
  const codeFont = await doc.embedFont(StandardFonts.CourierBold);
  const captionFont = await doc.embedFont(StandardFonts.Helvetica);

  // Both lines are sized to fit the panel's width, so a long host name shrinks the caption, not the layout.
  const innerWidth = width * 0.94;
  const codeSize = Math.min(11, innerWidth / codeFont.widthOfTextAtSize(code, 1));
  const caption = captionText();
  const captionSize = Math.min(codeSize * 0.78, innerWidth / captionFont.widthOfTextAtSize(caption, 1));

  const codeHeight = codeSize * 1.05;
  const captionHeight = captionSize * 1.15;
  const gap = 3;
  const height = pad + side + gap + codeHeight + gap * 0.6 + captionHeight + pad * 0.7;

  const page = doc.addPage([width, height]);
  page.drawRectangle({ x: 0, y: 0, width, height, color: PAPER, borderColor: HAIRLINE, borderWidth: 0.6 });

  // Dark modules, merged into horizontal runs so a 33x33 symbol is a few hundred rectangles, not a thousand.
  const operators = [setFillingRgbColor(INK.red, INK.green, INK.blue)];
  const top = height - pad;
  for (let row = 0; row < modules; row += 1) {
    let runStart = -1;
    for (let col = 0; col <= modules; col += 1) {
      const dark = col < modules && qr.modules.get(row, col) === 1;
      if (dark && runStart === -1) runStart = col;
      if (!dark && runStart !== -1) {
        operators.push(rectangle(pad + runStart * cell, top - (row + 1) * cell, (col - runStart) * cell, cell));
        runStart = -1;
      }
    }
  }
  operators.push(fill());
  page.pushOperators(...operators);

  const codeY = top - side - gap - codeSize * 0.8;
  page.drawText(code, {
    x: (width - codeFont.widthOfTextAtSize(code, codeSize)) / 2,
    y: codeY,
    size: codeSize,
    font: codeFont,
    color: INK,
  });
  page.drawText(caption, {
    x: (width - captionFont.widthOfTextAtSize(caption, captionSize)) / 2,
    y: codeY - gap * 0.6 - captionSize * 1.05,
    size: captionSize,
    font: captionFont,
    color: MUTED,
  });

  return { doc, page, width, height };
}

/* ------------------------------------------------------------------ *
 * Placing it on a page                                                 *
 * ------------------------------------------------------------------ */

type Rotation = 0 | 90 | 180 | 270;

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

/** Where the panel goes in the visible page, and how large, for one page. */
export function placePanel(
  visible: { width: number; height: number },
  panel: { width: number; height: number },
  position: StampPosition,
): { x: number; y: number; width: number; height: number } {
  const shorter = Math.min(visible.width, visible.height);
  // Far enough in to clear a printed border or a trimmed edge, close enough to stay a corner mark.
  const margin = Math.min(36, Math.max(14, shorter * 0.045));
  // Shrunk only when the page is small; the panel is never enlarged past its natural size.
  const scale = Math.min(1, (shorter * MAX_SHARE_OF_PAGE) / panel.height, (visible.width * 0.5) / panel.width);
  const width = panel.width * scale;
  const height = panel.height * scale;
  const right = position.endsWith("right");
  const bottom = position.startsWith("bottom");
  return {
    x: right ? visible.width - margin - width : margin,
    y: bottom ? margin : visible.height - margin - height,
    width,
    height,
  };
}

function drawPanelOnPage(page: PDFPage, embedded: PDFEmbeddedPage, panel: StampPanel, position: StampPosition): void {
  const box = page.getCropBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const quarterTurned = rotation === 90 || rotation === 270;
  const visible = { width: quarterTurned ? box.height : box.width, height: quarterTurned ? box.width : box.height };
  const spot = placePanel(visible, panel, position);

  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...visibleToNative(rotation, box)));
  page.drawPage(embedded, { x: spot.x, y: spot.y, width: spot.width, height: spot.height });
  page.pushOperators(popGraphicsState());
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
  for (const index of pageIndexes(pages.length, options.pages)) drawPanelOnPage(pages[index], embedded, panel, options.position);

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
    stamp: { code: canonical, position: options.position, size: options.size, pages: options.pages, at: new Date().toISOString() },
  };
}

/** True when a stored stamp matches what the record would be stamped with now (nothing to redo). */
export function stampMatches(current: FileStamp | null | undefined, wanted: (StampOptions & { code: string }) | null): boolean {
  if (!current || !wanted) return current == null && wanted == null;
  return current.code === wanted.code && current.position === wanted.position && current.size === wanted.size && current.pages === wanted.pages;
}
