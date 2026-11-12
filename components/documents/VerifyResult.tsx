import Link from "next/link";
import { CATEGORIES } from "@/lib/documents/categories";
import { normalizeVerificationCode } from "@/lib/documents/codes";
import type { PublicDocument } from "@/lib/documents/public";
import { ROUTES, verifyRoute } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import { HASH_HELP, VERDICTS, type VerifyKind } from "./content";
import CopyButton from "./CopyButton";
import {
  type FieldRow,
  fileHref,
  fileKindLabel,
  formatBytes,
  formatDate,
  formatUtcTimestamp,
  publicFieldRows,
  reportProblemHref,
} from "./format";
import { Fact, StateChip, TagList } from "./parts";
import Seal from "./Seal";
import type { VerifyOutcome } from "./verifyLookup";
import styles from "./verify.module.css";

function kindOf(outcome: VerifyOutcome): VerifyKind {
  return outcome.kind === "result" ? outcome.state : outcome.kind;
}

function FieldValue({ row }: { row: FieldRow }) {
  switch (row.kind) {
    case "tags":
      return <TagList tags={row.tags} label={row.label} />;
    case "link":
      return (
        <a className={styles.inlineLink} href={row.href} target="_blank" rel="noopener noreferrer nofollow">
          {row.text}
        </a>
      );
    case "multiline":
      return <span className={styles.multiline}>{row.text}</span>;
    default:
      return <>{row.text}</>;
  }
}

function FileBlock({ doc, code }: { doc: PublicDocument; code: string }) {
  if (!doc.file) return null;
  const { file } = doc;
  const detail = `${fileKindLabel(file.mimeType)}, ${formatBytes(file.sizeBytes)}`;
  return (
    <section className={styles.fileBlock} aria-labelledby="record-file-heading">
      <div className={styles.fileHead}>
        <div>
          <h3 id="record-file-heading">The document file</h3>
          <p className={styles.fileMeta}>
            {file.filename} · {detail}
          </p>
        </div>
        <div className={styles.fileActions}>
          <a
            className={`${styles.act} ${styles.actPrimary}`}
            href={fileHref(doc.id, "primary", { code })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${file.filename} (${detail}, opens in a new tab)`}
          >
            View
          </a>
          {doc.canDownload ? (
            <a className={`${styles.act} ${styles.actGhost}`} href={fileHref(doc.id, "primary", { code, download: true })} download aria-label={`Download ${file.filename} (${detail})`}>
              Download
            </a>
          ) : null}
        </div>
      </div>
      <div className={styles.hash}>
        <span className={styles.hashLabel}>SHA-256</span>
        <code className={styles.hashValue}>{file.sha256}</code>
        <CopyButton value={file.sha256} label="Copy" />
      </div>
      <details className={styles.explain}>
        <summary>{HASH_HELP.summary}</summary>
        <p>{HASH_HELP.intro}</p>
        <dl>
          <div>
            <dt>Windows (PowerShell)</dt>
            <dd>
              <code>{HASH_HELP.windows}</code>
            </dd>
          </div>
          <div>
            <dt>macOS or Linux</dt>
            <dd>
              <code>{HASH_HELP.unix}</code>
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

/** The certificate-like card: a paper surface on the ink page, as if a document were being inspected. */
function RecordCard({ doc, code }: { doc: PublicDocument; code: string }) {
  const spec = CATEGORIES[doc.category];
  const rows = publicFieldRows(doc);
  const until = formatDate(doc.expiresOn);

  return (
    <article className={`${ui.paper} ${styles.record}`} aria-labelledby="record-title" data-reveal="up">
      <header className={styles.recordHead}>
        <span className={styles.recordKind}>{spec.label}</span>
        <StateChip state={doc.state} />
      </header>
      <div className={styles.recordBody}>
        {doc.hasPhoto ? (
          <div className={styles.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element -- served by our own access-checked route */}
            <img src={fileHref(doc.id, "photo", { code })} width={144} height={180} alt={`Photo of ${doc.holderName}`} decoding="async" />
          </div>
        ) : null}
        <div className={styles.recordMain}>
          <h2 id="record-title" className={`ac-heading-sm ${styles.recordTitle}`}>
            {doc.title}
          </h2>
          {doc.summary ? <p className={styles.recordSummary}>{doc.summary}</p> : null}
          <dl className={styles.recordFacts}>
            <Fact label={spec.base.holderName.label}>{doc.holderName}</Fact>
            <Fact label={spec.base.referenceNo.label}>{doc.referenceNo}</Fact>
            <Fact label={spec.base.issuedOn.label}>{formatDate(doc.issuedOn)}</Fact>
            <Fact label={spec.base.expiresOn.label}>{until ? (doc.state === "expired" ? `${until} (expired)` : until) : ""}</Fact>
            {rows.map((row) => (
              <Fact key={row.key} label={row.label}>
                <FieldValue row={row} />
              </Fact>
            ))}
          </dl>
        </div>
      </div>
      <FileBlock doc={doc} code={code} />
    </article>
  );
}

/** A revoked record is deliberately bare: what it was and when it was withdrawn, nothing about the holder. */
function RevokedCard({ doc }: { doc: PublicDocument }) {
  const spec = CATEGORIES[doc.category];
  const revokedOn = formatDate(doc.revokedAt);
  return (
    <article className={`${ui.paper} ${styles.record} ${styles.recordRevoked}`} aria-labelledby="record-title" data-reveal="up">
      <header className={styles.recordHead}>
        <span className={styles.recordKind}>{spec.label}</span>
        <StateChip state="revoked" />
      </header>
      <div className={styles.recordMain}>
        <h2 id="record-title" className={`ac-heading-sm ${styles.recordTitle}`}>
          {doc.title}
        </h2>
        <dl className={styles.recordFacts}>
          <Fact label={spec.base.referenceNo.label}>{doc.referenceNo}</Fact>
          <Fact label="Revoked on">{revokedOn}</Fact>
        </dl>
        <p className={styles.recordSummary}>This record is no longer valid. We show nothing else about it.</p>
      </div>
    </article>
  );
}

interface VerifyResultProps {
  /** The `[code]` segment exactly as the URL carried it. */
  rawCode: string;
  outcome: VerifyOutcome;
}

/**
 * The /verify/<code> page body: a large verdict seal, then (for a record we can show) the record
 * itself on a paper card. Wording for not-found is identical for a typo, an unknown code and a record
 * that is not public, so the page never confirms that a code once existed.
 */
export default function VerifyResult({ rawCode, outcome }: VerifyResultProps) {
  const kind = kindOf(outcome);
  const verdict = VERDICTS[kind];
  const canonical = normalizeVerificationCode(rawCode);
  const doc = outcome.kind === "result" ? outcome.document : null;
  const checkedAt = outcome.kind === "result" ? outcome.checkedAt : null;
  const retryHref = canonical ? verifyRoute(canonical) : ROUTES.verify;
  const showRetry = outcome.kind !== "result";

  return (
    <div data-verify-root className={`${ui.root} ${styles.page}`}>
      <section className={`${ui.ink} ${styles.stage}`} aria-labelledby="verify-h1">
        <span className={styles.stageGlow} data-kind={kind} aria-hidden="true" />
        <div className={styles.wrap}>
          <div className={styles.verdict} data-kind={kind}>
            <div className={styles.sealBox}>
              <Seal kind={kind} size={176} />
            </div>
            <div className={styles.verdictCopy}>
              <p className={styles.eyebrow}>
                <i className={styles.slash} />
                <b>{verdict.badge}</b>
              </p>
              <h1 id="verify-h1" className={styles.verdictTitle}>
                {verdict.headline}
              </h1>
              <p className={styles.lede}>{verdict.body}</p>
              {checkedAt ? (
                <p className={styles.checked}>
                  Checked just now · <time dateTime={checkedAt}>{formatUtcTimestamp(checkedAt)}</time>
                </p>
              ) : null}
              <div className={styles.cta}>
                {showRetry ? (
                  // A plain anchor, not <Link>: the whole point is to ask the server again.
                  <a className={`${styles.btn} ${styles.btnPrimary}`} href={retryHref}>
                    Try again
                  </a>
                ) : null}
                <Link className={`${styles.btn} ${showRetry ? styles.btnGhost : styles.btnPrimary}`} href={ROUTES.verify}>
                  Verify another
                </Link>
                <a className={`${styles.btn} ${styles.btnGhost}`} href={reportProblemHref(canonical)}>
                  Report a problem
                </a>
              </div>
            </div>
          </div>

          {doc && doc.state === "revoked" ? <RevokedCard doc={doc} /> : null}
          {doc && doc.state !== "revoked" ? <RecordCard doc={doc} code={canonical ?? doc.verificationCode ?? ""} /> : null}
        </div>
      </section>
      <HomeMotion root="[data-verify-root]" />
    </div>
  );
}
