/**
 * Print geometry for QR labels. Everything is in millimetres, because that is the unit a printer, a
 * guillotine and a sheet of sticker paper all agree on. Pure and dependency-free so the maths can be
 * unit tested without a browser.
 *
 * Coordinates are measured from the top-left corner of the page, x to the right and y downwards, which
 * is also how CSS (`left` / `top`) and SVG lay things out, so a placement can be used as-is.
 */

/** Clear space kept around the whole layout. Most desktop printers cannot reach the last 3 to 6 mm. */
export const SHEET_MARGIN_MM = 10;
/** Space between two labels: wide enough that their crop marks sit side by side without touching. */
export const LABEL_GAP_MM = 6;

const EPSILON = 1e-6;

const round2 = (value: number): number => Math.round(value * 100) / 100;

/* ------------------------------------------------------------------ *
 * Paper                                                                *
 * ------------------------------------------------------------------ */

export type PaperId = "a4" | "letter";

export interface Paper {
  id: PaperId;
  label: string;
  widthMm: number;
  heightMm: number;
  /** Value for the CSS `@page { size }` descriptor. */
  cssSize: string;
}

export const PAPERS: Record<PaperId, Paper> = {
  a4: { id: "a4", label: "A4", widthMm: 210, heightMm: 297, cssSize: "A4" },
  letter: { id: "letter", label: "Letter", widthMm: 215.9, heightMm: 279.4, cssSize: "letter" },
};

export const PAPER_LIST: readonly Paper[] = [PAPERS.a4, PAPERS.letter];

export function isPaperId(value: unknown): value is PaperId {
  return value === "a4" || value === "letter";
}

/* ------------------------------------------------------------------ *
 * Grids and crop marks                                                 *
 * ------------------------------------------------------------------ */

export interface Size {
  widthMm: number;
  heightMm: number;
}

/** Where something sits on the page: the top-left corner and its size. */
export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridPlan {
  placements: Placement[];
  cols: number;
  rows: number;
  usedWidthMm: number;
  usedHeightMm: number;
  /** True when the whole grid, plus the margin on every side, is inside the paper. */
  fits: boolean;
}

/** Lays `cols` x `rows` cells out row by row and centres the block on the paper. */
export function planGrid(
  paper: Paper,
  cell: Size,
  cols: number,
  rows: number,
  gapMm: number,
  marginMm: number = SHEET_MARGIN_MM,
): GridPlan {
  const columnCount = Math.max(1, Math.floor(cols));
  const rowCount = Math.max(1, Math.floor(rows));
  const usedWidth = columnCount * cell.widthMm + (columnCount - 1) * gapMm;
  const usedHeight = rowCount * cell.heightMm + (rowCount - 1) * gapMm;
  const left = (paper.widthMm - usedWidth) / 2;
  const top = (paper.heightMm - usedHeight) / 2;

  const placements: Placement[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < columnCount; col += 1) {
      placements.push({
        x: round2(left + col * (cell.widthMm + gapMm)),
        y: round2(top + row * (cell.heightMm + gapMm)),
        width: cell.widthMm,
        height: cell.heightMm,
      });
    }
  }

  return {
    placements,
    cols: columnCount,
    rows: rowCount,
    usedWidthMm: round2(usedWidth),
    usedHeightMm: round2(usedHeight),
    fits: usedWidth + 2 * marginMm <= paper.widthMm + EPSILON && usedHeight + 2 * marginMm <= paper.heightMm + EPSILON,
  };
}

/** How many cells of this size fit on the paper (inside the margin), per axis. Zero when none do. */
export function maxGrid(
  paper: Paper,
  cell: Size,
  gapMm: number,
  marginMm: number = SHEET_MARGIN_MM,
): { cols: number; rows: number } {
  const cols = Math.floor((paper.widthMm - 2 * marginMm + gapMm + EPSILON) / (cell.widthMm + gapMm));
  const rows = Math.floor((paper.heightMm - 2 * marginMm + gapMm + EPSILON) / (cell.heightMm + gapMm));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

export interface CropSpec {
  /** Distance between the label's corner and the start of a mark, so a mark never prints on the label. */
  offsetMm: number;
  lengthMm: number;
}

export const LABEL_CROP: CropSpec = { offsetMm: 1, lengthMm: 1.8 };

export interface CropSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The eight marks of one cut-out: a horizontal and a vertical tick outside each corner. */
export function cropMarksFor(rect: Placement, spec: CropSpec): CropSegment[] {
  const { offsetMm, lengthMm } = spec;
  const segments: CropSegment[] = [];
  const corners: Array<{ x: number; y: number; dx: -1 | 1; dy: -1 | 1 }> = [
    { x: rect.x, y: rect.y, dx: -1, dy: -1 },
    { x: rect.x + rect.width, y: rect.y, dx: 1, dy: -1 },
    { x: rect.x, y: rect.y + rect.height, dx: -1, dy: 1 },
    { x: rect.x + rect.width, y: rect.y + rect.height, dx: 1, dy: 1 },
  ];
  for (const corner of corners) {
    segments.push({
      x1: round2(corner.x + corner.dx * offsetMm),
      y1: round2(corner.y),
      x2: round2(corner.x + corner.dx * (offsetMm + lengthMm)),
      y2: round2(corner.y),
    });
    segments.push({
      x1: round2(corner.x),
      y1: round2(corner.y + corner.dy * offsetMm),
      x2: round2(corner.x),
      y2: round2(corner.y + corner.dy * (offsetMm + lengthMm)),
    });
  }
  return segments;
}

/** One SVG path (`d`) drawing every segment, in the page's millimetre coordinates. */
export function marksPath(segments: readonly CropSegment[]): string {
  return segments.map((s) => `M${s.x1} ${s.y1}L${s.x2} ${s.y2}`).join("");
}

/** A page of a print job: what is placed where, and the marks to cut by. */
export interface SheetPage {
  caption: string;
  placements: Placement[];
  marks: CropSegment[];
}

/* ------------------------------------------------------------------ *
 * QR label sheets                                                      *
 * ------------------------------------------------------------------ */

export type LabelKind = "square25" | "square35" | "square50" | "strip";
export type LabelCopies = "one" | "fill";

export interface LabelSpec extends Size {
  id: LabelKind;
  label: string;
  hint: string;
}

export const LABELS: Record<LabelKind, LabelSpec> = {
  square25: { id: "square25", label: "25 mm", widthMm: 25, heightMm: 25, hint: "Small square: the QR code alone. For a folder spine or a file tab." },
  square35: { id: "square35", label: "35 mm", widthMm: 35, heightMm: 35, hint: "Square with a scan caption. For a certificate corner or a binder." },
  square50: { id: "square50", label: "50 mm", widthMm: 50, heightMm: 50, hint: "Large square with the reference number." },
  strip: { id: "strip", label: "Strip", widthMm: 90, heightMm: 40, hint: "90 × 40 mm verified-by-ACEVA strip with the title, reference and short link." },
};

export const LABEL_LIST: readonly LabelSpec[] = [LABELS.square25, LABELS.square35, LABELS.square50, LABELS.strip];

export function isLabelKind(value: unknown): value is LabelKind {
  // `in` would also accept inherited names such as "toString".
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LABELS, value);
}

export interface LabelSheetPlan {
  paper: Paper;
  label: LabelSpec;
  copies: LabelCopies;
  pages: SheetPage[];
  /** Labels that fit on one sheet. */
  capacity: number;
  /** Labels this plan actually places. */
  count: number;
  fits: boolean;
}

/**
 * Plans a sheet of one label design. "fill" tiles as many as fit inside the margin; "one" places a single
 * label in the first position of that same grid, so the rest of a sticker sheet stays usable.
 */
export function planLabelSheet(input: { label: LabelKind; paper: PaperId; copies: LabelCopies }): LabelSheetPlan {
  const paper = PAPERS[input.paper];
  const label = LABELS[input.label];
  const { cols, rows } = maxGrid(paper, label, LABEL_GAP_MM);

  if (cols < 1 || rows < 1) {
    return { paper, label, copies: input.copies, pages: [], capacity: 0, count: 0, fits: false };
  }

  const grid = planGrid(paper, label, cols, rows, LABEL_GAP_MM);
  const capacity = cols * rows;
  const placements = input.copies === "one" ? grid.placements.slice(0, 1) : grid.placements;
  const marks = placements.flatMap((placement) => cropMarksFor(placement, LABEL_CROP));
  const caption = placements.length === 1 ? "One label" : `${placements.length} labels`;

  return {
    paper,
    label,
    copies: input.copies,
    pages: [{ caption, placements, marks }],
    capacity,
    count: placements.length,
    fits: grid.fits,
  };
}
