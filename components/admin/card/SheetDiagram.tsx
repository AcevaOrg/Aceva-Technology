import s from "./card.module.css";
import { marksPath, type Paper, type SheetPage } from "./cardLayout";

interface SheetDiagramProps {
  paper: Paper;
  pages: readonly SheetPage[];
}

/**
 * A schematic of the sheet(s) about to print: the paper, where each label lands and the crop marks. Drawn
 * in millimetres from the same plan the real print sheet uses, so what is shown here is what comes out of
 * the printer. No artwork: the live preview above already shows that.
 */
export function SheetDiagram({ paper, pages }: SheetDiagramProps) {
  return (
    <div className={s.diagramRow}>
      {pages.map((page, pageIndex) => (
        <figure key={pageIndex} className={s.diagramPage}>
          <svg
            className={s.diagram}
            viewBox={`0 0 ${paper.widthMm} ${paper.heightMm}`}
            role="img"
            aria-label={`Sheet ${pageIndex + 1} of ${pages.length}, ${paper.label}: ${page.caption}`}
          >
            <rect className={s.dPaper} width={paper.widthMm} height={paper.heightMm} />
            {page.placements.map((placement, index) => (
              <rect key={index} className={s.dLabel} x={placement.x} y={placement.y} width={placement.width} height={placement.height} rx={1.5} />
            ))}
            <path className={s.dMarks} d={marksPath(page.marks)} />
          </svg>
          <figcaption className={s.diagramCaption}>{page.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}
