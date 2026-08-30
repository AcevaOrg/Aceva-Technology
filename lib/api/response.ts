import { NextResponse } from "next/server";
import {
  API_ERROR_MESSAGES,
  RETRYABLE_API_ERROR_CODES,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiFieldErrors,
} from "./errorCodes";

/**
 * Server-side construction of the canonical API envelope defined in
 * `./errorCodes`. Route handlers build every response through this module so
 * that status codes, headers and the body shape stay consistent, and so that no
 * raw error can reach a client.
 */

/** The status each code is served with. One code, one status, everywhere. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  METHOD_NOT_ALLOWED: 405,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_JSON: 400,
  VALIDATION_FAILED: 400,
  FORBIDDEN_ORIGIN: 403,
  RATE_LIMITED: 429,
  SPAM_REJECTED: 400,
  DISPOSABLE_EMAIL: 400,
  // A missing or stale token is a correctable client mistake; a token the
  // verifier actively rejected is a failed authorization, hence 403.
  TURNSTILE_REQUIRED: 400,
  TURNSTILE_EXPIRED: 400,
  TURNSTILE_INVALID: 403,
  // Cloudflare being unreachable is our outage to own, not the visitor's fault.
  TURNSTILE_UNAVAILABLE: 503,
  SERVICE_UNAVAILABLE: 503,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorOptions {
  /** Overrides the default copy. Must stay display-safe. */
  message?: string;
  /** Field flags for VALIDATION_FAILED. */
  errors?: ApiFieldErrors;
  /** Sets both the body field and the Retry-After header. */
  retryAfterSeconds?: number;
  /** Extra response headers, e.g. `Allow` on a 405. */
  headers?: Record<string, string>;
  /** Overrides the status mapped from the code. Use sparingly. */
  status?: number;
}

/** Correlates a client-visible response with the server log that explains it. */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/**
 * A failure a route can throw from anywhere in its call stack instead of
 * threading early returns through every helper. `withRouteErrorHandling`
 * converts it into the canonical envelope.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly options: ApiErrorOptions;
  /** Internal-only detail for the server log. Never serialised to a client. */
  readonly logContext: Record<string, unknown>;

  constructor(code: ApiErrorCode, options: ApiErrorOptions = {}, logContext: Record<string, unknown> = {}) {
    super(options.message ?? API_ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.options = options;
    this.logContext = logContext;
  }
}

/** Builds the canonical error envelope. */
export function apiError(code: ApiErrorCode, requestId: string, options: ApiErrorOptions = {}): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    ok: false,
    code,
    message: options.message ?? API_ERROR_MESSAGES[code],
    retryable: RETRYABLE_API_ERROR_CODES.has(code),
    requestId,
  };
  if (options.errors && Object.keys(options.errors).length > 0) body.errors = options.errors;
  if (typeof options.retryAfterSeconds === "number") body.retryAfterSeconds = options.retryAfterSeconds;

  const headers: Record<string, string> = {
    // An error must never be served from a shared cache to the next visitor.
    "Cache-Control": "no-store",
    ...options.headers,
  };
  if (typeof options.retryAfterSeconds === "number") {
    headers["Retry-After"] = String(Math.max(0, Math.ceil(options.retryAfterSeconds)));
  }

  return NextResponse.json(body, { status: options.status ?? API_ERROR_STATUS[code], headers });
}

/** Builds the canonical success envelope: `ok: true` plus the route's payload. */
export function apiSuccess<T extends object>(
  payload: T = {} as T,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
  return NextResponse.json(
    { ok: true, ...payload },
    {
      status: init.status ?? 200,
      headers: { "Cache-Control": "no-store", ...init.headers },
    },
  );
}

/** Serialises an unknown throwable for the server log only. */
function describeThrowable(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: typeof error, message: String(error) };
}

/**
 * Logs a failure with enough detail to debug it. Everything here stays on the
 * server; the matching client response carries only `requestId`.
 */
export function logRouteError(
  scope: string,
  requestId: string,
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  console.error(`[${scope}][${requestId}] request failed`, {
    ...context,
    ...describeThrowable(error),
  });
}

/**
 * Wraps a route handler so that no throw can ever escape as a framework error
 * page. Anything unrecognised becomes a controlled 500 whose body names only a
 * request id, while the stack is written to the server log under that same id.
 */
export function withRouteErrorHandling(
  scope: string,
  handler: (request: Request, requestId: string) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    const requestId = newRequestId();
    try {
      return await handler(request, requestId);
    } catch (error) {
      if (error instanceof ApiError) {
        // Expected, already-classified failure: log the reason, not a stack.
        console.warn(`[${scope}][${requestId}] ${error.code}`, error.logContext);
        return apiError(error.code, requestId, error.options);
      }
      logRouteError(scope, requestId, error);
      return apiError("INTERNAL_ERROR", requestId);
    }
  };
}

/**
 * A 405 handler for the methods a route does not implement.
 *
 * Without these exports Next.js answers an unsupported method with an empty
 * body, which a client cannot parse as JSON — so a Postman `GET` on a POST-only
 * endpoint surfaces as an unexplained parse failure rather than a clear 405.
 */
export function methodNotAllowedHandler(allowed: readonly string[]): (request: Request) => NextResponse {
  const allow = [...allowed, "OPTIONS"].join(", ");
  return (request: Request) => {
    const requestId = newRequestId();
    const response = apiError("METHOD_NOT_ALLOWED", requestId, {
      message: `This endpoint accepts ${allowed.join(", ")}.`,
      headers: { Allow: allow },
    });
    // A HEAD response must not carry a body, but must keep the same headers.
    if (request.method === "HEAD") {
      return new NextResponse(null, { status: response.status, headers: response.headers });
    }
    return response;
  };
}

/** A 204 preflight/discovery response advertising the supported methods. */
export function optionsHandler(allowed: readonly string[]): () => NextResponse {
  const allow = [...allowed, "OPTIONS"].join(", ");
  return () => new NextResponse(null, { status: 204, headers: { Allow: allow, "Cache-Control": "no-store" } });
}

/**
 * Rejects a cross-origin submission.
 *
 * Compares against the origin that actually received the request rather than a
 * configured canonical URL, because the latter rejects valid preview
 * deployments and www/apex aliases.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser clients omit it; other guards still apply.
  try {
    if (new URL(origin).origin !== new URL(request.url).origin) {
      throw new ApiError("FORBIDDEN_ORIGIN", {}, { origin });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("FORBIDDEN_ORIGIN", {}, { origin, reason: "unparsable-origin" });
  }
}

/** Rejects anything that is not a JSON request. */
export function assertJsonContentType(request: Request): void {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(
      "UNSUPPORTED_MEDIA_TYPE",
      { message: "Content-Type must be application/json." },
      { contentType: contentType || "(none)" },
    );
  }
}

/**
 * Reads at most `maxBytes` of the request body.
 *
 * Streaming with a running total is what makes the limit real: `Content-Length`
 * is client-supplied and may be absent, spoofed, or non-numeric, so trusting it
 * would let an oversized body be buffered in full before any check ran.
 */
async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError("PAYLOAD_TOO_LARGE", {}, { declaredBytes: declared, maxBytes });
  }

  const body = request.body;
  if (!body) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ApiError("PAYLOAD_TOO_LARGE", {}, { maxBytes });
    }
    return text;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ApiError("PAYLOAD_TOO_LARGE", {}, { receivedBytes: total, maxBytes });
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export interface JsonBodyOptions {
  maxBytes: number;
  /** Set false for endpoints that historically accepted any Content-Type. */
  requireJsonContentType?: boolean;
}

/**
 * Reads and parses a JSON request body, guaranteeing a plain object.
 *
 * Returning a plain object rather than `unknown` is the point: `JSON.parse`
 * happily yields `null`, `"a string"` or `[1,2]`, each of which crashes the
 * destructuring that route handlers naturally write.
 */
export async function readJsonObjectBody(
  request: Request,
  { maxBytes, requireJsonContentType = true }: JsonBodyOptions,
): Promise<Record<string, unknown>> {
  if (requireJsonContentType) assertJsonContentType(request);

  const raw = await readBoundedText(request, maxBytes);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError("INVALID_JSON", { message: "Request body must be valid JSON." }, { reason: "parse-failed" });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(
      "INVALID_JSON",
      { message: "Request body must be a JSON object." },
      { reason: "not-an-object", received: Array.isArray(parsed) ? "array" : parsed === null ? "null" : typeof parsed },
    );
  }

  return parsed as Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Field readers — coerce untrusted JSON into the types routes expect. *
 * ------------------------------------------------------------------ */

/** Reads a string field, returning "" for any non-string. Trims and caps length. */
export function readString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/** Reads a value constrained to a fixed set, falling back to `fallback`. */
export function readEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Reads an array of strings, dropping non-strings and capping both dimensions. */
export function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    items.push(trimmed.slice(0, maxLength));
    if (items.length >= maxItems) break;
  }
  return items;
}

/**
 * Strips CR/LF so a submitted value cannot inject extra headers when it is
 * interpolated into an outgoing email subject.
 */
export function sanitizeHeaderValue(value: string, maxLength = 200): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}
