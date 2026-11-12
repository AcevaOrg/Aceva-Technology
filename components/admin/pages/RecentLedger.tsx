import Link from "next/link";
import type { CSSProperties } from "react";
import { adminStyles as ui, StatusBadge } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentRecord } from "@/lib/documents/types";
import { adminDocumentRoute } from "@/lib/nav";
import { relativeFromIso } from "./format";

interface RecentLedgerProps {
  records: readonly DocumentRecord[];
  nowMs: number;
}

// Three columns, not four: this card is only half the page wide, and a fixed-width "Section" column left the
// title about 80px, which broke words mid-syllable. The section now rides on the subtitle line instead.
const COLUMNS = "minmax(0, 1fr) 112px 104px";

/** "Recently updated": the last few records anyone touched, newest first, each a link to its editor. */
export function RecentLedger({ records, nowMs }: RecentLedgerProps) {
  return (
    <div className={ui.ledger}>
      <div className={ui.ledgerHead} style={{ "--cols": COLUMNS } as CSSProperties} aria-hidden="true">
        <span>Document</span>
        <span>Status</span>
        <span>Updated</span>
      </div>
      <ul role="list" aria-label="Recently updated documents">
        {records.map((record) => {
          const spec = CATEGORIES[record.category];
          const subtitle = record.holderName ? `${record.holderName} · ${spec.plural}` : spec.plural;
          return (
            <li key={record.id} className={ui.ledgerRow} style={{ "--cols": COLUMNS } as CSSProperties}>
              <div className={cx(ui.cell, ui.cellMain)}>
                <Link href={adminDocumentRoute(record.id)} prefetch={false} className={cx(ui.cellTitle, ui.rowLink)}>
                  {record.title}
                </Link>
                <span className={ui.cellSub}>{subtitle}</span>
              </div>
              <div className={ui.cell}>
                <StatusBadge status={record.status} />
              </div>
              <div className={cx(ui.cell, ui.muted)} data-label="Updated">
                {relativeFromIso(record.updatedAt, nowMs)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
