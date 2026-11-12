import { CATEGORIES, optionLabel } from "@/lib/documents/categories";
import type { PublicDocument } from "@/lib/documents/public";
import type { DocumentCategory, FieldValue, FileRole } from "@/lib/documents/types";
import { ROUTES } from "@/lib/nav";
import { CONTACT_EMAIL } from "@/lib/social";
import { parseHttpUrl } from "@/lib/documents/validate";

/**
 * Pure display helpers for the public document pages. Everything here takes already-projected,
 * public data (a `PublicDocument`) and returns plain strings or small view-models, so the markup
 * stays free of formatting decisions and each rule can be tested on its own.
 */

/* ------------------------------------------------------------------ *
 * Dates                                                                *
 * ------------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-03-12" → "12 Mar 2026". Read from the characters, never through Date, so no time zone can shift the day. */
export function formatDate(value: string | null | undefined): string {
  const match = typeof value === "string" ? DATE_ONLY.exec(value) : null;
  if (!match) return "";
  const month = Number(match[2]);
  if (month < 1 || month > 12) return "";
  return `${Number(match[3])} ${MONTHS[month - 1]} ${match[1]}`;
}

/** An ISO instant → "4 Nov 2026, 14:03 UTC". Always UTC, so the line reads the same for every visitor. */
export function formatUtcTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** "12 Mar 2026 – 9 Jun 2026", "12 Mar 2026 – Present", or just the start; "" when there is no start. */
export function formatDateRange(start: FieldValue | undefined, end: FieldValue | undefined, openLabel = "Present"): string {
  const from = typeof start === "string" ? formatDate(start) : "";
  const to = typeof end === "string" ? formatDate(end) : "";
  if (!from && !to) return "";
  if (from && to) return `${from} – ${to}`;
  return from ? `${from} – ${openLabel}` : to;
}

/* ------------------------------------------------------------------ *
 * Names and sizes                                                      *
 * ------------------------------------------------------------------ */

/** Up to two initials (first and last word), by code point so accented and non-Latin names survive. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0] ?? "";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/** Decimal units, one decimal place at most: 1_250_000 → "1.3 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(Math.round(bytes / 100_000) / 10).toString()} MB`;
}

export function fileKindLabel(mimeType: string): string {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";
    case "image/png":
      return "PNG image";
    case "image/jpeg":
      return "JPEG image";
    case "image/webp":
      return "WEBP image";
    default:
      return "File";
  }
}

/* ------------------------------------------------------------------ *
 * Links                                                                *
 * ------------------------------------------------------------------ */

/**
 * The public file URL for a record. `code` is added only for records that are reachable by it
 * (unlisted ones); `encodeURIComponent` keeps a value from ever changing the query's structure.
 */
export function fileHref(id: string, role: FileRole, options: { code?: string | null; download?: boolean } = {}): string {
  const params = [`role=${role}`];
  if (options.code) params.push(`code=${encodeURIComponent(options.code)}`);
  if (options.download) params.push("download=1");
  return `/api/documents/${encodeURIComponent(id)}/file?${params.join("&")}`;
}

/**
 * The "Report a problem" mailto. The subject names the code only when it is a real, canonical one, so
 * arbitrary text from the address bar is never copied into a mail header.
 */
export function reportProblemHref(canonicalCode: string | null): string {
  const subject = canonicalCode ? `Verification problem: ${canonicalCode}` : "Verification problem";
  const body = [
    "Hello,",
    "",
    `I checked a document on ${ROUTES.verify} and something does not look right.`,
    "",
    "What I expected:",
    "What I saw:",
  ].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** An http(s) URL or null, even if a stored value somehow slipped past validation (no javascript: links). */
export function safeHref(value: unknown): string | null {
  return typeof value === "string" ? parseHttpUrl(value.trim()) : null;
}

/* ------------------------------------------------------------------ *
 * Reading public fields                                                *
 * ------------------------------------------------------------------ */

export function fieldString(fields: Record<string, FieldValue>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

export function fieldTags(fields: Record<string, FieldValue>, key: string): string[] {
  const value = fields[key];
  return Array.isArray(value) ? value.filter((tag) => tag.trim() !== "") : [];
}

/** "Full year", "Q3", or the custom range when the period is custom. */
export function periodLabel(doc: PublicDocument): string {
  const period = fieldString(doc.fields, "period");
  if (period === "custom") {
    return formatDateRange(doc.fields.period_start, doc.fields.period_end) || optionLabel(doc.category, "period", period);
  }
  return optionLabel(doc.category, "period", period);
}

export type FieldRow =
  | { key: string; label: string; kind: "text" | "multiline"; text: string }
  | { key: string; label: string; kind: "tags"; tags: string[] }
  | { key: string; label: string; kind: "link"; text: string; href: string };

/**
 * The record's public fields as labelled rows, in the order the category declares them. A select
 * shows its option label, a date is formatted, a boolean reads Yes/No, a URL becomes a link only if
 * it is a real http(s) address. Nothing is shown that `PublicDocument.fields` does not already hold.
 */
export function publicFieldRows(doc: PublicDocument): FieldRow[] {
  const rows: FieldRow[] = [];
  for (const field of CATEGORIES[doc.category].fields) {
    if (!field.public || !(field.key in doc.fields)) continue;
    const value = doc.fields[field.key];
    const base = { key: field.key, label: field.label };

    switch (field.type) {
      case "select": {
        const text = optionLabel(doc.category, field.key, value);
        if (text) rows.push({ ...base, kind: "text", text });
        break;
      }
      case "date": {
        const text = typeof value === "string" ? formatDate(value) : "";
        if (text) rows.push({ ...base, kind: "text", text });
        break;
      }
      case "boolean":
        if (typeof value === "boolean") rows.push({ ...base, kind: "text", text: value ? "Yes" : "No" });
        break;
      case "number":
        if (typeof value === "number") rows.push({ ...base, kind: "text", text: String(value) });
        break;
      case "tags": {
        const tags = Array.isArray(value) ? value.filter((tag) => tag.trim() !== "") : [];
        if (tags.length > 0) rows.push({ ...base, kind: "tags", tags });
        break;
      }
      case "url": {
        const href = safeHref(value);
        if (href) rows.push({ ...base, kind: "link", text: href.replace(/^https?:\/\//, "").replace(/\/$/, ""), href });
        break;
      }
      case "textarea":
        if (typeof value === "string" && value.trim() !== "") rows.push({ ...base, kind: "multiline", text: value });
        break;
      default:
        if (typeof value === "string" && value.trim() !== "") rows.push({ ...base, kind: "text", text: value });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * What a verifier sees                                                 *
 * ------------------------------------------------------------------ */

/**
 * For the "Verified by QR" panels: what someone who scans a code is shown and what stays private,
 * worded from the category's own field specs so the explanation can never promise more or less
 * than the verify page really does.
 */
export function describeVerifierView(category: DocumentCategory): { sees: string[]; hidden: string[] } {
  const spec = CATEGORIES[category];
  const sees: string[] = [];
  const { holderName, referenceNo, issuedOn, expiresOn } = spec.base;
  if (!holderName.hidden) sees.push(holderName.label);
  if (!referenceNo.hidden) sees.push(referenceNo.label);
  if (!issuedOn.hidden) sees.push(issuedOn.label);
  if (!expiresOn.hidden) sees.push(expiresOn.label);
  for (const field of spec.fields) if (field.public) sees.push(field.label);
  if (spec.hasPhoto) sees.push("Photo, only when the holder has agreed");
  sees.push("Whether the record is valid, expired or revoked");

  // Switches such as "Show photo on the verify page" are settings about the record, not data held back.
  const hidden = spec.fields.filter((field) => !field.public && field.type !== "boolean").map((field) => field.label);
  return { sees, hidden };
}
