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
   * Icon-only round buttons, for the compact credential passes and statement sheets. The accessible
   * names are identical to the full-size buttons, so nothing is lost to a screen reader or a test.
   */
  compact?: boolean;
}

/**
 * View and Download for a listed document, only when the public may have the file. Otherwise an
 * honest "on request" line: the record is real, the paper is just not self-serve.
 */
export default function DocumentActions({ doc, compact = false }: DocumentActionsProps) {
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
    return (
      <div className={styles.actionIcons}>
        <a className={styles.actIcon} href={fileHref(doc.id, "primary")} target="_blank" rel="noopener noreferrer" aria-label={viewLabel} title="View">
          <ExternalGlyph size={16} />
        </a>
        <a className={styles.actIcon} href={fileHref(doc.id, "primary", { download: true })} download aria-label={downloadLabel} title={`Download (${detail})`}>
          <DownloadGlyph size={16} />
        </a>
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <a className={`${styles.act} ${styles.actPrimary}`} href={fileHref(doc.id, "primary")} target="_blank" rel="noopener noreferrer" aria-label={viewLabel}>
        View <ExternalGlyph />
      </a>
      <a className={`${styles.act} ${styles.actGhost}`} href={fileHref(doc.id, "primary", { download: true })} download aria-label={downloadLabel}>
        Download <DownloadGlyph />
      </a>
    </div>
  );
}
