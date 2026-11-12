import { describe, expect, it } from "vitest";
import {
  LABELS,
  LABEL_CROP,
  LABEL_GAP_MM,
  LABEL_LIST,
  PAPERS,
  PAPER_LIST,
  SHEET_MARGIN_MM,
  cropMarksFor,
  isLabelKind,
  isPaperId,
  marksPath,
  maxGrid,
  planGrid,
  planLabelSheet,
  type CropSegment,
  type PaperId,
  type Placement,
} from "@/components/admin/card/cardLayout";

const PAPER_IDS: PaperId[] = ["a4", "letter"];

function overlaps(a: Placement, b: Placement): boolean {
  return a.x < b.x + b.width - 1e-9 && b.x < a.x + a.width - 1e-9 && a.y < b.y + b.height - 1e-9 && b.y < a.y + a.height - 1e-9;
}

function segmentInsideRect(segment: CropSegment, rect: Placement): boolean {
  // A mark may touch the label's edge line only at its own corner; any part strictly inside the label is a defect.
  const midX = (segment.x1 + segment.x2) / 2;
  const midY = (segment.y1 + segment.y2) / 2;
  return midX > rect.x + 1e-9 && midX < rect.x + rect.width - 1e-9 && midY > rect.y + 1e-9 && midY < rect.y + rect.height - 1e-9;
}

describe("paper constants", () => {
  it("uses the real ISO and US sizes", () => {
    expect(PAPERS.a4).toMatchObject({ widthMm: 210, heightMm: 297, cssSize: "A4" });
    expect(PAPERS.letter).toMatchObject({ widthMm: 215.9, heightMm: 279.4, cssSize: "letter" });
    expect(PAPER_LIST.map((paper) => paper.id)).toEqual(["a4", "letter"]);
  });

  it("recognises paper ids", () => {
    expect(isPaperId("a4")).toBe(true);
    expect(isPaperId("letter")).toBe(true);
    expect(isPaperId("legal")).toBe(false);
    expect(isPaperId(undefined)).toBe(false);
  });
});

describe("planGrid", () => {
  it("centres the block on the paper", () => {
    const grid = planGrid(PAPERS.a4, LABELS.strip, 2, 1, LABEL_GAP_MM);
    expect(grid.usedWidthMm).toBe(186);
    expect(grid.usedHeightMm).toBe(40);
    expect(grid.placements).toEqual([
      { x: 12, y: 128.5, width: 90, height: 40 },
      { x: 108, y: 128.5, width: 90, height: 40 },
    ]);
    expect(grid.fits).toBe(true);
  });

  it("lays cells out row by row", () => {
    const grid = planGrid(PAPERS.a4, { widthMm: 40, heightMm: 20 }, 2, 2, 10);
    expect(grid.placements.map((p) => [p.x, p.y])).toEqual([
      [60, 123.5],
      [110, 123.5],
      [60, 153.5],
      [110, 153.5],
    ]);
  });

  it("reports a grid that does not fit instead of hiding it", () => {
    expect(planGrid(PAPERS.a4, { widthMm: 100, heightMm: 100 }, 2, 1, 9).fits).toBe(false);
    expect(planGrid(PAPERS.a4, { widthMm: 100, heightMm: 100 }, 1, 3, 9).fits).toBe(false);
    // 190 + 2 * 10 margin is exactly 210: it fits to the millimetre.
    expect(planGrid(PAPERS.a4, { widthMm: 190, heightMm: 10 }, 1, 1, 0).fits).toBe(true);
  });

  it("never plans fewer than one row or column", () => {
    const grid = planGrid(PAPERS.a4, { widthMm: 20, heightMm: 20 }, 0, -3, 5);
    expect(grid.cols).toBe(1);
    expect(grid.rows).toBe(1);
    expect(grid.placements).toHaveLength(1);
  });
});

describe("maxGrid", () => {
  it("counts what fits inside the margin", () => {
    expect(maxGrid(PAPERS.a4, LABELS.square25, LABEL_GAP_MM)).toEqual({ cols: 6, rows: 9 });
    expect(maxGrid(PAPERS.letter, LABELS.square25, LABEL_GAP_MM)).toEqual({ cols: 6, rows: 8 });
    expect(maxGrid(PAPERS.a4, LABELS.strip, LABEL_GAP_MM)).toEqual({ cols: 2, rows: 6 });
  });

  it("returns zero for something larger than the paper", () => {
    expect(maxGrid(PAPERS.a4, { widthMm: 400, heightMm: 400 }, 5)).toEqual({ cols: 0, rows: 0 });
  });
});

describe("crop marks", () => {
  const rect: Placement = { x: 10, y: 20, width: 90, height: 40 };

  it("draws eight marks, two at each corner, pointing away from the label", () => {
    const marks = cropMarksFor(rect, LABEL_CROP);
    expect(marks).toHaveLength(8);
    // top-left corner: a horizontal tick to the left and a vertical tick above
    expect(marks).toContainEqual({ x1: 9, y1: 20, x2: 7.2, y2: 20 });
    expect(marks).toContainEqual({ x1: 10, y1: 19, x2: 10, y2: 17.2 });
    // bottom-right corner: right and below
    expect(marks).toContainEqual({ x1: 101, y1: 60, x2: 102.8, y2: 60 });
    expect(marks).toContainEqual({ x1: 100, y1: 61, x2: 100, y2: 62.8 });
  });

  it("never prints a mark on the label itself", () => {
    for (const mark of cropMarksFor(rect, LABEL_CROP)) expect(segmentInsideRect(mark, rect)).toBe(false);
  });

  it("keeps the neighbouring labels' marks apart", () => {
    // Two marks on the same cut line, one from each label, must not touch: that would read as one long rule.
    const reach = 2 * (LABEL_CROP.offsetMm + LABEL_CROP.lengthMm);
    expect(LABEL_GAP_MM).toBeGreaterThan(reach);
  });

  it("serialises to one SVG path", () => {
    expect(marksPath([{ x1: 1, y1: 2, x2: 3, y2: 2 }, { x1: 5, y1: 6, x2: 5, y2: 9.5 }])).toBe("M1 2L3 2M5 6L5 9.5");
    expect(marksPath([])).toBe("");
  });
});

describe("planLabelSheet", () => {
  it("fills the sheet with as many as fit", () => {
    const strip = planLabelSheet({ label: "strip", paper: "a4", copies: "fill" });
    expect(strip.capacity).toBe(12);
    expect(strip.count).toBe(12);
    expect(strip.pages).toHaveLength(1);
    expect(strip.pages[0].placements).toHaveLength(12);

    expect(planLabelSheet({ label: "square25", paper: "a4", copies: "fill" }).count).toBe(54);
    // 35 mm labels on a 41 mm pitch: 4 across (196 / 41) and 6 down (283 / 41)
    expect(planLabelSheet({ label: "square35", paper: "a4", copies: "fill" }).capacity).toBe(24);
    expect(planLabelSheet({ label: "square50", paper: "letter", copies: "fill" }).capacity).toBe(12);
  });

  it("places a single label in the first slot of the same grid", () => {
    const fill = planLabelSheet({ label: "square50", paper: "a4", copies: "fill" });
    const one = planLabelSheet({ label: "square50", paper: "a4", copies: "one" });
    expect(one.count).toBe(1);
    expect(one.capacity).toBe(fill.capacity);
    expect(one.pages[0].placements[0]).toEqual(fill.pages[0].placements[0]);
    expect(one.pages[0].marks).toHaveLength(8);
    expect(one.pages[0].caption).toBe("One label");
  });

  for (const label of LABEL_LIST) {
    for (const paper of PAPER_IDS) {
      it(`${label.id} on ${paper}: inside the margin, no overlaps, every mark on the paper`, () => {
        const plan = planLabelSheet({ label: label.id, paper, copies: "fill" });
        const { widthMm, heightMm } = PAPERS[paper];
        expect(plan.fits).toBe(true);
        expect(plan.count).toBeGreaterThan(0);
        const placements = plan.pages[0].placements;
        for (const [index, a] of placements.entries()) {
          expect(a.width).toBe(label.widthMm);
          expect(a.height).toBe(label.heightMm);
          expect(a.x).toBeGreaterThanOrEqual(SHEET_MARGIN_MM - 1e-9);
          expect(a.y).toBeGreaterThanOrEqual(SHEET_MARGIN_MM - 1e-9);
          expect(a.x + a.width).toBeLessThanOrEqual(widthMm - SHEET_MARGIN_MM + 1e-9);
          expect(a.y + a.height).toBeLessThanOrEqual(heightMm - SHEET_MARGIN_MM + 1e-9);
          for (const b of placements.slice(index + 1)) expect(overlaps(a, b)).toBe(false);
          for (const mark of cropMarksFor(a, LABEL_CROP)) expect(segmentInsideRect(mark, a)).toBe(false);
        }
        expect(plan.pages[0].marks).toHaveLength(placements.length * 8);
        for (const mark of plan.pages[0].marks) {
          for (const value of [mark.x1, mark.x2]) expect(value >= 0 && value <= widthMm).toBe(true);
          for (const value of [mark.y1, mark.y2]) expect(value >= 0 && value <= heightMm).toBe(true);
        }
      });
    }
  }

  it("has the four requested label designs", () => {
    expect(LABEL_LIST.map((label) => [label.id, label.widthMm, label.heightMm])).toEqual([
      ["square25", 25, 25],
      ["square35", 35, 35],
      ["square50", 50, 50],
      ["strip", 90, 40],
    ]);
  });

  it("recognises label kinds without trusting inherited names", () => {
    expect(isLabelKind("strip")).toBe(true);
    expect(isLabelKind("square99")).toBe(false);
    expect(isLabelKind("toString")).toBe(false);
    expect(isLabelKind(25)).toBe(false);
  });
});
