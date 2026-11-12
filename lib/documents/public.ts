import { CATEGORIES } from "./categories";
import type { DocumentCategory, DocumentRecord, FieldSpec, FieldValue } from "./types";
import { parseHttpUrl, visibleFieldKeys } from "./validate";

/**
 * THE privacy boundary of the document registry.
 *
 * Every public surface (the /documents listing, the /verify/<code> page, their JSON) is built from
 * a `PublicDocument`, and a `PublicDocument` is built only here. Nothing in it can be added by
 * accident: a value reaches the public only if its spec says `public: true`, it is currently
 * visible under `showWhen`, and it is non-empty. Admin-only data (internal notes, emails,
 * responsibilities, consent flags) is never copied across.
 *
 * Pure and dependency-free so it can be tested exhaustively and reused anywhere.
 */

export type PublicState = "valid" | "expired" | "revoked";

export type PublicContext = "listing" | "verify";

export interface PublicDocument {
  id: string;
  category: DocumentCategory;
  title: string;
  summary: string;
  holderName: string;
  referenceNo: string;
  issuedOn: string | null;
  expiresOn: string | null;
  state: PublicState;
  verificationCode: string | null;
  allowDownload: boolean;
  /** A primary file exists AND the admin allowed public download AND the record is not revoked. */
  hasFile: boolean;
  /** A photo exists AND the record opts in to showing it (`show_photo`). */
  hasPhoto: boolean;
  /** Metadata of the downloadable file; null whenever `hasFile` is false. */
  file: { filename: string; mimeType: string; sizeBytes: number; sha256: string } | null;
  featured: boolean;
  publishedAt: string | null;
  revokedAt: string | null;
  /** Category-specific values safe to show, keyed by field key. */
  fields: Record<string, FieldValue>;
}

/**
 * Valid / expired / revoked. Revocation always wins. Expiry is judged by UTC calendar date: a
 * record is valid through the whole of its `expiresOn` day and expired from the next day on.
 */
export function computeVerificationState(
  record: Pick<DocumentRecord, "revokedAt" | "expiresOn">,
  now: Date = new Date(),
): PublicState {
  if (record.revokedAt) return "revoked";
  if (record.expiresOn) {
    const today = now.toISOString().slice(0, 10);
    if (record.expiresOn < today) return "expired";
  }
  return "valid";
}

/** A stored value rendered only if it is well-formed for its field type; anything else is dropped. */
function publicValue(field: FieldSpec, stored: FieldValue | undefined): FieldValue | undefined {
  if (stored === undefined || stored === null) return undefined;
  switch (field.type) {
    case "boolean":
      return typeof stored === "boolean" ? stored : undefined;
    case "number":
      return typeof stored === "number" && Number.isFinite(stored) ? stored : undefined;
    case "tags": {
      if (!Array.isArray(stored)) return undefined;
      const tags = stored.filter((tag): tag is string => typeof tag === "string" && tag.trim() !== "");
      return tags.length > 0 ? tags : undefined;
    }
    case "url": {
      // Re-checked on the way out: a row written around the validator must not become a javascript: link.
      if (typeof stored !== "string") return undefined;
      return parseHttpUrl(stored.trim()) ?? undefined;
    }
    default:
      return typeof stored === "string" && stored.trim() !== "" ? stored : undefined;
  }
}

function publicFields(record: DocumentRecord): Record<string, FieldValue> {
  const spec = CATEGORIES[record.category];
  const visible = visibleFieldKeys(record.category, record.data);
  const fields: Record<string, FieldValue> = {};
  for (const field of spec.fields) {
    if (!field.public || !visible.has(field.key)) continue;
    const shown = publicValue(field, record.data[field.key]);
    if (shown !== undefined) fields[field.key] = shown;
  }
  return fields;
}

/**
 * Projects a stored record onto what the public may see in `context`, or null when it must not be
 * visible there at all.
 *
 * Hidden everywhere: drafts, archived records, private records.
 * "listing" (the /documents page): visibility must be public; a personal record also needs the
 *   person's recorded consent; revoked records are not listed (they exist only behind their code).
 * "verify" (a QR / code lookup): public and unlisted records resolve. A revoked record collapses
 *   to title, reference and revocation date so a stale printout cannot be mistaken for a live one,
 *   while leaking nothing about the holder.
 */
export function toPublicDocument(
  record: DocumentRecord,
  context: PublicContext,
  now: Date = new Date(),
): PublicDocument | null {
  const spec = CATEGORIES[record.category];
  if (!spec) return null;
  if (record.status !== "published") return null;
  if (record.visibility === "private") return null;
  if (context === "listing" && record.visibility !== "public") return null;

  const state = computeVerificationState(record, now);

  if (state === "revoked") {
    if (context === "listing") return null;
    return {
      id: record.id,
      category: record.category,
      title: record.title,
      summary: "",
      holderName: "",
      referenceNo: record.referenceNo,
      issuedOn: null,
      expiresOn: null,
      state,
      verificationCode: null,
      allowDownload: false,
      hasFile: false,
      hasPhoto: false,
      file: null,
      featured: false,
      publishedAt: null,
      revokedAt: record.revokedAt,
      fields: {},
    };
  }

  if (context === "listing" && spec.personal && record.data.consent_to_publish !== true) return null;

  const primary = record.files.find((file) => file.role === "primary");
  const hasPhoto = spec.hasPhoto && record.data.show_photo === true && record.files.some((file) => file.role === "photo");
  const hasFile = Boolean(primary) && record.allowDownload;

  return {
    id: record.id,
    category: record.category,
    title: record.title,
    summary: spec.base.summary.hidden ? "" : record.summary,
    holderName: spec.base.holderName.hidden ? "" : record.holderName,
    referenceNo: record.referenceNo,
    issuedOn: spec.base.issuedOn.hidden ? null : record.issuedOn,
    expiresOn: spec.base.expiresOn.hidden ? null : record.expiresOn,
    state,
    verificationCode: record.verificationCode,
    allowDownload: record.allowDownload,
    hasFile,
    hasPhoto,
    file:
      hasFile && primary
        ? { filename: primary.filename, mimeType: primary.mimeType, sizeBytes: primary.sizeBytes, sha256: primary.sha256 }
        : null,
    featured: record.featured,
    publishedAt: record.publishedAt,
    revokedAt: null,
    fields: publicFields(record),
  };
}
