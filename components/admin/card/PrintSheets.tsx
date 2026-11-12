"use client";

import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/components/admin/hooks";
import s from "./card.module.css";
import { marksPath, type Paper, type Placement, type SheetPage } from "./cardLayout";

interface PrintSheetsProps {
  paper: Paper;
  pages: readonly SheetPage[];
  /** Draws one cell. `idPrefix` is unique per copy (logo gradients need unique ids). */
  renderCell: (placement: Placement, idPrefix: string) => ReactNode;
}

/**
 * The print sheet: every page at the exact size of the chosen paper, each label placed at its millimetre
 * position, crop marks drawn on top. It is portalled to <body> so card.module.css can hide every other
 * child of <body> under @media print (the `body:has(> .printHost)` rule) without having to know a single
 * class name of the admin shell. Unmounting removes it, and with it the rule's effect.
 *
 * The `@page` rule sets the paper size and a zero margin, which is also what makes browsers drop their
 * own header and footer line (the date, the URL): those live in the page margin.
 *
 * Nothing here is visible on screen. It is rendered after mount only, because a portal needs `document`.
 */
export function PrintSheets({ paper, pages, renderCell }: PrintSheetsProps) {
  const mounted = useMounted();
  // Logo gradients are referenced by id; the characters React puts in useId() values are not safe in url(#...).
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!mounted) return null;

  return createPortal(
    <div className={s.printHost} data-print-sheets="" aria-hidden="true">
      <style>{`@page { size: ${paper.cssSize} portrait; margin: 0; }`}</style>
      {pages.map((page, pageIndex) => (
        // 0.4mm shorter than the paper: a block exactly as tall as the page can spill one stray blank page
        // after rounding. Cells and marks are positioned absolutely, so nothing shifts.
        <section
          key={pageIndex}
          className={s.sheetPage}
          style={{ width: `${paper.widthMm}mm`, height: `${paper.heightMm - 0.4}mm` }}
        >
          {page.placements.map((placement, cellIndex) => (
            <div
              key={cellIndex}
              className={s.sheetCell}
              style={{
                left: `${placement.x}mm`,
                top: `${placement.y}mm`,
                width: `${placement.width}mm`,
                height: `${placement.height}mm`,
              }}
            >
              {renderCell(placement, `${uid}p${pageIndex}c${cellIndex}`)}
            </div>
          ))}
          <svg
            className={s.marks}
            viewBox={`0 0 ${paper.widthMm} ${paper.heightMm}`}
            style={{ width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm` }}
            focusable="false"
          >
            <path d={marksPath(page.marks)} />
          </svg>
        </section>
      ))}
    </div>,
    document.body,
  );
}
