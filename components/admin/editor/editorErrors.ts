import {
  describeApiError,
  isApiErrorBody,
  resolveApiFieldMessages,
  resolveRetryAfterSeconds,
} from "@/lib/api/errorCodes";
import { CATEGORIES, isDocumentCategory } from "@/lib/documents/categories";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  type DocumentCategory,
  type DocumentRecord,
} from "@/lib/documents/types";
import { BASE_KEYS, consentField, groupFields, isDocumentIdLike, type EditorMode } from "./editorModel";

/**
 * How server answers become something the form can show: which input a message belongs to, in what
 * order the inputs appear (so the first problem can be focused), and what a failed request means
 * for the person using it. Pure, so the whole mapping is unit tested.
 */

/* ------------------------------------------------------------------ *
 * Controls                                                            *
 * ------------------------------------------------------------------ */

const BASE_KEY_SET: ReadonlySet<string> = new Set(BASE_KEYS);

/** Ids are prefixed by kind so a base column, a category field and a setting can never share one. */
export const baseDomId = (key: string): string => `ed-b-${key}`;
export const fieldDomId = (key: string): string => `ed-f-${key}`;
export const settingDomId = (key: string): string => `ed-${key}`;

/** The DOM id of the control that edits `key`. */
export function controlDomId(category: DocumentCategory, key: string): string {
  if (BASE_KEY_SET.has(key)) return baseDomId(key);
  if (CATEGORIES[category].fields.some((field) => field.key === key)) return fieldDomId(key);
  return settingDomId(key);
}

/** Parses a response body, returning null for anything that is not JSON (an HTML error page, an empty body). */
export function parseJsonSafely(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export interface ErrorContext {
  mode: EditorMode;
  /** The "Enable QR verification" switch is on screen (verifiable category, no code issued yet). */
  verificationSwitch: boolean;
}

/** Keys of every control on the page, in the order they appear. */
export function errorKeyOrder(category: DocumentCategory, context: ErrorContext): string[] {
  const spec = CATEGORIES[category];
  const keys: string[] = [];
  for (const key of BASE_KEYS) {
    if (!spec.base[key].hidden) keys.push(key);
  }
  for (const group of groupFields(category)) {
    for (const field of group.fields) keys.push(field.key);
  }
  keys.push("primary");
  if (spec.verifiable) keys.push("stamp");
  if (spec.hasPhoto) keys.push("photo");
  const consent = consentField(spec);
  if (consent) keys.push(consent.key);
  keys.push("visibility");
  if (context.mode === "edit") keys.push("status");
  keys.push("allowView", "allowDownload", "featured");
  if (context.verificationSwitch) keys.push("enableVerification");
  return keys;
}

const SETTING_LABELS: Record<string, string> = {
  primary: "Document file",
  stamp: "QR on the file",
  photo: "Photo",
  visibility: "Visibility",
  status: "Publication status",
  allowView: "Allow public view",
  allowDownload: "Allow public download",
  featured: "Feature on the Documents page",
  enableVerification: "QR verification",
};

/** The name a person knows `key` by: the category's own label, not the API's property name. */
export function labelForKey(category: DocumentCategory, key: string): string | null {
  const spec = CATEGORIES[category];
  if (BASE_KEY_SET.has(key)) return spec.base[key as (typeof BASE_KEYS)[number]].label;
  const field = spec.fields.find((candidate) => candidate.key === key);
  if (field) return field.label;
  return SETTING_LABELS[key] ?? null;
}

/* ------------------------------------------------------------------ *
 * Mapping server messages onto controls                               *
 * ------------------------------------------------------------------ */

export interface MappedErrors {
  /** Messages that belong to a control on the page, by control key. */
  fields: Record<string, string>;
  /** Messages with no control to sit beside (form-level problems, hidden fields). */
  general: string[];
  /** Keys of `fields` in on-page order; the first is where focus goes. */
  order: string[];
}

/**
 * Splits `fieldMessages` into inline messages and general ones. The server reports a missing
 * stored file as `file` while upload problems arrive as `primary`: both belong to the same drop zone.
 */
export function mapFieldMessages(
  category: DocumentCategory,
  messages: Record<string, string>,
  context: ErrorContext,
): MappedErrors {
  const rendered = new Set(errorKeyOrder(category, context));
  const fields: Record<string, string> = {};
  const general: string[] = [];

  for (const [rawKey, message] of Object.entries(messages)) {
    if (typeof message !== "string" || message.trim() === "") continue;
    const key = rawKey === "file" ? "primary" : rawKey;
    if (rendered.has(key)) {
      if (!fields[key]) fields[key] = message;
      continue;
    }
    const label = labelForKey(category, key);
    general.push(label ? `${label}: ${message}` : message);
  }

  const order = errorKeyOrder(category, context).filter((key) => fields[key] !== undefined);
  return { fields, general, order };
}

export interface ErrorSummaryEntry {
  key: string;
  label: string;
  message: string;
}

/** One line per problem for the summary at the top of the form. */
export function summariseErrors(category: DocumentCategory, mapped: MappedErrors): ErrorSummaryEntry[] {
  return mapped.order.map((key) => ({
    key,
    label: labelForKey(category, key) ?? key,
    message: mapped.fields[key],
  }));
}

/* ------------------------------------------------------------------ *
 * Reading responses                                                   *
 * ------------------------------------------------------------------ */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A record shape check: enough to trust the fields the editor reads, without re-validating the server. */
export function readDocument(value: unknown): DocumentRecord | null {
  if (!isPlainRecord(value)) return null;
  const { id, category, title, status, visibility, updatedAt, data, files } = value;
  if (!isDocumentIdLike(id)) return null;
  if (!isDocumentCategory(category)) return null;
  if (typeof title !== "string" || typeof updatedAt !== "string") return null;
  if (typeof status !== "string" || !(DOCUMENT_STATUSES as readonly string[]).includes(status)) return null;
  if (typeof visibility !== "string" || !(DOCUMENT_VISIBILITIES as readonly string[]).includes(visibility)) return null;
  if (!isPlainRecord(data) || !Array.isArray(files)) return null;
  return value as unknown as DocumentRecord;
}

export type ApiFailure =
  | { type: "invalid"; fieldMessages: Record<string, string>; message: string }
  | { type: "conflict"; message: string }
  | { type: "rate_limited"; retryAfter: number | undefined; message: string }
  | { type: "signed_out"; message: string }
  | { type: "not_found"; message: string }
  | { type: "too_large"; message: string }
  | { type: "failed"; message: string; retryable: boolean };

const TOO_LARGE_MESSAGE = "The upload is too large for one save. Remove a file or use a smaller one, then try again.";
const SIGNED_OUT_MESSAGE = "Your session has ended. Sign in again, then save. Your edits are still on this page.";
const GENERIC_FAILURE = "That did not work. Please try again.";

/** What a non-2xx answer means. Reads the canonical envelope first and falls back to the status code. */
export function classifyFailure(status: number, body: unknown): ApiFailure {
  if (isApiErrorBody(body)) {
    const message = describeApiError(body, GENERIC_FAILURE);
    switch (body.code) {
      case "VALIDATION_FAILED":
        return { type: "invalid", fieldMessages: resolveApiFieldMessages(body), message };
      case "CONFLICT":
        return { type: "conflict", message };
      case "RATE_LIMITED":
        return { type: "rate_limited", retryAfter: resolveRetryAfterSeconds(body), message };
      case "UNAUTHENTICATED":
        return { type: "signed_out", message: SIGNED_OUT_MESSAGE };
      case "NOT_FOUND":
        return { type: "not_found", message };
      case "PAYLOAD_TOO_LARGE":
        return { type: "too_large", message: TOO_LARGE_MESSAGE };
      default:
        return { type: "failed", message, retryable: body.retryable };
    }
  }

  // No envelope: a platform error page, or a proxy. The status is all there is to go on.
  if (status === 401) return { type: "signed_out", message: SIGNED_OUT_MESSAGE };
  if (status === 404) return { type: "not_found", message: "We could not find that document. It may have been deleted." };
  if (status === 409) return { type: "conflict", message: "This document was changed since you opened it." };
  if (status === 413) return { type: "too_large", message: TOO_LARGE_MESSAGE };
  if (status === 429) return { type: "rate_limited", retryAfter: undefined, message: "Too many requests. Wait a moment, then try again." };
  return { type: "failed", message: GENERIC_FAILURE, retryable: status >= 500 };
}

export type SaveOutcome = { type: "saved"; document: DocumentRecord } | ApiFailure;

/** A create or update answer: either the saved record, or why not. */
export function interpretSaveResponse(status: number, body: unknown): SaveOutcome {
  if (status >= 200 && status < 300 && isPlainRecord(body) && body.ok === true) {
    const document = readDocument(body.document);
    if (document) return { type: "saved", document };
    return {
      type: "failed",
      message: "The document was saved, but the reply was unexpected. Reload the page to see the latest version.",
      retryable: false,
    };
  }
  return classifyFailure(status, body);
}

export type ActionOutcome = { type: "done"; document: DocumentRecord | null } | ApiFailure;

/** An action or delete answer. `document` is null for a delete, or when the server sent none. */
export function interpretActionResponse(status: number, body: unknown): ActionOutcome {
  if (status >= 200 && status < 300 && isPlainRecord(body) && body.ok === true) {
    return { type: "done", document: readDocument(body.document) };
  }
  return classifyFailure(status, body);
}

/** The reference number from a `next-reference` answer, or null when the reply is not usable. */
export function readSuggestion(status: number, body: unknown): string | null {
  if (status < 200 || status >= 300 || !isPlainRecord(body) || body.ok !== true) return null;
  const suggestion = body.suggestion;
  if (typeof suggestion !== "string") return null;
  const trimmed = suggestion.trim();
  // The same ceiling the reference field enforces; anything longer would only fail validation.
  return trimmed.length > 0 && trimmed.length <= 80 ? trimmed : null;
}
