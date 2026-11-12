import Link from "next/link";
import type { PublicDocument } from "@/lib/documents/public";
import { ROUTES } from "@/lib/nav";
import { fileHref, fileKindLabel, formatBytes } from "./format";
import styles from "./documents.module.css";

function ExternalGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 3H3v10h10v-3M9 2.5h4.5V7M13.5 2.5L7.5 8.5" />
    </svg>
  );
}

function EyeGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function DownloadGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 2v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />
    </svg>
  );
}

interface DocumentActionsProps {
  doc: PublicDocument;
  /**
   * The small buttons for the credential passes and statement sheets: a labelled View button, and Download beside
   * it as a round icon. The accessible names are identical to the full-size buttons, so nothing is lost to a
   * screen reader or a test.
   */
  compact?: boolean;
  /** With `compact`: stack both buttons, each with its label, for a narrow column (the pass's tear-off stub). */
  stacked?: boolean;
}

/**
 * View (and Download, when the admin allows it) for a listed document, only when the public may open the file.
 * Otherwise an honest "on request" line: the record is real, the paper is just not self-serve. A view-only file shows
 * the View button alone.
 */
export default function DocumentActions({ doc, compact = false, stacked = false }: DocumentActionsProps) {
  if (!doc.hasFile || !doc.file) {
    return (
      <p className={styles.noFile} data-compact={compact ? "" : undefined}>
        On request. <Link href={ROUTES.contact}>Ask us for a copy</Link>
      </p>
    );
  }
  const detail = `${fileKindLabel(doc.file.mimeType)}, ${formatBytes(doc.file.sizeBytes)}`;
  const viewLabel = `View ${doc.title} (${detail}, opens in a new tab)`;
  const downloadLabel = `Download ${doc.title} (${detail})`;

  if (compact) {
    // View is its own labelled button, never an icon you have to guess at; Download sits beside it (or under it).
    return (
      <div className={styles.actionRow} data-stack={stacked ? "" : undefined}>
        <a
          className={`${styles.actPill} ${styles.actPillPrimary}`}
          href={fileHref(doc.id, "primary")}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={viewLabel}
          title="View"
        >
          <EyeGlyph />
          <span>View</span>
        </a>
        {!doc.canDownload ? null : stacked ? (
          <a
            className={`${styles.actPill} ${styles.actPillGhost}`}
            href={fileHref(doc.id, "primary", { download: true })}
            download
            aria-label={downloadLabel}
            title={`Download (${detail})`}
          >
            <DownloadGlyph size={16} />
            <span>Download</span>
          </a>
        ) : (
          <a className={styles.actIcon} href={fileHref(doc.id, "primary", { download: true })} download aria-label={downloadLabel} title={`Download (${detail})`}>
            <DownloadGlyph size={16} />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <a className={`${styles.act} ${styles.actPrimary}`} href={fileHref(doc.id, "primary")} target="_blank" rel="noopener noreferrer" aria-label={viewLabel}>
        View <ExternalGlyph />
      </a>
      {doc.canDownload ? (
        <a className={`${styles.act} ${styles.actGhost}`} href={fileHref(doc.id, "primary", { download: true })} download aria-label={downloadLabel}>
          Download <DownloadGlyph />
        </a>
      ) : null}
    </div>
  );
}
