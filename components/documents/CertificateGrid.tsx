import type { CSSProperties } from "react";
import Link from "next/link";
import type { PublicDocument } from "@/lib/documents/public";
import { CATEGORIES, optionLabel } from "@/lib/documents/categories";
import { verifyRoute } from "@/lib/nav";
import DocumentActions from "./DocumentActions";
import { fieldString, fieldTags, formatDate, safeHref } from "./format";
import { Fact, StateChip, TagList, stagger } from "./parts";
import QrImage from "./QrImage";
import Seal from "./Seal";
import { describeValidity, type Validity } from "./validity";
import styles from "./documents.module.css";

const BASE = CATEGORIES.certification.base;

function CredentialGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M6 3H3v10h10v-3M9 2.5h4.5V7M13.5 2.5L7.5 8.5" />
    </svg>
  );
}

/**
 * How much of the certificate's life has been used, as a hairline bar with a dot at "now". The words beside
 * it carry the meaning (the bar is decoration), so colour is never the only signal.
 */
function ValidityMeter({ validity, until }: { validity: Validity; until: string }) {
  const open = validity.phase === "open-ended";
  const ended = validity.phase === "ended";
  const label = open ? "No expiry" : ended ? `Expired ${until}` : `Valid until ${until}`;
  const remaining = open ? "" : ended ? `${validity.span} ago` : validity.span === "Today" ? "Last day" : `${validity.span} left`;
  return (
    <div className={styles.meter} data-phase={validity.phase}>
      {/* Two fixed lines on every pass, so a long date never wraps one pass and not another. */}
      <p className={styles.meterText}>
        <span>{label}</span>
        {remaining ? <strong>{remaining}</strong> : <span />}
      </p>
      <span className={styles.meterTrack} data-open={open ? "" : undefined} aria-hidden="true">
        {validity.used !== null ? <span className={styles.meterFill} style={{ "--w": validity.used } as CSSProperties} /> : null}
      </span>
    </div>
  );
}

/** Whether a pass has anything to open beneath the card. */
function hasDetails(doc: PublicDocument): boolean {
  const { fields } = doc;
  return Boolean(doc.summary || fieldString(fields, "level") || fieldString(fields, "standard_scope") || formatDate(doc.issuedOn) || fieldTags(fields, "skills").length > 0 || safeHref(fields.credential_url));
}

async function CredentialPass({ doc, index, now, reserveDetails }: { doc: PublicDocument; index: number; now: Date; reserveDetails: boolean }) {
  const { fields } = doc;
  const direction = optionLabel("certification", "direction", fields.direction);
  const issuer = fieldString(fields, "issuing_body");
  const credential = safeHref(fields.credential_url);
  const issued = formatDate(doc.issuedOn);
  const until = formatDate(doc.expiresOn);
  const level = fieldString(fields, "level");
  const scope = fieldString(fields, "standard_scope");
  const tags = fieldTags(fields, "skills");
  // Expired is a state worth saying out loud; a valid certificate simply carries the seal.
  const seal = doc.state === "expired" ? "expired" : "valid";
  const validity = describeValidity(doc.issuedOn, doc.expiresOn, now);
  const reference = doc.referenceNo ? `No. ${doc.referenceNo}` : "";
  const hasMore = hasDetails(doc);

  return (
    // data-direction lets the combined section's held/issued chips hide a pass with CSS alone.
    <li className={styles.pass} data-reveal="up" style={stagger(index)} data-direction={fieldString(fields, "direction") || undefined} data-phase={validity.phase}>
      <article aria-labelledby={`cert-${doc.id}`}>
        <div className={styles.passBody}>
          <div className={styles.passMain}>
            <p className={styles.passKind}>
              <Seal kind={seal} size={28} />
              {direction ? <span className={styles.kind}>{direction}</span> : null}
              <StateChip state={doc.state} />
            </p>
            <h3 id={`cert-${doc.id}`}>{doc.title}</h3>
            {/* Holder, issuer and reference each get their own one-line slot (ellipsised, full text in the tooltip). */}
            <p className={styles.passHolder} title={doc.holderName || undefined}>
              {doc.holderName ? <span className={styles.srOnly}>{BASE.holderName.label}: </span> : null}
              {doc.holderName}
            </p>
            <p className={styles.passMeta} title={issuer || undefined}>
              {issuer}
            </p>
            <p className={styles.passMeta} title={reference || undefined}>
              {reference}
            </p>
            <ValidityMeter validity={validity} until={until} />
          </div>

          <div className={styles.stub}>
            {doc.verificationCode ? (
              // The QR is itself the link: tapping it opens the same page a phone camera would.
              <Link
                className={styles.stubQr}
                href={verifyRoute(doc.verificationCode)}
                prefetch={false}
                aria-label={`Verify this certificate: ${doc.title}`}
              >
                <QrImage code={doc.verificationCode} size={76} alt={`QR code that opens the verification page for ${doc.title}`} />
              </Link>
            ) : (
              // Without a code the slot stays, empty, so the file buttons sit where they do on every other pass.
              <span className={styles.stubQrGap} aria-hidden="true" />
            )}
            <span className={styles.stubLabel} aria-hidden="true">
              {doc.verificationCode ? "Scan to verify" : ""}
            </span>
            <div className={styles.stubActions}>
              <DocumentActions doc={doc} compact stacked />
            </div>
          </div>
        </div>

        {!hasMore && reserveDetails ? <div className={styles.moreSpacer} aria-hidden="true" /> : null}
        {hasMore ? (
          <details className={styles.more}>
            <summary>Details</summary>
            <div className={styles.moreBody}>
              {doc.summary ? <p className={styles.summary}>{doc.summary}</p> : null}
              <dl className={styles.facts}>
                <Fact label="Level">{level}</Fact>
                <Fact label="Scope">{scope}</Fact>
                <Fact label={BASE.issuedOn.label}>{issued}</Fact>
              </dl>
              <TagList tags={tags} label="Skills covered" />
              {credential ? (
                <a className={styles.textLink} href={credential} target="_blank" rel="noopener noreferrer nofollow">
                  External credential <CredentialGlyph />
                </a>
              ) : null}
            </div>
          </details>
        ) : null}
      </article>
    </li>
  );
}

/**
 * Certifications as compact credential passes: seal, issuer, a validity bar, and a scannable QR on a tear-off stub.
 *
 * Every pass is built from the same fixed slots (type line, title, holder, issuer, reference, validity text and
 * bar, QR, label, file buttons, details bar), filled or empty, so a row of passes lines up exactly instead of each
 * one sizing to its own text.
 */
export default function CertificateGrid({ docs }: { docs: PublicDocument[] }) {
  // One clock for the whole list, so every bar on the page agrees about "now".
  const now = new Date();
  // The details bar is only worth a slot when at least one pass has something to open.
  const reserveDetails = docs.some((doc) => hasDetails(doc));
  return (
    <ul className={styles.passGrid}>
      {docs.map((doc, i) => (
        <CredentialPass key={doc.id} doc={doc} index={i} now={now} reserveDetails={reserveDetails} />
      ))}
    </ul>
  );
}
