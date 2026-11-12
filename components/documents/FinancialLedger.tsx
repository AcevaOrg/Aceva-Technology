import type { PublicDocument } from "@/lib/documents/public";
import { optionLabel } from "@/lib/documents/categories";
import DocumentActions from "./DocumentActions";
import { fieldString, fileKindLabel, formatBytes, formatDate, periodLabel } from "./format";
import { StateChip, stagger } from "./parts";
import styles from "./documents.module.css";

function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 8.5L6.5 12 13 4.5" />
    </svg>
  );
}

/** The headline: the fiscal year as written, else the year it was published, else nothing. */
function headlineYear(doc: PublicDocument): string {
  const fiscal = fieldString(doc.fields, "fiscal_year");
  if (fiscal) return fiscal;
  return doc.issuedOn?.slice(0, 4) ?? "";
}

/** Whether a sheet has anything to open beneath the file bar. */
function hasMore(doc: PublicDocument): boolean {
  return Boolean(fieldString(doc.fields, "highlights") || doc.summary || formatDate(doc.issuedOn) || doc.referenceNo || fieldString(doc.fields, "prepared_by"));
}

/**
 * Financial reports as statement sheets: a small paper tile per report with a folded corner, the fiscal
 * year as its headline, and a dashed tear line above the file actions. Compared with a full-width row
 * per report, four sheets sit side by side. Everything the row used to carry is still here.
 *
 * Every sheet is built from the same fixed slots (type, year, title, period, status, file bar, details
 * bar), whether or not a given report has something to put in one. That is what keeps the tear lines,
 * the file buttons and the details bars level across a row, instead of each sheet sizing to its own text.
 */
export default function FinancialLedger({ docs }: { docs: PublicDocument[] }) {
  // The details bar is only worth a slot when at least one sheet has something to open.
  const anyMore = docs.some((doc) => hasMore(doc));
  return (
    <ul className={styles.shelf}>
      {docs.map((doc, i) => {
        const { fields } = doc;
        const type = optionLabel("financial_report", "report_type", fields.report_type);
        const currency = fieldString(fields, "currency");
        const highlights = fieldString(fields, "highlights");
        const auditor = fieldString(fields, "auditor");
        const preparedBy = fieldString(fields, "prepared_by");
        const published = formatDate(doc.issuedOn);
        const year = headlineYear(doc);
        const meta = [periodLabel(doc), currency].filter(Boolean).join(" · ");
        const detail = [published ? `Published ${published}` : "", doc.referenceNo, preparedBy ? `Prepared by ${preparedBy}` : ""].filter(Boolean).join(" · ");
        const assuranceText = auditor ? `Audited by ${auditor}` : "Audited";

        return (
          <li key={doc.id} className={styles.sheet} data-reveal="up" style={stagger(i)}>
            <article aria-labelledby={`report-${doc.id}`}>
              <div className={styles.sheetBody}>
                {/* One line each, ellipsised: the full text stays in the page and in the tooltip. */}
                <p className={`${styles.kind} ${styles.sheetKind}`} title={type || undefined}>
                  {type}
                </p>
                <p className={styles.sheetYear}>
                  {year ? <span className={styles.srOnly}>Fiscal year </span> : null}
                  {year}
                </p>
                <h3 id={`report-${doc.id}`}>{doc.title}</h3>
                <p className={styles.sheetMeta}>{meta}</p>
                <div className={styles.sheetStatus}>
                  {fields.audited === true ? (
                    <p className={styles.assure} data-tone="good" title={assuranceText}>
                      <CheckGlyph />
                      <span>{assuranceText}</span>
                    </p>
                  ) : fields.audited === false ? (
                    <p className={styles.assure}>Unaudited</p>
                  ) : (
                    <span />
                  )}
                  {doc.state !== "valid" ? <StateChip state={doc.state} /> : null}
                </div>
              </div>
              <div className={styles.sheetFoot}>
                {doc.hasFile && doc.file ? (
                  <span className={styles.fileInfo}>
                    {fileKindLabel(doc.file.mimeType)} · {formatBytes(doc.file.sizeBytes)}
                  </span>
                ) : null}
                <DocumentActions doc={doc} compact />
              </div>
              {!hasMore(doc) && anyMore ? <div className={styles.moreSpacer} aria-hidden="true" /> : null}
              {hasMore(doc) ? (
                <details className={styles.more}>
                  <summary>{highlights ? "Highlights" : "Details"}</summary>
                  <div className={styles.moreBody}>
                    {detail ? <p className={styles.sheetMeta}>{detail}</p> : null}
                    {doc.summary ? <p className={styles.summary}>{doc.summary}</p> : null}
                    {highlights ? <p>{highlights}</p> : null}
                  </div>
                </details>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
