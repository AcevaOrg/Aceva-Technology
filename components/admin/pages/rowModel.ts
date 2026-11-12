import { formatBytes, mimeLabel } from "@/components/admin/utils";
import { CATEGORIES } from "@/lib/documents/categories";
import { computeVerificationState } from "@/lib/documents/public";
import { verificationUrl } from "@/lib/documents/qr";
import type { DocumentCategory, DocumentRecord, DocumentStatus, DocumentVisibility, VerificationState } from "@/lib/documents/types";
import { missingRequiredFiles } from "./attention";
import { describeExpiry, formatDate, relativeFromIso, type ExpiryDescription } from "./format";
import { publicPagePath, type RowActionsTarget } from "./actionRules";

/**
 * Everything one row of the documents ledger shows, worked out once on the server so the markup is
 * dumb. Only plain data leaves here, which is what lets `target` cross into the client menu.
 */

export interface LedgerRowModel {
  id: string;
  title: string;
  /** "Holder · reference", or a fallback line. */
  subtitle: string;
  category: DocumentCategory;
  categoryLabel: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  /** What a scan would say, or "off" when the record has no QR code. */
  validity: VerificationState | "off";
  issued: string;
  /** Formatted expiry date, or null when the record does not expire. */
  expires: string | null;
  expiry: ExpiryDescription;
  updated: string;
  /** Attached files, as short labels. */
  files: string[];
  /** Required uploads still missing: "No file", "No photo". */
  missing: string[];
  target: RowActionsTarget;
}

function verifyUrlFor(code: string | null): string | null {
  if (!code) return null;
  try {
    return verificationUrl(code);
  } catch {
    // A stored value that is not a code cannot be linked; the row simply offers no QR shortcuts.
    return null;
  }
}

export function buildLedgerRow(record: DocumentRecord, now: Date, soonDays: number): LedgerRowModel {
  const spec = CATEGORIES[record.category];
  const state = computeVerificationState(record, now);

  const primary = record.files.find((file) => file.role === "primary");
  const photo = record.files.find((file) => file.role === "photo");
  const files: string[] = [];
  if (primary) files.push(`${mimeLabel(primary.mimeType)} · ${formatBytes(primary.sizeBytes)}`);
  if (photo) files.push("Photo");

  const missing = missingRequiredFiles(record).map((part) => (part === "file" ? "No file" : "No photo"));
  const subtitle = [record.holderName, record.referenceNo].filter(Boolean).join(" · ") || record.summary || "No holder or reference yet";

  return {
    id: record.id,
    title: record.title,
    subtitle,
    category: record.category,
    categoryLabel: spec.label,
    status: record.status,
    visibility: record.visibility,
    validity: state === "valid" && !record.verificationCode ? "off" : state,
    issued: formatDate(record.issuedOn),
    expires: record.expiresOn ? formatDate(record.expiresOn) : null,
    expiry: describeExpiry(record.expiresOn, now, soonDays),
    updated: relativeFromIso(record.updatedAt, now.getTime()),
    files,
    missing,
    target: {
      id: record.id,
      title: record.title,
      category: record.category,
      status: record.status,
      visibility: record.visibility,
      revoked: record.revokedAt !== null,
      verifyUrl: verifyUrlFor(record.verificationCode),
      publicPath: publicPagePath(record),
    },
  };
}
