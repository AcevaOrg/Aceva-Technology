/**
 * Shared vocabulary for the document registry. Isomorphic: imported by the admin editor,
 * the public pages and the server store alike, so it must stay free of server-only imports.
 */

export const DOCUMENT_CATEGORY_KEYS = [
  "financial_report",
  "company_identity",
  "certification",
  "program_record",
  "experience_letter",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORY_KEYS)[number];

/**
 * Where a team member sits, highest first. The ORDER IS THE RANK: the public Team section lists
 * its tiers in this order, and the admin select offers the options in it. A record saved before the
 * hierarchy existed has no level and is treated as "member" (see lib/documents/team.ts).
 */
export const HIERARCHY_LEVELS = ["leadership", "management", "team_lead", "member", "trainee"] as const;

export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

/** draft = admin only · published = live (subject to visibility) · archived = hidden but kept. */
export type DocumentStatus = "draft" | "published" | "archived";

/**
 * public   – listed on /documents and reachable by its verification code.
 * unlisted – never listed; reachable only through its verification code / QR.
 * private  – admin only; the verification code reports "not found".
 */
export type DocumentVisibility = "public" | "unlisted" | "private";

/** Outcome of a public lookup. "not_found" also covers private, draft and archived records. */
export type VerificationState = "valid" | "expired" | "revoked" | "not_found";

export type FileRole = "primary" | "photo";

export type FieldValue = string | number | boolean | string[] | null;

export interface DocumentFileMeta {
  id: string;
  documentId: string;
  role: FileRole;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Hex SHA-256 of the stored bytes. Shown on the verify page so a printout can be checked. */
  sha256: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  category: DocumentCategory;
  title: string;
  /** "" when not set. */
  summary: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  /** Whether the public (listing or verify page) may open/download the primary file. */
  allowDownload: boolean;
  featured: boolean;
  sortOrder: number;
  /** Person or entity the record is about. "" when the category has none. */
  holderName: string;
  /** Certificate / ID / letter / registration number. "" when not set. */
  referenceNo: string;
  /** YYYY-MM-DD, or null. */
  issuedOn: string | null;
  expiresOn: string | null;
  /** Non-null once QR verification is enabled, e.g. "ACV-7K3M-9QXD-4TRH". */
  verificationCode: string | null;
  revokedAt: string | null;
  revokedReason: string;
  /** Category-specific values, keyed by `FieldSpec.key`. Validated against lib/documents/categories.ts. */
  data: Record<string, FieldValue>;
  files: DocumentFileMeta[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  verifyCount: number;
  lastVerifiedAt: string | null;
}

/* ------------------------------------------------------------------ *
 * Field specification — one declarative source drives the admin form,  *
 * server validation and what the public pages may display.             *
 * ------------------------------------------------------------------ */

export type FieldType = "text" | "textarea" | "date" | "select" | "number" | "boolean" | "tags" | "url" | "email";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  /** Heading of the editor fieldset this field belongs to. */
  group: string;
  required?: boolean;
  /** select only. */
  options?: readonly FieldOption[];
  placeholder?: string;
  help?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  /** boolean only: initial value for a new record. */
  defaultValue?: FieldValue;
  /**
   * May this value be shown to the public (listing cards and the verify page)?
   * false = admin only. Personal data (emails, internal notes) must be false.
   */
  public: boolean;
  /** Only shown — and only validated — while another field of the same record has this value. */
  showWhen?: { key: string; equals: string | boolean };
  /** Required only while another field has this value (in addition to `required`). */
  requiredWhen?: { key: string; equals: string | boolean };
}

/** How a column that exists on every record is presented for one category. */
export interface BaseFieldSpec {
  label: string;
  required: boolean;
  /** Hide the input entirely for this category. */
  hidden?: boolean;
  placeholder?: string;
  help?: string;
}

export interface CategorySpec {
  key: DocumentCategory;
  /** Singular noun: "Financial report". */
  label: string;
  /** Section / filter heading: "Financial reports". */
  plural: string;
  /** Anchor id on /documents and the `category` query value in admin URLs. */
  slug: string;
  /** Public section kicker, mono caps. */
  eyebrow: string;
  /** Public section lede. */
  blurb: string;
  /** One-line help shown at the top of the admin editor. */
  adminHelp: string;
  /** Contains personal data: never listed publicly without explicit consent. */
  personal: boolean;
  /** QR verification is enabled by default for new records. */
  verifiable: boolean;
  allowedVisibility: readonly DocumentVisibility[];
  defaultVisibility: DocumentVisibility;
  /** The record can carry a portrait (team profiles). */
  hasPhoto: boolean;
  /** A photo must be attached before the record can be published. */
  photoRequired: boolean;
  /** A primary file must be attached before the record can be published. */
  fileRequired: boolean;
  /** Prefix suggested for reference numbers, e.g. "ACV/EL". */
  referencePrefix: string;
  base: {
    title: BaseFieldSpec;
    summary: BaseFieldSpec;
    holderName: BaseFieldSpec;
    referenceNo: BaseFieldSpec;
    issuedOn: BaseFieldSpec;
    expiresOn: BaseFieldSpec;
  };
  fields: readonly FieldSpec[];
  /** `data` keys summarised as small chips on listing cards, in order. */
  cardMeta: readonly string[];
}

/* ------------------------------------------------------------------ *
 * Upload rules (single source for client hints and server enforcement) *
 * ------------------------------------------------------------------ */

export const PRIMARY_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export const PHOTO_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Vercel rejects request bodies over 4.5 MB before our code runs, so the whole multipart
 * request (document + photo + fields) is capped below that. Larger files need a different
 * storage backend, not a bigger number here.
 */
export const MAX_REQUEST_BYTES = 4_400_000;
export const MAX_PRIMARY_BYTES = 4_000_000;
export const MAX_PHOTO_BYTES = 1_200_000;

export const DOCUMENT_STATUSES: readonly DocumentStatus[] = ["draft", "published", "archived"];
export const DOCUMENT_VISIBILITIES: readonly DocumentVisibility[] = ["public", "unlisted", "private"];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const VISIBILITY_LABELS: Record<DocumentVisibility, { label: string; help: string }> = {
  public: { label: "Public", help: "Listed on the Documents page and verifiable by QR code." },
  unlisted: { label: "Unlisted", help: "Not listed anywhere. Only reachable by its QR code or verification code." },
  private: { label: "Private", help: "Admin only. Verification reports it as not found." },
};

export const VERIFICATION_LABELS: Record<VerificationState, string> = {
  valid: "Valid",
  expired: "Expired",
  revoked: "Revoked",
  not_found: "Not found",
};
