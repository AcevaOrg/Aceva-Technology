import { createHash } from "node:crypto";
import { MAX_PHOTO_BYTES, MAX_PRIMARY_BYTES, type FileRole } from "./types";

/**
 * Upload inspection: decides what a file REALLY is before a single byte reaches the database.
 *
 * Nothing the browser says is trusted. The type comes from magic bytes; the file name and the
 * declared Content-Type are only checked for agreement with it. Files are later served from our
 * own origin, so anything that could execute there (scripts in a PDF, HTML disguised as an image)
 * has to be refused here.
 */

export type UploadErrorCode = "too_large" | "empty" | "unsupported" | "mismatch" | "active_content";

export interface InspectedUpload {
  /** Sanitised and given an extension that matches the sniffed type. */
  filename: string;
  /** Derived from the bytes, never from the client. */
  mimeType: string;
  sizeBytes: number;
  /** Hex SHA-256 of `bytes`. */
  sha256: string;
  bytes: Buffer;
}

export type InspectResult =
  | { ok: true; file: InspectedUpload }
  | { ok: false; error: string; code: UploadErrorCode };

type Kind = "pdf" | "png" | "jpeg" | "webp";

const KINDS: Record<Kind, { mime: string; label: string; extensions: readonly string[]; canonical: string }> = {
  pdf: { mime: "application/pdf", label: "PDF", extensions: ["pdf"], canonical: "pdf" },
  png: { mime: "image/png", label: "PNG image", extensions: ["png"], canonical: "png" },
  jpeg: { mime: "image/jpeg", label: "JPEG image", extensions: ["jpg", "jpeg", "jpe", "jfif"], canonical: "jpg" },
  webp: { mime: "image/webp", label: "WEBP image", extensions: ["webp"], canonical: "webp" },
};

/** Spellings browsers and tools use for the same type. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "application/x-pdf": "application/pdf",
};

/** "I do not know" answers from a browser; they carry no information, so they cannot conflict. */
const UNSPECIFIED_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

const PDF_SNIFF_WINDOW = 1024;
const MAX_FILENAME_LENGTH = 120;

/* ------------------------------------------------------------------ *
 * Filenames                                                           *
 * ------------------------------------------------------------------ */

const FILENAME_CONTROLS = /[\u0000-\u001F\u007F-\u009F]/g;
// Zero-width and bidi characters: an RTL override can make "gpj.exe" display as "exe.jpg".
const FILENAME_INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const FILENAME_UNSAFE = /["'`<>:*?|;\\/]/g;

function splitExtension(name: string): { stem: string; extension: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { stem: name, extension: "" };
  const extension = name.slice(dot + 1);
  return /^[A-Za-z0-9]{1,8}$/.test(extension)
    ? { stem: name.slice(0, dot), extension: extension.toLowerCase() }
    : { stem: name, extension: "" };
}

/**
 * Makes a client-supplied name safe to store and to put in a header: no path, no control or
 * invisible characters, no quotes or shell/FS metacharacters, collapsed spaces, at most 120
 * characters. A short alphanumeric extension is kept (lower-cased); when nothing usable is left the
 * name falls back to "document" plus `fallbackExtension`.
 */
export function sanitizeFilename(name: string, fallbackExtension = ""): string {
  const fallback = fallbackExtension ? `.${fallbackExtension.replace(/^\./, "").toLowerCase()}` : "";
  const lastSegment = String(name).split(/[\\/]/).pop() ?? "";
  const cleaned = lastSegment
    .normalize("NFC")
    .replace(FILENAME_CONTROLS, "")
    .replace(FILENAME_INVISIBLE, "")
    .replace(FILENAME_UNSAFE, "")
    .replace(/\s+/g, " ")
    .trim()
    // No hidden files, no relative-path remnants, no trailing dots (Windows drops them).
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "");

  const { stem, extension } = splitExtension(cleaned);
  const suffix = extension ? `.${extension}` : fallback;
  const room = Math.max(1, MAX_FILENAME_LENGTH - suffix.length);
  const trimmedStem = Array.from(stem.trim()).slice(0, room).join("").trim();
  return `${trimmedStem || "document"}${suffix}`;
}

/** Extension (lower-case, no dot) of a client-supplied name, or "". */
function extensionOf(name: string): string {
  const base = String(name).split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).trim().toLowerCase() : "";
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Content-Disposition per RFC 6266: a plain ASCII `filename` for old clients and the exact name as
 * `filename*=UTF-8''\u2026` for everyone else. Control characters and quotes are removed first, so a
 * stored name can never break out of the header (response splitting).
 */
export function contentDisposition(filename: string, disposition: "inline" | "attachment"): string {
  const safe =
    String(filename).replace(FILENAME_CONTROLS, "").replace(FILENAME_INVISIBLE, "").replace(/["\\/]/g, "").trim() || "download";
  const ascii =
    safe
      .normalize("NFKD")
      .replace(/[\u0300-\u036F]/g, "")
      .replace(/[^A-Za-z0-9 ._()+,@~-]/g, "_") || "download";
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(safe)}`;
}

/* ------------------------------------------------------------------ *
 * Sniffing                                                            *
 * ------------------------------------------------------------------ */

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Every format whose signature matches. More than one means a polyglot, which is refused. */
function sniffKinds(bytes: Uint8Array): Kind[] {
  const kinds: Kind[] = [];
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) kinds.push("png");
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) kinds.push("jpeg");
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) kinds.push("webp");
  const head = Buffer.from(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, PDF_SNIFF_WINDOW));
  if (head.indexOf("%PDF-", 0, "latin1") !== -1) kinds.push("pdf");
  return kinds;
}

// A PDF name ends at whitespace (NUL included) or a delimiter, so "/Launch" must not match "/Launcher".
const NAME_END = String.raw`(?=[\s\0/<>\[\](){}%]|$)`;
const NAMED_MARKERS = new RegExp(`/(?:JavaScript|Launch|EmbeddedFile)${NAME_END}`);
// "/JS" is only three bytes, which compressed image data contains every few megabytes. A real entry is
// always followed by a string, a hex string or an object reference, so require one of those.
const JS_ENTRY = String.raw`/JS[\s\0]*(?:\(|<|\d+[\s\0]+\d+[\s\0]+R)`;
const SCRIPT_MARKERS = new RegExp(`${NAMED_MARKERS.source}|${JS_ENTRY}`);
const OPEN_ACTION = new RegExp(`/OpenAction${NAME_END}`);
const ADDITIONAL_ACTIONS = new RegExp(`/AA${NAME_END}`);

/**
 * True when a PDF carries markers of active content: scripts, launch actions, embedded files, or
 * an open action combined with additional actions. The whole buffer is scanned as latin1 and
 * `#xx` name escapes are decoded first, because "/Java#53cript" is the same name to a PDF reader.
 *
 * This is a deliberately blunt filter, not a sandbox: it cannot see inside compressed object
 * streams, so it narrows what an admin can accidentally publish rather than defending against a
 * determined attacker who already holds the pass key.
 */
export function pdfHasActiveContent(bytes: Uint8Array): boolean {
  const raw = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  const text = raw.includes("#") ? raw.replace(/#([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))) : raw;
  return SCRIPT_MARKERS.test(text) || (OPEN_ACTION.test(text) && ADDITIONAL_ACTIONS.test(text));
}

/* ------------------------------------------------------------------ *
 * inspectUpload                                                       *
 * ------------------------------------------------------------------ */

function megabytes(bytes: number): string {
  const value = Math.round((bytes / 1_000_000) * 10) / 10;
  return `${value} MB`;
}

const rejected = (code: UploadErrorCode, error: string): InspectResult => ({ ok: false, error, code });

/**
 * Validates one uploaded file. Order matters and is fail-closed: empty and oversize first (cheap),
 * then what the bytes are, then whether the name and declared type agree, then active content.
 */
export function inspectUpload(
  input: { name: string; declaredType?: string; bytes: Uint8Array },
  role: FileRole,
  limits: { maxBytes?: number } = {},
): InspectResult {
  const { bytes } = input;
  if (bytes.byteLength === 0) return rejected("empty", "The file is empty.");

  const maxBytes = limits.maxBytes ?? (role === "photo" ? MAX_PHOTO_BYTES : MAX_PRIMARY_BYTES);
  if (bytes.byteLength > maxBytes) {
    return rejected("too_large", `The file is ${megabytes(bytes.byteLength)}; the limit is ${megabytes(maxBytes)}.`);
  }

  const kinds = sniffKinds(bytes);
  if (kinds.length === 0) {
    return rejected(
      "unsupported",
      role === "photo" ? "Photos must be PNG, JPEG or WEBP images." : "Upload a PDF, PNG, JPEG or WEBP file.",
    );
  }
  if (kinds.length > 1) {
    return rejected("mismatch", "The file looks like more than one format at once, so it cannot be accepted.");
  }

  const kind = kinds[0];
  const info = KINDS[kind];
  if (role === "photo" && kind === "pdf") return rejected("unsupported", "Photos must be PNG, JPEG or WEBP images.");

  const extension = extensionOf(input.name);
  if (extension && !info.extensions.includes(extension)) {
    return rejected("mismatch", `The file is named .${extension} but its contents are a ${info.label}. Rename it or choose the right file.`);
  }

  const declared = (input.declaredType ?? "").split(";")[0].trim().toLowerCase();
  const normalizedDeclared = MIME_ALIASES[declared] ?? declared;
  if (!UNSPECIFIED_TYPES.has(normalizedDeclared) && normalizedDeclared !== info.mime) {
    return rejected("mismatch", `The browser reported ${declared} but the contents are a ${info.label}.`);
  }

  if (kind === "pdf" && pdfHasActiveContent(bytes)) {
    return rejected(
      "active_content",
      "This PDF contains scripts, launch actions or embedded files, which are not accepted. Export a flattened copy (for example, Print to PDF) and upload that.",
    );
  }

  const copy = Buffer.from(bytes);
  return {
    ok: true,
    file: {
      filename: sanitizeFilename(input.name, extension ? extension : info.canonical),
      mimeType: info.mime,
      sizeBytes: copy.length,
      sha256: createHash("sha256").update(copy).digest("hex"),
      bytes: copy,
    },
  };
}
