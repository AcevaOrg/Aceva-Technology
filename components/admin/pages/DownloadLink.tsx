import type { ReactNode } from "react";
import { adminStyles as ui, DownloadIcon } from "@/components/admin";
import { cx } from "@/components/admin/utils";

interface DownloadLinkProps {
  href: string;
  children: ReactNode;
  /** Accessible name when the visible text is short ("QR" needs "Download QR code for ..."). */
  label?: string;
}

/**
 * A ghost-pill that downloads a file. It is a plain anchor with the kit's button classes rather than
 * ButtonLink, because ButtonLink renders next/link and a download must never be intercepted by the
 * client router (the QR route answers with image bytes, not a page).
 */
export function DownloadLink({ href, children, label }: DownloadLinkProps) {
  return (
    <a className={cx(ui.btn, ui.btnGhost, ui.btnSm)} href={href} download aria-label={label}>
      <span className={ui.btnIcon} aria-hidden="true">
        <DownloadIcon width={16} height={16} />
      </span>
      <span className={ui.btnLabel}>{children}</span>
    </a>
  );
}
