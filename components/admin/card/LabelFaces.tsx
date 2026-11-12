import type { CSSProperties } from "react";
import { LogoMark } from "@/components/ui/icons";
import { cx } from "@/components/admin/utils";
import type { CardData } from "./cardData";
import { LABELS, type LabelKind } from "./cardLayout";
import s from "./card.module.css";

/**
 * The four QR label designs: three squares and the 90 x 40 mm "verified by ACEVA" strip. They are plain markup
 * (no hooks, no handlers) measured in millimetres, so one component serves the preview and the print sheet.
 *
 * `idPrefix` makes the logo's gradient id unique per copy: duplicate ids would resolve to the first gradient
 * in the document, and while printing that one may sit inside the hidden admin shell and not render.
 *
 * Images are plain <img>, not next/image: they come from the admin API behind the session cookie, which the
 * image optimizer's server-side fetch would not carry.
 *
 * Labels are white with ink text because they are stuck on paper and certificates. The QR keeps its own
 * quiet zone and is never padded into the label's edge.
 */

interface LabelProps {
  data: CardData;
  kind: LabelKind;
  idPrefix: string;
}

function Qr({ data }: { data: CardData }) {
  return (
    <div className={s.labelQr}>
      {data.qrSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin API image behind the session cookie
        <img src={data.qrSrc} alt="QR code that opens the verification page" draggable={false} />
      ) : (
        <span className={s.labelQrMissing}>QR appears once verification is on</span>
      )}
    </div>
  );
}

export function QrLabel({ data, kind, idPrefix }: LabelProps) {
  const spec = LABELS[kind];
  const sizing = { "--w": spec.widthMm, "--h": spec.heightMm } as CSSProperties;

  return (
    <div className={s.art} style={sizing} data-label={kind}>
      <div className={cx(s.face, s.labelFace, s[kind])}>
        {kind === "square25" ? <Qr data={data} /> : null}

        {kind === "square35" ? (
          <>
            <Qr data={data} />
            <div className={s.labelFoot}>
              <p className={s.labelAccent}>Scan to verify</p>
            </div>
          </>
        ) : null}

        {kind === "square50" ? (
          <>
            <Qr data={data} />
            <div className={s.labelFoot}>
              <p className={s.labelAccent}>Verified by ACEVA</p>
              {data.referenceNo ? <p className={cx(s.labelRef, s.clamp1)}>{data.referenceNo}</p> : null}
            </div>
          </>
        ) : null}

        {kind === "strip" ? (
          <>
            <span className={s.watermark} aria-hidden="true" />
            <Qr data={data} />
            <div className={s.stripText}>
              <p className={cx(s.stripHead, s.labelAccent)}>
                <LogoMark className={s.stripLogo} id={`${idPrefix}-mark`} />
                Verified by ACEVA
              </p>
              <p className={cx(s.stripTitle, s.clamp2)}>{data.title || "Untitled record"}</p>
              <div className={s.stripMeta}>
                {data.referenceNo ? <p className={cx(s.stripRef, s.clamp1)}>{data.referenceNo}</p> : null}
                {data.verifyShort ? <p className={s.stripUrl}>{data.verifyShort}</p> : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
