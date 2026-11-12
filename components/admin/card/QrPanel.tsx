import type { ReactNode } from "react";
import ui from "@/components/admin/admin.module.css";
import { CopyButton } from "@/components/admin/CopyButton";
import { DownloadIcon } from "@/components/admin/icons";
import { Panel } from "@/components/admin/Panel";
import { cx } from "@/components/admin/utils";
import s from "./card.module.css";
import type { CardData } from "./cardData";
import { adminQrUrl } from "./cardFormat";

/**
 * A plain anchor styled as a ghost pill. It is not ButtonLink on purpose: ButtonLink renders next/link, which
 * would prefetch the image endpoint, and the external variant opens a new tab, which a download does not need.
 */
function DownloadLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} download className={cx(ui.btn, ui.btnGhost, ui.btnSm, ui.btnShine)}>
      <span className={ui.btnIcon} aria-hidden="true">
        <DownloadIcon width={16} height={16} />
      </span>
      <span className={ui.btnLabel}>{children}</span>
    </a>
  );
}

/**
 * The QR on its own: a thumbnail, the short link as printed, copy, and SVG / PNG downloads from the admin
 * QR endpoint. The verify page itself is deliberately NOT linked: opening it counts as a scan in the
 * verification log, and an admin checking their own print should not inflate the numbers.
 */
export function QrPanel({ data }: { data: CardData }) {
  if (!data.qrSrc || !data.verifyUrl) {
    return (
      <Panel eyebrow="Verification" title="QR code">
        <p className={s.summary}>There is no QR yet. It appears here as soon as the record has a verification code.</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Verification" title="QR code">
      <div className={s.qrRow}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin API image behind the session cookie */}
        <img className={s.qrThumb} src={data.qrSrc} alt="QR code preview" width={112} height={112} />
        <div className={s.qrMeta}>
          <p className={s.urlText}>{data.verifyShort}</p>
          <div>
            <CopyButton value={data.verifyUrl} label="Copy link" />
          </div>
        </div>
      </div>
      <div className={s.qrActions}>
        <DownloadLink href={adminQrUrl(data.id, { format: "svg", download: true })}>Download SVG</DownloadLink>
        <DownloadLink href={adminQrUrl(data.id, { format: "png", size: 1024, download: true })}>Download PNG</DownloadLink>
      </div>
    </Panel>
  );
}
