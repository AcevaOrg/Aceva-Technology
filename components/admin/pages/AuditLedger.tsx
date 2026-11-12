import Link from "next/link";
import type { CSSProperties } from "react";
import { adminStyles as ui } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import type { AdminAuditEvent } from "@/lib/admin/audit";
import { describeAuditEvent } from "./auditSummary";
import { shortActor } from "./format";
import { LocalTime } from "./LocalTime";
import s from "./pages.module.css";

interface AuditLedgerProps {
  events: readonly AdminAuditEvent[];
  nowMs: number;
}

const COLUMNS = "minmax(0, 1fr) 96px 190px";

/**
 * The audit trail as sentences: Published "FY 2025-26 Statements", who (a short device handle,
 * never a name or address), and when (relative, with the exact time beneath). A record that still
 * exists links to its editor.
 */
export function AuditLedger({ events, nowMs }: AuditLedgerProps) {
  return (
    <div className={ui.ledger}>
      <div className={ui.ledgerHead} style={{ "--cols": COLUMNS } as CSSProperties} aria-hidden="true">
        <span>Event</span>
        <span>Device</span>
        <span>When</span>
      </div>
      <ul role="list" aria-label="Activity">
        {events.map((event) => {
          const summary = describeAuditEvent(event);
          const sentence = summary.subject ? `${summary.verb} “${summary.subject}”` : summary.verb;
          return (
            <li key={event.id} className={ui.ledgerRow} style={{ "--cols": COLUMNS } as CSSProperties}>
              <div className={cx(ui.cell, ui.cellMain)}>
                <div className={s.verbRow}>
                  <span className={s.verbDot} data-tone={summary.tone} aria-hidden="true" />
                  <div>
                    {summary.href ? (
                      <Link href={summary.href} prefetch={false} className={cx(ui.cellTitle, ui.rowLink)}>
                        {sentence}
                      </Link>
                    ) : (
                      <span className={ui.cellTitle}>{sentence}</span>
                    )}
                    {summary.notes.length > 0 ? <span className={s.noteLine}>{summary.notes.join(" · ")}</span> : null}
                  </div>
                </div>
              </div>
              <div className={ui.cell} data-label="Device">
                <span className={s.actorChip} title="A short code for the device that did this. The address itself is never stored.">
                  {shortActor(event.actor)}
                </span>
              </div>
              <div className={ui.cell}>
                <LocalTime iso={event.at} nowMs={nowMs} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
