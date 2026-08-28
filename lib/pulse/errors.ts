/**
 * PULSE Error Classification & Provider Diagnostic Logger
 */

export type ProviderErrorCode =
  | "INVALID_REQUEST" // 400
  | "UNAUTHORIZED" // 401
  | "FORBIDDEN" // 403
  | "TIMEOUT" // 408 / Timeout
  | "RATE_LIMIT_QUOTA" // 429
  | "SERVER_ERROR" // 500, 502, 503, 504
  | "NETWORK_ERROR" // Fetch / Connection abort
  | "MALFORMED_RESPONSE" // JSON parse error or missing choices
  | "CONFIGURATION_ERROR" // Missing API key / model
  | "UNKNOWN_ERROR";

export interface ProviderErrorClassification {
  code: ProviderErrorCode;
  status?: number;
  message: string;
  isRetryable: boolean;
  shouldFallback: boolean;
}

export function classifyProviderError(
  error: unknown,
  statusCode?: number
): ProviderErrorClassification {
  let status = statusCode;
  let rawMessage = "";

  if (error && typeof error === "object") {
    if ("status" in error && typeof (error as { status: unknown }).status === "number") {
      status = (error as { status: number }).status;
    }
    if ("message" in error && typeof (error as { message: unknown }).message === "string") {
      rawMessage = (error as { message: string }).message;
    }
  } else if (typeof error === "string") {
    rawMessage = error;
  }

  // Timeout / Abort detection
  if (rawMessage.toLowerCase().includes("timeout") || rawMessage.toLowerCase().includes("aborted")) {
    return {
      code: "TIMEOUT",
      status: status || 408,
      message: "LLM provider request timed out",
      isRetryable: false,
      shouldFallback: true,
    };
  }

  // Classification by HTTP Status Code
  if (status === 400) {
    return {
      code: "INVALID_REQUEST",
      status: 400,
      message: "Invalid prompt payload structure",
      isRetryable: false,
      shouldFallback: false,
    };
  }

  if (status === 401) {
    return {
      code: "UNAUTHORIZED",
      status: 401,
      message: "Provider API key authentication failed",
      isRetryable: false,
      shouldFallback: true,
    };
  }

  if (status === 403) {
    return {
      code: "FORBIDDEN",
      status: 403,
      message: "Provider account or region restricted",
      isRetryable: false,
      shouldFallback: true,
    };
  }

  if (status === 429 || rawMessage.toLowerCase().includes("rate limit") || rawMessage.toLowerCase().includes("quota")) {
    return {
      code: "RATE_LIMIT_QUOTA",
      status: status || 429,
      message: "Provider rate limit or token quota exceeded",
      isRetryable: false,
      shouldFallback: true,
    };
  }

  if (status && status >= 500 && status <= 599) {
    return {
      code: "SERVER_ERROR",
      status,
      message: `Provider server error (HTTP ${status})`,
      isRetryable: true,
      shouldFallback: true,
    };
  }

  if (rawMessage.toLowerCase().includes("fetch failed") || rawMessage.toLowerCase().includes("network")) {
    return {
      code: "NETWORK_ERROR",
      status: 503,
      message: "Network connectivity issue connecting to provider",
      isRetryable: true,
      shouldFallback: true,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    status: status || 500,
    message: rawMessage || "An unknown provider error occurred",
    isRetryable: false,
    shouldFallback: true,
  };
}

/**
 * Safe Diagnostic Logger (Ensures zero API keys or secrets are ever logged)
 */
export function logPulseDiagnostic(
  requestId: string,
  event: string,
  details: Record<string, unknown> = {}
): void {
  const sanitizedDetails: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(details)) {
    if (
      key.toLowerCase().includes("key") ||
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("auth") ||
      key.toLowerCase().includes("secret")
    ) {
      sanitizedDetails[key] = "[REDACTED]";
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitizedDetails[key] = value;
    }
  }

  const detailString = Object.entries(sanitizedDetails)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");

  console.log(`[PULSE][req=${requestId}] ${event}${detailString ? ` ${detailString}` : ""}`);
}
