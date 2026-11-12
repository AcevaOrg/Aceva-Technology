/**
 * Small pure helpers shared by the admin UI kit. Nothing here touches React, the DOM or the
 * network, so every function can be unit tested in isolation.
 */

/** Joins class names, skipping falsy parts. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ *
 * Files                                                                *
 * ------------------------------------------------------------------ */

/**
 * "4 MB", "1.2 MB", "380 KB". Decimal units, because the upload limits in
 * lib/documents/types.ts are decimal (4_000_000 reads as "4 MB", not "3.8 MB").
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const kb = bytes / 1000;
  if (kb < 1000) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1000;
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, "") : Math.round(mb)} MB`;
}

const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/webp": "WEBP",
};

/** Short, human name for a MIME type: "PDF", "PNG"; falls back to the upper-cased subtype. */
export function mimeLabel(mime: string): string {
  const known = MIME_LABELS[mime.toLowerCase()];
  if (known) return known;
  const subtype = mime.split("/")[1] ?? mime;
  return subtype.replace(/^x-/, "").toUpperCase() || "FILE";
}

/** "PDF, PNG, JPEG or WEBP" */
export function describeAccepted(accept: readonly string[]): string {
  const labels = Array.from(new Set(accept.map(mimeLabel)));
  if (labels.length <= 1) return labels[0] ?? "supported";
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * The MIME type to trust for a picked file. Some browsers and operating systems report an empty
 * `type` (a file dragged from a network share, for instance), so fall back to the extension.
 * This is a convenience check only: the server re-verifies the real bytes.
 */
export function inferMime(file: { name: string; type: string }): string {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[extension] ?? "";
}

/** `null` when the file is acceptable, otherwise the sentence to show next to the drop zone. */
export function validateUpload(
  file: { name: string; type: string; size: number },
  accept: readonly string[],
  maxBytes: number,
): string | null {
  if (file.size <= 0) return "That file is empty.";
  const mime = inferMime(file);
  if (!accept.some((allowed) => allowed.toLowerCase() === mime)) {
    return `Use a ${describeAccepted(accept)} file.`;
  }
  if (file.size > maxBytes) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Tags                                                                 *
 * ------------------------------------------------------------------ */

export interface TagAddResult {
  next: string[];
  /** Why part of the input was dropped, so the UI can say so. */
  skipped: "limit" | "length" | null;
}

/**
 * Adds the tags in `raw` (comma, semicolon or newline separated) to `current`.
 * Trims and collapses whitespace, ignores duplicates case-insensitively, rejects tags over
 * `maxLength` rather than silently cutting them, and stops at `max` tags.
 */
export function addTags(
  current: readonly string[],
  raw: string,
  limits: { max: number; maxLength: number },
): TagAddResult {
  const next = [...current];
  const seen = new Set(next.map((tag) => tag.toLowerCase()));
  let skipped: TagAddResult["skipped"] = null;

  for (const piece of raw.split(/[,;\n\r]+/)) {
    const tag = piece.replace(/\s+/g, " ").trim();
    if (!tag) continue;
    if (tag.length > limits.maxLength) {
      skipped = "length";
      continue;
    }
    if (seen.has(tag.toLowerCase())) continue;
    if (next.length >= limits.max) {
      skipped = "limit";
      break;
    }
    seen.add(tag.toLowerCase());
    next.push(tag);
  }

  return { next, skipped };
}

/* ------------------------------------------------------------------ *
 * Time                                                                 *
 * ------------------------------------------------------------------ */

/**
 * Session timestamps arrive as epoch milliseconds, but a value in epoch seconds (anything before
 * the year 5138 when read as seconds) is converted rather than rendered as January 1970.
 */
export function toEpochMs(value: number): number {
  return value < 1e11 ? value * 1000 : value;
}

/** "3h 12m", "8m", "under a minute". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "under a minute";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** "0:42", "1:05": the login lockout countdown. */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Navigation                                                           *
 * ------------------------------------------------------------------ */

/**
 * Client-side guard for a post-login destination. The server already sanitises `next`; this is the
 * second lock, so a tampered response can never send the browser off-site or outside /admin.
 */
export function safeAdminPath(value: unknown, fallback = "/admin"): string {
  if (typeof value !== "string") return fallback;
  if (value !== "/admin" && !value.startsWith("/admin/") && !value.startsWith("/admin?")) return fallback;
  if (value.includes("\\") || value.includes("//") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
