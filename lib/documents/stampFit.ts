import type { Rect } from "./pageContent";
import type { StampFit, StampPosition } from "./types";

/**
 * Where the stamp goes on a page: the corner the admin chose when it is clear, otherwise the nearest clear spot.
 *
 * Everything here is in the page AS THE READER SEES IT (origin bottom-left, y up), so rotation never enters the search;
 * `toVisibleRect` converts what the page shows into that space first.
 *
 * The order of preference, expressed as a cost so the nearest sensible spot wins:
 *   1. the chosen corner exactly;
 *   2. the chosen corner, slid inward along the page (above a footer, beside a line of text);
 *   3. the neighbouring corners, then the far corner;
 *   4. the same again a little smaller (never below a size that still scans);
 *   5. if nothing is clear, or the page cannot be read: a small strip added to the page, so the stamp can never
 *      cover anything.
 */

export type Rotation = 0 | 90 | 180 | 270;

/** The stamp may take at most this share of the page's shorter side, so it never swamps a small page. */
export const MAX_SHARE_OF_PAGE = 0.26;

/** Clear space kept around the stamp's block, in points. */
const CLEARANCE = 8;
/** Occupancy is tracked on a grid of this many points; finer than a letter's gap, coarse enough to be fast. */
const CELL = 3;
/** How far the stamp is moved at a time while looking for a clear spot. */
const STEP = 6;
/** How far in from the corner it may slide, as a share of the page. */
const MAX_SLIDE = 0.45;
/** The stamp never gets closer than this to the page edge. */
const EDGE = 8;

const SCALES: ReadonlyArray<{ factor: number; penalty: number }> = [
  { factor: 1, penalty: 0 },
  { factor: 0.85, penalty: 70 },
  { factor: 0.72, penalty: 130 },
];
const ADJACENT_CORNER_PENALTY = 90;
const OPPOSITE_CORNER_PENALTY = 140;
const CORNERS: readonly StampPosition[] = ["bottom-right", "bottom-left", "top-right", "top-left"];

/* ------------------------------------------------------------------ *
 * Geometry                                                             *
 * ------------------------------------------------------------------ */

/**
 * Where the panel goes in the visible page, and how large, for one page.
 *
 * Every corner is the same distance in from both edges it touches, whatever the page size, so the QR's own edge lies on
 * the same line wherever it is put. That distance (7% of the shorter side, 14 to 48 pt) is far enough in to sit inside
 * a typical printed border and to leave the clear margin a QR needs, and close enough to stay a corner mark. `bleed`
 * is the empty room the artwork keeps to its right and below (0 when there is none); it hangs outside that line.
 */
export function placePanel(
  visible: { width: number; height: number },
  panel: { width: number; height: number; bleed?: number },
  position: StampPosition,
): { x: number; y: number; width: number; height: number } {
  const shorter = Math.min(visible.width, visible.height);
  // Shrunk only when the page is small; the block is never enlarged past its natural size.
  const scale = Math.min(1, (shorter * MAX_SHARE_OF_PAGE) / panel.height, (visible.width * 0.5) / panel.width);
  const width = panel.width * scale;
  const height = panel.height * scale;
  const bleed = (panel.bleed ?? 0) * scale;
  const edge = Math.min(48, Math.max(14, shorter * 0.07));
  const right = position.endsWith("right");
  const bottom = position.startsWith("bottom");
  return {
    x: right ? visible.width - edge - width + bleed : edge,
    y: bottom ? edge - bleed : visible.height - edge - height,
    width,
    height,
  };
}

/** A point of the page's own coordinate system, as the reader sees it. The inverse of `visibleToNative` in stamp.ts. */
export function nativeToVisible(rotation: Rotation, box: { x: number; y: number; width: number; height: number }, x: number, y: number): [number, number] {
  const relativeX = x - box.x;
  const relativeY = y - box.y;
  switch (rotation) {
    case 90:
      return [relativeY, box.width - relativeX];
    case 180:
      return [box.width - relativeX, box.height - relativeY];
    case 270:
      return [box.height - relativeY, relativeX];
    default:
      return [relativeX, relativeY];
  }
}

/** A rectangle of the page's own coordinates, as the reader sees it (still axis-aligned: pages turn in quarters). */
export function toVisibleRect(rect: Rect, rotation: Rotation, box: { x: number; y: number; width: number; height: number }): Rect {
  const corners = [
    nativeToVisible(rotation, box, rect.x0, rect.y0),
    nativeToVisible(rotation, box, rect.x1, rect.y0),
    nativeToVisible(rotation, box, rect.x0, rect.y1),
    nativeToVisible(rotation, box, rect.x1, rect.y1),
  ];
  return {
    x0: Math.min(...corners.map(([x]) => x)),
    y0: Math.min(...corners.map(([, y]) => y)),
    x1: Math.max(...corners.map(([x]) => x)),
    y1: Math.max(...corners.map(([, y]) => y)),
  };
}

/* ------------------------------------------------------------------ *
 * Which parts of the page are taken                                    *
 * ------------------------------------------------------------------ */

/** The page cut into small cells, each marked taken or not, with running totals so "is this area clear?" is one lookup. */
class Occupancy {
  private readonly columns: number;
  private readonly rows: number;
  private readonly sums: Uint32Array;

  constructor(width: number, height: number, boxes: readonly Rect[]) {
    this.columns = Math.max(1, Math.ceil(width / CELL));
    this.rows = Math.max(1, Math.ceil(height / CELL));
    const taken = new Uint8Array(this.columns * this.rows);
    for (const box of boxes) {
      const column0 = Math.max(0, Math.floor(box.x0 / CELL));
      const column1 = Math.min(this.columns - 1, Math.ceil(box.x1 / CELL) - 1);
      const row0 = Math.max(0, Math.floor(box.y0 / CELL));
      const row1 = Math.min(this.rows - 1, Math.ceil(box.y1 / CELL) - 1);
      for (let row = row0; row <= row1; row += 1) {
        for (let column = column0; column <= column1; column += 1) taken[row * this.columns + column] = 1;
      }
    }
    const stride = this.columns + 1;
    this.sums = new Uint32Array(stride * (this.rows + 1));
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        this.sums[(row + 1) * stride + column + 1] =
          taken[row * this.columns + column] + this.sums[row * stride + column + 1] + this.sums[(row + 1) * stride + column] - this.sums[row * stride + column];
      }
    }
  }

  /** True when no cell touched by `rect` is taken. */
  isClear(rect: Rect): boolean {
    const column0 = Math.max(0, Math.floor(rect.x0 / CELL));
    const column1 = Math.min(this.columns - 1, Math.ceil(rect.x1 / CELL) - 1);
    const row0 = Math.max(0, Math.floor(rect.y0 / CELL));
    const row1 = Math.min(this.rows - 1, Math.ceil(rect.y1 / CELL) - 1);
    if (column1 < column0 || row1 < row0) return true;
    const stride = this.columns + 1;
    const total =
      this.sums[(row1 + 1) * stride + column1 + 1] - this.sums[row0 * stride + column1 + 1] - this.sums[(row1 + 1) * stride + column0] + this.sums[row0 * stride + column0];
    return total === 0;
  }
}

/* ------------------------------------------------------------------ *
 * Fitting                                                              *
 * ------------------------------------------------------------------ */

export interface FitInput {
  visible: { width: number; height: number };
  /** The artwork's size, with the empty room (`bleed`) it keeps to its right and below. */
  panel: { width: number; height: number; bleed: number };
  /** The corner the admin chose. */
  position: StampPosition;
  /** What the page shows, in visible coordinates. */
  boxes: readonly Rect[];
  /** The page could not be read well enough to promise it has free space: use the strip. */
  blind: boolean;
}

export interface FitResult {
  outcome: StampFit;
  /** Lower-left corner and size of the artwork, in the visible page AFTER any strip is added. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Set when the page must grow to hold the stamp: on which side, and by how much. */
  band: { side: "bottom" | "top"; size: number } | null;
}

function cornerPenalty(chosen: StampPosition, corner: StampPosition): number {
  if (chosen === corner) return 0;
  const sameSide = chosen.endsWith("right") === corner.endsWith("right");
  const sameLevel = chosen.startsWith("bottom") === corner.startsWith("bottom");
  return sameSide || sameLevel ? ADJACENT_CORNER_PENALTY : OPPOSITE_CORNER_PENALTY;
}

export function fitStamp(input: FitInput): FitResult {
  const { visible, panel, position, boxes, blind } = input;
  const scaled = (factor: number) => placePanel(visible, { width: panel.width * factor, height: panel.height * factor, bleed: panel.bleed * factor }, position);

  if (!blind) {
    const occupancy = new Occupancy(visible.width, visible.height, boxes);
    const maxX = Math.floor((visible.width * MAX_SLIDE) / STEP);
    const maxY = Math.floor((visible.height * MAX_SLIDE) / STEP);
    let best: { cost: number; result: FitResult } | null = null;

    for (const corner of CORNERS) {
      for (const scale of SCALES) {
        const base = placePanel(visible, { width: panel.width * scale.factor, height: panel.height * scale.factor, bleed: panel.bleed * scale.factor }, corner);
        const bleed = panel.bleed * scale.factor * (base.width / (panel.width * scale.factor));
        const fixed = cornerPenalty(position, corner) + scale.penalty;
        if (best && fixed >= best.cost) continue;
        const towardsLeft = corner.endsWith("right") ? -1 : 1;
        const towardsTop = corner.startsWith("bottom") ? 1 : -1;

        for (let iy = 0; iy <= maxY; iy += 1) {
          for (let ix = 0; ix <= maxX; ix += 1) {
            const cost = fixed + Math.hypot(ix * STEP, iy * STEP);
            if (best && cost >= best.cost) continue;
            const x = base.x + towardsLeft * ix * STEP;
            const y = base.y + towardsTop * iy * STEP;
            // The block is the artwork without the empty room kept to its right and below.
            const block: Rect = { x0: x, y0: y + bleed, x1: x + base.width - bleed, y1: y + base.height };
            if (block.x0 < EDGE || block.y0 < EDGE || block.x1 > visible.width - EDGE || block.y1 > visible.height - EDGE) continue;
            const wanted: Rect = { x0: block.x0 - CLEARANCE, y0: block.y0 - CLEARANCE, x1: block.x1 + CLEARANCE, y1: block.y1 + CLEARANCE };
            if (!occupancy.isClear(wanted)) continue;
            const untouched = corner === position && scale.factor === 1 && ix === 0 && iy === 0;
            best = { cost, result: { outcome: untouched ? "as-chosen" : "moved", x, y, width: base.width, height: base.height, band: null } };
          }
        }
      }
    }
    if (best) return best.result;
  }

  // Nothing is clear (or the page cannot be read): add a strip to the page and put the stamp in it.
  const base = scaled(1);
  const bleed = panel.bleed * (base.width / panel.width);
  const blockHeight = base.height - bleed;
  const gap = Math.min(24, Math.max(10, Math.min(visible.width, visible.height) * 0.035));
  const size = blockHeight + gap * 2;
  const onBottom = position.startsWith("bottom");
  const newHeight = visible.height + size;
  return {
    outcome: "strip",
    x: base.x,
    y: onBottom ? gap - bleed : newHeight - gap - base.height,
    width: base.width,
    height: base.height,
    band: { side: onBottom ? "bottom" : "top", size },
  };
}
