import { CATEGORIES, optionLabel } from "@/lib/documents/categories";
import { toPublicDocument, type PublicDocument } from "@/lib/documents/public";
import { teamLevel } from "@/lib/documents/team";
import type { DocumentCategory, DocumentFileMeta, DocumentRecord, FieldSpec, FieldValue } from "@/lib/documents/types";
import { CONSENT_FIELD_KEY, buildDataPayload, requiresConsent, type EditorValues } from "./editorModel";

/**
 * The "as visitors see it" preview.
 *
 * It does not imitate the public pages: it builds a record from the form and runs it through the
 * real privacy boundary (`toPublicDocument`), so what the preview shows is by construction what a
 * visitor could be shown. A field that is `public: false` cannot appear here because the same
 * function that guards the public pages refuses to copy it across.
 */

/** Shown in place of a code that does not exist yet. Never a real code. */
export const PREVIEW_CODE = "ACV-····-····-····";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "4 Nov 2026" from YYYY-MM-DD, written the same on the server and in the browser (no locale, no time zone). */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month} ${match[1]}` : value;
}

/** "4 Nov 2026, 14:32 UTC" from an ISO timestamp. UTC on purpose: it renders identically during hydration. */
export function formatDateTimeUtc(value: string | null | undefined): string {
  if (!value) return "";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "";
  const date = new Date(time);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

export interface PreviewFile {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface PreviewContext {
  /** The stored record, when editing: supplies the verification code and revocation. */
  stored: DocumentRecord | null;
  /** The primary file the record will have after saving, if any. */
  primary: PreviewFile | null;
  photo: PreviewFile | null;
  /** A code will exist once saved, even though none has been issued yet. */
  willHaveCode: boolean;
}

function fileMeta(role: "primary" | "photo", file: PreviewFile): DocumentFileMeta {
  return {
    id: `preview-${role}`,
    documentId: "preview",
    role,
    filename: file.filename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: "",
    createdAt: "",
  };
}

/**
 * A record that looks like the form's current answers, forced to "published" so the preview shows
 * the finished result rather than a blank "drafts are hidden" screen.
 */
export function previewRecord(category: DocumentCategory, values: EditorValues, context: PreviewContext): DocumentRecord {
  const files: DocumentFileMeta[] = [];
  if (context.primary) files.push(fileMeta("primary", context.primary));
  if (context.photo) files.push(fileMeta("photo", context.photo));
  const title = values.title.trim();
  return {
    id: "preview",
    category,
    title: title || "Untitled document",
    summary: values.summary.trim(),
    status: "published",
    visibility: values.visibility,
    allowDownload: values.allowDownload,
    allowView: values.allowView,
    featured: values.featured,
    sortOrder: 0,
    holderName: values.holderName.trim(),
    referenceNo: values.referenceNo.trim(),
    issuedOn: values.issuedOn.trim() || null,
    expiresOn: values.expiresOn.trim() || null,
    verificationCode: context.stored?.verificationCode ?? (context.willHaveCode ? PREVIEW_CODE : null),
    revokedAt: context.stored?.revokedAt ?? null,
    revokedReason: context.stored?.revokedReason ?? "",
    data: buildDataPayload(category, values.data),
    files,
    createdAt: context.stored?.createdAt ?? "",
    updatedAt: context.stored?.updatedAt ?? "",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
  };
}

export type PreviewProjection =
  | { kind: "listing"; doc: PublicDocument }
  | { kind: "verify"; doc: PublicDocument; note?: string }
  | { kind: "private" }
  | { kind: "hidden"; reason: string };

/** What a visitor would be shown for this record: the listing card, the verify page, or nothing. */
export function projectPreview(record: DocumentRecord, now: Date = new Date()): PreviewProjection {
  if (record.visibility === "private") return { kind: "private" };

  if (record.visibility === "public") {
    const listed = toPublicDocument(record, "listing", now);
    if (listed) return { kind: "listing", doc: listed };
    if (!record.revokedAt) {
      const spec = CATEGORIES[record.category];
      return {
        kind: "hidden",
        reason:
          requiresConsent(spec) && record.data[CONSENT_FIELD_KEY] !== true
            ? "Not listed yet: a person is listed publicly only once their consent is recorded."
            : "This record would not appear on the Documents page.",
      };
    }
    // A revoked record leaves the listing but still answers at its code, which is what a visitor can reach.
    const revoked = toPublicDocument(record, "verify", now);
    return revoked
      ? { kind: "verify", doc: revoked, note: "Revoked records are removed from the Documents page. Only the code still answers." }
      : { kind: "hidden", reason: "This record would not be visible." };
  }

  const doc = toPublicDocument(record, "verify", now);
  return doc ? { kind: "verify", doc } : { kind: "hidden", reason: "This record would not be visible." };
}

/** A stored value as a person reads it: the option's label, a plain date, "Yes"/"No", a tag list. */
export function formatFieldValue(category: DocumentCategory, field: FieldSpec, value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  switch (field.type) {
    case "select":
      return optionLabel(category, field.key, value);
    case "date":
      return typeof value === "string" ? formatDateOnly(value) : "";
    case "boolean":
      return value === true ? "Yes" : "No";
    case "tags":
      return Array.isArray(value) ? value.join(", ") : "";
    default:
      return String(value);
  }
}

export interface PreviewRow {
  key: string;
  label: string;
  value: string;
}

/** The public category fields that carry a value, in spec order, with their labels. */
export function publicRows(doc: PublicDocument): PreviewRow[] {
  const spec = CATEGORIES[doc.category];
  const rows: PreviewRow[] = [];
  for (const field of spec.fields) {
    const text = formatFieldValue(doc.category, field, doc.fields[field.key]);
    if (text) rows.push({ key: field.key, label: field.label, value: text });
  }
  return rows;
}

/** The small chips on a listing card: the category's `cardMeta` fields that have a value. */
export function cardChips(doc: PublicDocument): string[] {
  const spec = CATEGORIES[doc.category];
  const chips: string[] = [];
  for (const key of spec.cardMeta) {
    const field = spec.fields.find((candidate) => candidate.key === key);
    if (!field) continue;
    // A profile saved before levels existed is listed as a team member, so the preview says so too.
    const stored = key === "hierarchy_level" ? teamLevel(doc.fields) : doc.fields[key];
    const text = formatFieldValue(doc.category, field, stored);
    if (text) chips.push(text);
  }
  return chips;
}

export interface VisitorSummary {
  /** Labels a visitor can see once the record is live. */
  shown: string[];
  /** Labels that only ever appear in this console. */
  admin: string[];
}

/** What visitors can and cannot see for a category, read straight from the specs. */
export function visitorSummary(category: DocumentCategory): VisitorSummary {
  const spec = CATEGORIES[category];
  const shown: string[] = [spec.base.title.label];
  for (const key of ["summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
    if (!spec.base[key].hidden) shown.push(spec.base[key].label);
  }
  const admin: string[] = [];
  for (const field of spec.fields) {
    (field.public ? shown : admin).push(field.label);
  }
  return { shown, admin };
}
