"use client";

import { memo, useMemo } from "react";
import type { PublicDocument } from "@/lib/documents/public";
import { CATEGORIES } from "@/lib/documents/categories";
import { VERIFICATION_LABELS, type DocumentCategory, type DocumentRecord } from "@/lib/documents/types";
import { Badge, type BadgeTone } from "../Badge";
import { DownloadIcon, ImageIcon, LockIcon, QrIcon } from "../icons";
import { Panel } from "../Panel";
import { formatBytes, mimeLabel } from "../utils";
import ed from "./editor.module.css";
import type { EditorValues } from "./editorModel";
import {
  cardChips,
  formatDateOnly,
  formatDateTimeUtc,
  previewRecord,
  projectPreview,
  publicRows,
  type PreviewFile,
  type PreviewProjection,
} from "./editorPreview";

const STATE_TONE: Record<PublicDocument["state"], BadgeTone> = { valid: "success", expired: "warning", revoked: "danger" };

function StateBadge({ state }: { state: PublicDocument["state"] }) {
  return (
    <Badge tone={STATE_TONE[state]} dot>
      {VERIFICATION_LABELS[state]}
    </Badge>
  );
}

function Facts({ doc }: { doc: PublicDocument }) {
  const spec = CATEGORIES[doc.category];
  const facts: Array<[string, string]> = [];
  if (doc.referenceNo) facts.push([spec.base.referenceNo.label, doc.referenceNo]);
  if (doc.issuedOn) facts.push([spec.base.issuedOn.label, formatDateOnly(doc.issuedOn)]);
  if (doc.expiresOn) facts.push([spec.base.expiresOn.label, formatDateOnly(doc.expiresOn)]);
  if (facts.length === 0) return null;
  return (
    <dl className={ed.pvFacts}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListingCard({ doc }: { doc: PublicDocument }) {
  const spec = CATEGORIES[doc.category];
  const chips = cardChips(doc);
  return (
    <article className={ed.pvCard}>
      <header className={ed.pvHead}>
        <span className={ed.pvEyebrow}>
          <i className={ed.pvSlash} aria-hidden="true" />
          {spec.eyebrow}
        </span>
        <StateBadge state={doc.state} />
      </header>
      <h3 className={ed.pvTitle}>{doc.title}</h3>
      {doc.holderName ? <p className={ed.pvHolder}>{doc.holderName}</p> : null}
      {doc.summary ? <p className={ed.pvSummary}>{doc.summary}</p> : null}
      {chips.length > 0 ? (
        <ul className={ed.pvChips}>
          {chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
      ) : null}
      <Facts doc={doc} />
      <footer className={ed.pvFoot}>
        {doc.file ? (
          <span>
            <DownloadIcon width={14} height={14} />
            {mimeLabel(doc.file.mimeType)} · {formatBytes(doc.file.sizeBytes)}
          </span>
        ) : null}
        {doc.verificationCode ? (
          <span>
            <QrIcon width={14} height={14} />
            Verifiable by QR
          </span>
        ) : null}
        {doc.featured ? <span>Featured</span> : null}
      </footer>
    </article>
  );
}

function VerifyView({ doc, photoUrl }: { doc: PublicDocument; photoUrl: string | null }) {
  const rows = publicRows(doc);
  const revoked = doc.state === "revoked";
  const verdict =
    doc.state === "valid"
      ? "This document is valid."
      : doc.state === "expired"
        ? `This document expired on ${formatDateOnly(doc.expiresOn)}.`
        : `This document was revoked${doc.revokedAt ? ` on ${formatDateTimeUtc(doc.revokedAt) || "an earlier date"}` : ""}.`;

  return (
    <article className={ed.pvCard} data-state={doc.state}>
      <header className={ed.pvHead}>
        <StateBadge state={doc.state} />
        <span className={ed.pvVerdict}>{verdict}</span>
      </header>
      {doc.hasPhoto && photoUrl ? (
        <div className={ed.pvPhoto}>
          {/* A blob: or admin-route preview cannot go through next/image's optimiser. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="Photo preview" />
        </div>
      ) : doc.hasPhoto ? (
        <div className={ed.pvPhoto} aria-hidden="true">
          <ImageIcon width={28} height={28} />
        </div>
      ) : null}
      <h3 className={ed.pvTitle}>{doc.title}</h3>
      {doc.holderName ? <p className={ed.pvHolder}>{doc.holderName}</p> : null}
      {doc.summary ? <p className={ed.pvSummary}>{doc.summary}</p> : null}
      <Facts doc={doc} />
      {rows.length > 0 ? (
        <dl className={ed.pvFacts}>
          {rows.map((row) => (
            <div key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!revoked && doc.file ? (
        <p className={ed.pvFile}>
          <DownloadIcon width={14} height={14} />
          {doc.file.filename} · {formatBytes(doc.file.sizeBytes)}
        </p>
      ) : null}
      {doc.verificationCode ? (
        <p className={ed.pvCode}>
          <QrIcon width={14} height={14} />
          {doc.verificationCode}
        </p>
      ) : null}
    </article>
  );
}

interface LivePreviewProps {
  category: DocumentCategory;
  values: EditorValues;
  stored: DocumentRecord | null;
  primary: PreviewFile | null;
  photo: PreviewFile | null;
  /** Where the photo can be shown from: a blob URL for a new file, or the admin file route for a stored one. */
  photoUrl: string | null;
  /** A code will exist once saved. */
  willHaveCode: boolean;
}

function captionFor(projection: PreviewProjection): { title: string; path: string } {
  switch (projection.kind) {
    case "listing":
      return { title: "Documents page card", path: `/documents#${CATEGORIES[projection.doc.category].slug}` };
    case "verify":
      return { title: "Verify page", path: "/verify/…" };
    case "private":
      return { title: "Not visible", path: "admin only" };
    case "hidden":
      return { title: "Not visible", path: "hidden" };
  }
}

/**
 * What a visitor would see, redrawn as the form changes. The record is run through the real
 * privacy boundary, so a field marked "Admin only" cannot leak into this panel any more than it
 * can into the public pages.
 */
function LivePreviewImpl({ category, values, stored, primary, photo, photoUrl, willHaveCode }: LivePreviewProps) {
  const projection = useMemo(
    () => projectPreview(previewRecord(category, values, { stored, primary, photo, willHaveCode })),
    [category, values, stored, primary, photo, willHaveCode],
  );
  const caption = captionFor(projection);

  return (
    <Panel eyebrow="Live preview" title="As visitors see it">
      <div className={ed.pvFrame}>
        <div className={ed.pvBar} aria-hidden="true">
          <span className={ed.pvDots} />
          <span className={ed.pvPath}>{caption.path}</span>
        </div>
        <div className={ed.pvBody}>
          <p className={ed.pvCaption}>{caption.title}</p>
          {projection.kind === "listing" ? <ListingCard doc={projection.doc} /> : null}
          {projection.kind === "verify" ? (
            <>
              <VerifyView doc={projection.doc} photoUrl={photoUrl} />
              {projection.note ? <p className={ed.note}>{projection.note}</p> : null}
            </>
          ) : null}
          {projection.kind === "private" ? (
            <p className={ed.pvNone}>
              <LockIcon width={18} height={18} />
              Private. Visitors cannot see this, and its verification code reports &ldquo;not found&rdquo;.
            </p>
          ) : null}
          {projection.kind === "hidden" ? (
            <p className={ed.pvNone}>
              <LockIcon width={18} height={18} />
              {projection.reason}
            </p>
          ) : null}
          {projection.kind !== "private" && projection.kind !== "hidden" ? (
            <p className={ed.note}>Shown as it will look once published.</p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

export const LivePreview = memo(LivePreviewImpl);
