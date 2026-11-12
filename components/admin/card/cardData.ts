import { CATEGORIES } from "@/lib/documents/categories";
import { computeVerificationState } from "@/lib/documents/public";
import type { DocumentCategory, DocumentRecord } from "@/lib/documents/types";
import { adminQrUrl, formatCardDate, shortUrl } from "./cardFormat";

/**
 * What a QR label shows, and whether it is fit to print. The server page builds both from the stored
 * record and hands the plain results to the client components, so none of this code (or the database
 * module behind the record) ships to the browser.
 *
 * Labels carry only the title, the reference number and the verification link. Nothing personal is
 * copied across: the person who scans a label sees what the public verify page shows, no more.
 */

/* ------------------------------------------------------------------ *
 * Label data                                                           *
 * ------------------------------------------------------------------ */

export interface CardData {
  id: string;
  category: DocumentCategory;
  categoryLabel: string;
  title: string;
  holderName: string;
  /** Certificate or letter number, printed on the larger labels. */
  referenceNo: string;
  /** Null while the record has no usable verification code: the label shows a placeholder, not a broken image. */
  qrSrc: string | null;
  verifyUrl: string | null;
  /** The link without scheme, as printed. "" without a code. */
  verifyShort: string;
  code: string | null;
}

/**
 * @param verifyUrl the record's full verification URL, or null when it has no usable code. The caller
 * derives it from `verificationUrl()` (server-only), which is why it arrives as a plain string here.
 */
export function buildCardData(record: DocumentRecord, verifyUrl: string | null): CardData {
  const usable = verifyUrl !== null && record.verificationCode !== null;

  return {
    id: record.id,
    category: record.category,
    categoryLabel: CATEGORIES[record.category].label,
    title: record.title.trim(),
    holderName: record.holderName.trim(),
    referenceNo: record.referenceNo.trim(),
    qrSrc: usable ? adminQrUrl(record.id) : null,
    verifyUrl: usable ? verifyUrl : null,
    verifyShort: usable ? shortUrl(verifyUrl) : "",
    code: usable ? record.verificationCode : null,
  };
}

/* ------------------------------------------------------------------ *
 * Readiness checklist                                                  *
 * ------------------------------------------------------------------ */

/**
 * blocker: printing now would produce a label that is wrong or unscannable, so Print is disabled.
 * warning: it prints fine, but the QR will not behave as expected until it is fixed.
 * info:    optional, shown so nothing on the label is a surprise.
 */
export type ReadinessSeverity = "blocker" | "warning" | "info";

export interface ReadinessItem {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
  severity: ReadinessSeverity;
}

export interface Readiness {
  items: ReadinessItem[];
  /** Unmet blockers. Print is disabled while this is not empty. */
  blockers: ReadinessItem[];
  /** Unmet warnings. */
  warnings: ReadinessItem[];
  ready: boolean;
  /** Every blocker and warning is met. */
  complete: boolean;
}

export type ReadinessSource = Pick<
  DocumentRecord,
  "category" | "title" | "referenceNo" | "expiresOn" | "status" | "visibility" | "revokedAt"
>;

function item(id: string, label: string, ok: boolean, severity: ReadinessSeverity, done: string, missing: string): ReadinessItem {
  return { id, label, ok, severity, detail: ok ? done : missing };
}

/**
 * Judges a record for printing. `hasUsableCode` is passed in (rather than read from the record) because
 * deciding whether a stored string is a real verification code needs the server-only code module.
 */
export function assessReadiness(record: ReadinessSource, options: { hasUsableCode: boolean; now?: Date }): Readiness {
  const now = options.now ?? new Date();

  const items: ReadinessItem[] = [
    item(
      "code",
      "Verification code",
      options.hasUsableCode,
      "blocker",
      "Issued. The QR on the printout opens the verify page.",
      "There is no verification code, so there is no QR to print. Turn on QR verification in the editor, then come back.",
    ),
    item("title", "Title", record.title.trim() !== "", "blocker", "Printed on the larger labels.", "There is no title to print. Add one in the editor."),
    item(
      "reference",
      "Reference number",
      record.referenceNo.trim() !== "",
      CATEGORIES[record.category].base.referenceNo.required ? "warning" : "info",
      "Printed on the 50 mm label and the strip.",
      "No reference number. The larger labels print without one.",
    ),
  ];

  const published = record.status === "published";
  items.push(
    item(
      "published",
      "Published",
      published,
      "warning",
      "Live: scanning the QR resolves.",
      record.status === "archived"
        ? 'Archived. Scanning the QR reports "not found" until you restore and publish it.'
        : 'Still a draft. Scanning the QR reports "not found" until you publish it.',
    ),
    item(
      "scannable",
      "Reachable by QR",
      record.visibility !== "private",
      "warning",
      record.visibility === "public" ? "Public: listed and reachable by QR." : "Unlisted: reachable only by QR.",
      'Private records report "not found" when scanned. Set the visibility to Unlisted for the QR to work.',
    ),
  );

  const state = computeVerificationState(record, now);
  items.push(
    item(
      "valid",
      "Currently valid",
      state === "valid",
      "warning",
      "Scanning shows a valid record.",
      state === "revoked"
        ? "This record is revoked. Scanning shows a revoked notice."
        : `Expired${record.expiresOn ? ` on ${formatCardDate(record.expiresOn)}` : ""}. Scanning shows an expired notice.`,
    ),
  );

  const blockers = items.filter((entry) => !entry.ok && entry.severity === "blocker");
  const warnings = items.filter((entry) => !entry.ok && entry.severity === "warning");
  return { items, blockers, warnings, ready: blockers.length === 0, complete: blockers.length === 0 && warnings.length === 0 };
}
