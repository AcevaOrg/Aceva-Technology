/**
 * The canonical API error contract, shared by the route handlers and the browser.
 *
 * This module is deliberately isomorphic: the client imports it to turn a `code`
 * into a user-facing message, so the frontend branches on a stable identifier
 * instead of pattern-matching on prose that may be reworded at any time.
 *
 * Nothing here may import from "next/server" — doing so pulls server-only code
 * into the client bundle. Response construction lives in `lib/api/response.ts`.
 */

export const API_ERROR_CODES = [
  // Malformed or unsupported request
  "METHOD_NOT_ALLOWED",
  "UNSUPPORTED_MEDIA_TYPE",
  "PAYLOAD_TOO_LARGE",
  "INVALID_JSON",
  "VALIDATION_FAILED",
  "FORBIDDEN_ORIGIN",
  // Abuse controls
  "RATE_LIMITED",
  "SPAM_REJECTED",
  "DISPOSABLE_EMAIL",
  // Cloudflare Turnstile
  "TURNSTILE_REQUIRED",
  "TURNSTILE_EXPIRED",
  "TURNSTILE_INVALID",
  "TURNSTILE_UNAVAILABLE",
  // Service and dependency failures
  "SERVICE_UNAVAILABLE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * Field-level validation flags. Keyed by form field name; `true` means invalid.
 * Only ever describes fields the client itself submitted, never server state.
 */
export type ApiFieldErrors = Record<string, boolean>;

/** The body every failing endpoint returns. No other error shape is emitted. */
export interface ApiErrorBody {
  ok: false;
  /** Stable identifier the frontend branches on. Never reworded. */
  code: ApiErrorCode;
  /** Display-safe copy. Contains no stack traces, provider text or config. */
  message: string;
  /** Present only for VALIDATION_FAILED. */
  errors?: ApiFieldErrors;
  /** `true` when retrying the identical request may succeed. */
  retryable: boolean;
  /** Correlates this response with the server log line that explains it. */
  requestId: string;
  /** Present on RATE_LIMITED; mirrors the Retry-After header. */
  retryAfterSeconds?: number;
}

/** The body every succeeding endpoint returns, plus its own payload fields. */
export type ApiSuccessBody<T extends object = Record<string, never>> = { ok: true } & T;

/**
 * Default display copy per code. A route may override `message` with something
 * more specific (a validation summary, a rate-limit countdown), but it must
 * never substitute an internal detail — that is the whole point of this table.
 */
export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  // These are shown only to developers/API clients (Postman etc.), not end users.
  METHOD_NOT_ALLOWED: "This action is not supported here.",
  UNSUPPORTED_MEDIA_TYPE: "Your request could not be read. Please try again.",
  PAYLOAD_TOO_LARGE: "Your message is too long. Please shorten it and try again.",
  INVALID_JSON: "Your request could not be read. Please try again.",
  // Shown to the user when they submit the contact form with missing or incorrect fields.
  VALIDATION_FAILED: "Please check your details — some required fields are missing or incorrect.",
  // Shown when the request comes from outside the website (blocked by security).
  FORBIDDEN_ORIGIN: "This request was blocked. Please use the form on our website.",
  // Shown when someone submits too many times in a short period.
  RATE_LIMITED: "You have sent too many messages. Please wait a minute and try again.",
  // Shown when the message looks automated or spammy.
  SPAM_REJECTED:
    "We were unable to process your message. Please email us directly at contact@acevatech.com.",
  // Shown when a disposable/throwaway email address is detected.
  DISPOSABLE_EMAIL: "Please use your real work email address so we can reply to you.",
  // Shown when the human verification check has not been completed yet.
  TURNSTILE_REQUIRED: "Please complete the human verification check before sending.",
  // Shown when the verification check timed out (user took too long).
  TURNSTILE_EXPIRED: "Your verification timed out. Please complete the check again and re-submit.",
  // Shown when the verification check failed (fake or tampered token).
  TURNSTILE_INVALID: "We could not verify your submission. Please complete the check again.",
  // Shown when Cloudflare's verification service is temporarily down.
  TURNSTILE_UNAVAILABLE:
    "Verification is temporarily unavailable. Please try again in a moment.",
  // Shown when the contact form service itself is down.
  SERVICE_UNAVAILABLE:
    "Our contact form is temporarily unavailable. Please email us directly at contact@acevatech.com.",
  // Shown when the email could not be delivered due to a third-party issue.
  UPSTREAM_ERROR:
    "We were unable to send your message right now. Please email us directly at contact@acevatech.com.",
  // Shown when an unexpected error occurs on our side.
  INTERNAL_ERROR:
    "Something went wrong on our end. Please try again, or email us at contact@acevatech.com.",
};

/**
 * Codes where resending the identical request may succeed. The inverse set is
 * "the caller must change something first", which is what lets the UI decide
 * between offering a retry button and focusing the offending field.
 */
export const RETRYABLE_API_ERROR_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "RATE_LIMITED",
  "TURNSTILE_EXPIRED",
  "TURNSTILE_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "UPSTREAM_ERROR",
  "INTERNAL_ERROR",
]);

/** Codes raised by the Turnstile flow — the cue to reset the widget. */
export const TURNSTILE_ERROR_CODES: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  "TURNSTILE_REQUIRED",
  "TURNSTILE_EXPIRED",
  "TURNSTILE_INVALID",
  "TURNSTILE_UNAVAILABLE",
]);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && (API_ERROR_CODES as readonly string[]).includes(value);
}

/** Narrows an arbitrary parsed response body to the canonical error envelope. */
export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return body.ok === false && isApiErrorCode(body.code) && typeof body.message === "string";
}

/** `true` when the frontend should reset its Turnstile widget before retrying. */
export function shouldResetTurnstile(value: unknown): boolean {
  return isApiErrorBody(value) && TURNSTILE_ERROR_CODES.has(value.code);
}

/**
 * Resolves the string to show a user from whatever came back.
 *
 * Callers reach this with anything: the canonical envelope, a legacy body, or
 * `null` because `res.json()` threw on an HTML error page from a proxy. Every
 * branch yields displayable copy, so the UI never renders `undefined` and never
 * renders a raw parse error.
 */
export function resolveApiErrorMessage(value: unknown, fallback = API_ERROR_MESSAGES.INTERNAL_ERROR): string {
  if (isApiErrorBody(value)) return value.message;
  if (value && typeof value === "object") {
    const body = value as Record<string, unknown>;
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  }
  return fallback;
}

/** Reads the field-error map, tolerating bodies that omit or malform it. */
export function resolveApiFieldErrors(value: unknown): ApiFieldErrors {
  if (!value || typeof value !== "object") return {};
  const raw = (value as Record<string, unknown>).errors;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const fields: ApiFieldErrors = {};
  for (const [key, flag] of Object.entries(raw as Record<string, unknown>)) {
    if (flag === true) fields[key] = true;
  }
  return fields;
}
