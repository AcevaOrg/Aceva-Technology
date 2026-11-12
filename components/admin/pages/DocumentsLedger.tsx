import Link from "next/link";
import type { CSSProperties } from "react";
import { adminStyles as ui, Badge, CATEGORY_ICONS, StatusBadge, VerificationBadge, VisibilityBadge } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { adminDocumentRoute } from "@/lib/nav";
import type { LedgerRowModel } from "./rowModel";
import { RowActions } from "./RowActions";
import s from "./pages.module.css";

interface DocumentsLedgerProps {
  rows: readonly LedgerRowModel[];
}

/**
 * The documents list: one hairline-ruled row per record. The title is a link stretched over the whole
 * row (the kit's `rowLink`), so the row is one big target for Edit, while the actions menu sits above it.
 *
 * Columns, from the left: title with holder / reference, category and files; status and visibility;
 * validity and dates; the menu. Below 900px the kit stacks a row into wrapping lines; between 900 and
 * 1240px the validity cell drops under the title so nothing is squeezed (see pages.module.css).
 */
export function DocumentsLedger({ rows }: DocumentsLedgerProps) {
  return (
    <ul className={ui.ledger} role="list" aria-label="Documents">
      {rows.map((row, index) => {
        const Icon = CATEGORY_ICONS[row.category];
        return (
          <li key={row.id} className={cx(ui.ledgerRow, s.docRow)} style={{ "--i": Math.min(index, 12) } as CSSProperties}>
            <div className={cx(ui.cell, ui.cellMain, s.cMain)}>
              <Link href={adminDocumentRoute(row.id)} prefetch={false} className={cx(ui.cellTitle, ui.rowLink)}>
                {row.title}
              </Link>
              <span className={ui.cellSub}>{row.subtitle}</span>
              <div className={s.tagLine}>
                <Badge tone="neutral" className={s.catBadge}>
                  <Icon width={13} height={13} />
                  {row.categoryLabel}
                </Badge>
                {row.files.map((file) => (
                  <span key={file} className={s.fileChip}>
                    {file}
                  </span>
                ))}
                {row.missing.map((gap) => (
                  <Badge key={gap} tone="warning" dot>
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>

            <div className={cx(ui.cell, s.cStatus)}>
              <div className={s.badgeStack}>
                <StatusBadge status={row.status} />
                <VisibilityBadge visibility={row.visibility} />
              </div>
            </div>

            <div className={cx(ui.cell, s.cMeta)}>
              <div className={s.validity}>
                <VerificationBadge state={row.validity} />
                <div>
                  <span className={s.metaLine}>Issued {row.issued}</span>
                  {row.expires ? (
                    <span className={cx(s.metaLine, row.expiry.tone === "soon" && s.metaSoon, row.expiry.tone === "expired" && s.metaExpired)}>
                      Expires {row.expires}
                      {row.expiry.relative ? ` (${row.expiry.relative})` : ""}
                    </span>
                  ) : null}
                  <span className={s.metaLine}>Updated {row.updated}</span>
                </div>
              </div>
            </div>

            <div className={cx(ui.cellEnd, s.cActions)}>
              <RowActions target={row.target} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
