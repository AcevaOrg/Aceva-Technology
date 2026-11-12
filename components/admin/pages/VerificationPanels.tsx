import Link from "next/link";
import type { CSSProperties } from "react";
import { adminStyles as ui, Badge, CopyButton, VerificationBadge } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import { CATEGORIES } from "@/lib/documents/categories";
import { verificationUrl } from "@/lib/documents/qr";
import type { VerificationEventRow } from "@/lib/documents/store";
import type { DocumentRecord } from "@/lib/documents/types";
import { adminDocumentRoute } from "@/lib/nav";
import { DownloadLink } from "./DownloadLink";
import { relativeFromIso } from "./format";
import { LocalTime } from "./LocalTime";
import s from "./pages.module.css";
import { qrDownloadHref } from "./actionRules";
import { asVerificationState, codeStatus } from "./verificationView";

const LOG_COLUMNS = "minmax(0, 1fr) 128px 190px";
const CODE_COLUMNS = "minmax(0, 1.5fr) 150px 150px auto";

/** The code's verify link, or null for a stored value that is not a valid code. */
function safeVerifyUrl(code: string): string | null {
  try {
    return verificationUrl(code);
  } catch {
    return null;
  }
}

/**
 * The lookup log: each time someone scanned a QR code or typed a code on /verify. A lookup that
 * resolved to a record links to it; one that did not shows only the last four characters of what was
 * tried, which is all the store keeps.
 */
export function LookupLog({ events, nowMs }: { events: readonly VerificationEventRow[]; nowMs: number }) {
  return (
    <div className={ui.ledger}>
      <div className={ui.ledgerHead} style={{ "--cols": LOG_COLUMNS } as CSSProperties} aria-hidden="true">
        <span>Record</span>
        <span>Result</span>
        <span>When</span>
      </div>
      <ul role="list" aria-label="Verification lookups">
        {events.map((event) => {
          const state = asVerificationState(event.result);
          const category = event.category ? CATEGORIES[event.category].label : null;
          return (
            <li key={event.id} className={ui.ledgerRow} style={{ "--cols": LOG_COLUMNS } as CSSProperties}>
              <div className={cx(ui.cell, ui.cellMain)}>
                {event.documentId && event.documentTitle ? (
                  <Link href={adminDocumentRoute(event.documentId)} prefetch={false} className={cx(ui.cellTitle, ui.rowLink)}>
                    {event.documentTitle}
                  </Link>
                ) : (
                  <span className={cx(ui.cellTitle, s.quiet)}>Unknown code</span>
                )}
                <span className={ui.cellSub}>
                  {category ? `${category} · ` : ""}
                  code ending <span className={s.suffix}>{event.codeSuffix || "unknown"}</span>
                </span>
              </div>
              <div className={ui.cell}>{state ? <VerificationBadge state={state} /> : <Badge tone="neutral">{event.result || "Unknown"}</Badge>}</div>
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

/**
 * Every record that has a verification code, with what a scan of it would say right now, how often it
 * has been scanned and when it last was. Copy-link and QR download sit on each row, because "get me
 * that code's QR" is the commonest reason to open this page.
 */
export function CodesTable({ records, now }: { records: readonly DocumentRecord[]; now: Date }) {
  return (
    <div className={ui.ledger}>
      <div className={ui.ledgerHead} style={{ "--cols": CODE_COLUMNS } as CSSProperties} aria-hidden="true">
        <span>Record</span>
        <span>Scans as</span>
        <span>Lookups</span>
        <span>Shortcuts</span>
      </div>
      <ul role="list" aria-label="Verification codes">
        {records.map((record) => {
          const status = codeStatus(record, now);
          const link = record.verificationCode ? safeVerifyUrl(record.verificationCode) : null;
          return (
            <li key={record.id} className={ui.ledgerRow} style={{ "--cols": CODE_COLUMNS } as CSSProperties}>
              <div className={cx(ui.cell, ui.cellMain)}>
                <Link href={adminDocumentRoute(record.id)} prefetch={false} className={cx(ui.cellTitle, ui.rowLink)}>
                  {record.title}
                </Link>
                <span className={ui.cellSub}>
                  {CATEGORIES[record.category].label}
                  {record.holderName ? ` · ${record.holderName}` : ""}
                </span>
                <span className={cx(s.codeText, s.noteLine)}>{record.verificationCode}</span>
              </div>
              <div className={ui.cell}>
                {status.live ? (
                  <VerificationBadge state={status.state} />
                ) : (
                  <span title={status.reason}>
                    <Badge tone="neutral">Not live</Badge>
                  </span>
                )}
                {!status.live ? <span className={s.noteLine}>{status.reason}</span> : null}
              </div>
              <div className={ui.cell} data-label="Lookups">
                <span className={s.timeStack}>
                  <span>{record.verifyCount.toLocaleString("en-US")}</span>
                  <span className={s.timeAbs}>{record.lastVerifiedAt ? `last ${relativeFromIso(record.lastVerifiedAt, now.getTime())}` : "never checked"}</span>
                </span>
              </div>
              <div className={cx(ui.cellEnd, s.shortcuts)}>
                {link ? (
                  <>
                    <CopyButton value={link} label="Copy link" />
                    <DownloadLink href={qrDownloadHref(record.id)} label={`Download QR code for ${record.title}`}>
                      QR
                    </DownloadLink>
                  </>
                ) : (
                  <span className={s.quiet}>No link</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
