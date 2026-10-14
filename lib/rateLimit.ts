interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute

/**
 * Per-endpoint budgets.
 *
 * Each scope gets its own bucket. Previously the chat endpoint and the contact
 * form both called `checkRateLimit(ip)` with the bare IP, so they shared one
 * allowance of five a minute: a visitor who sent five chat messages could not
 * then submit the contact form, and six wizard steps exhausted the budget on
 * their own. The chatbot is inherently chattier than a form, hence 20.
 */
export const RATE_LIMIT_RULES = {
  chat: 20,
  contact: 5,
  "pulse-save-direction": 5,
  // Each send is an outbound email, so this is deliberately tight.
  "pulse-email-blueprint": 3,
} as const;

export type RateLimitScope = keyof typeof RATE_LIMIT_RULES;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** Seconds until the window resets. 0 while the caller is still under budget. */
  retryAfter: number;
}

export function getClientIp(request: Request): string {
  // Check common headers for the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  // Fallback - in development this might be ::1 or 127.0.0.1
  return "unknown";
}

/**
 * Counts one request against `scope`'s budget for `ip`.
 *
 * The bucket key is scoped, so exhausting one endpoint never blocks another.
 */
export function checkRateLimit(scope: RateLimitScope, ip: string): RateLimitResult {
  const limit = RATE_LIMIT_RULES[scope];
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt, retryAfter: 0 };
}

// Cleanup old entries periodically (run occasionally)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/** Clears every bucket. For tests. */
export function resetRateLimitStore(): void {
  store.clear();
}
