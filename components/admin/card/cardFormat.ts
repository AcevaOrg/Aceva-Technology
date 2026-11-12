/**
 * Small pure formatters for the QR label page: link shortening, dates and the URLs of the admin endpoints
 * the preview reads from. Isomorphic and dependency-free (the client bundle imports it).
 */

/** The QR label page of a record. (The path keeps its original name; it is linked from saved bookmarks.) */
export function cardRoute(id: string): string {
  return `/admin/documents/${id}/card`;
}

/* ------------------------------------------------------------------ *
 * Admin endpoints                                                      *
 * ------------------------------------------------------------------ */

const QR_MIN_SIZE = 128;
const QR_MAX_SIZE = 1024;

export interface QrUrlOptions {
  format?: "svg" | "png";
  /** Pixel size, clamped to the endpoint's 128..1024 range. Only meaningful for PNG downloads. */
  size?: number;
  /** Ask for `Content-Disposition: attachment`. */
  download?: boolean;
}

/** URL of the admin QR endpoint for a record (SVG unless told otherwise). */
export function adminQrUrl(id: string, options: QrUrlOptions = {}): string {
  const params = new URLSearchParams();
  params.set("format", options.format ?? "svg");
  if (options.size !== undefined && Number.isFinite(options.size)) {
    params.set("size", String(Math.min(QR_MAX_SIZE, Math.max(QR_MIN_SIZE, Math.round(options.size)))));
  }
  if (options.download) params.set("download", "1");
  return `/api/admin/documents/${encodeURIComponent(id)}/qr?${params.toString()}`;
}

/* ------------------------------------------------------------------ *
 * Text                                                                 *
 * ------------------------------------------------------------------ */

/**
 * "https://www.acevatech.com/verify/ACV-7K3M-9QXD-4TRH?x=1" becomes "acevatech.com/verify/ACV-7K3M-9QXD-4TRH":
 * what a person can read off a label and type. Scheme, `www.`, query, fragment and trailing slashes go;
 * the path keeps its case because verification codes are upper-case.
 */
export function shortUrl(url: string): string {
  const trimmed = typeof url === "string" ? url.trim() : "";
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const host = parsed.host.replace(/^www\./i, "");
      const path = parsed.pathname.replace(/\/+$/, "");
      return `${host}${path}`;
    }
  } catch {
    // not an absolute URL: fall through to the plain-text clean-up
  }
  return trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * "2026-03-12" becomes "12 Mar 2026". Fixed English month names rather than Intl, so the server and the
 * browser can never disagree about the text (a hydration mismatch) and the page reads the same on any
 * machine. Anything that is not a real calendar date gives "".
 */
export function formatCardDate(iso: string | null | undefined): string {
  if (typeof iso !== "string") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  const real = probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  if (!real) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
