import { UNTRUSTED_CLIENT } from "./clientIp";

/**
 * Cloudflare Turnstile verification for the Pulse write routes.
 *
 * Stricter than the contact form's verifier in app/api/contact/route.ts, which
 * is left unchanged: that one passes every request when no secret is set unless
 * a flag says otherwise, and binds all tokens to one global action.
 *
 * Here:
 *  - In a production runtime verification is always required. No variable can
 *    switch it off, so a development bypass cannot ship.
 *  - Required but unconfigured (no secret, or no expected hostname in
 *    production) fails closed as TURNSTILE_UNAVAILABLE.
 *  - The token must be for this route's own action and the configured host.
 *  - Cloudflare refuses a token it has already redeemed; that and an expired
 *    token both come back as "timeout-or-duplicate" and map to
 *    TURNSTILE_EXPIRED, so a replayed token cannot be used twice.
 *  - The secret is read from the environment on the server only and is never
 *    logged; Cloudflare's error codes are logged, the token is not.
 *
 * Outside production, verification is required whenever a secret is
 * configured, and can be skipped only with PULSE_REQUIRE_TURNSTILE=false.
 */

export type PulseTurnstileAction = "pulse_save" | "pulse_email";

export type TurnstileFailure = "TURNSTILE_REQUIRED" | "TURNSTILE_EXPIRED" | "TURNSTILE_INVALID" | "TURNSTILE_UNAVAILABLE";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TIMEOUT_MS = 5_000;
const MAX_TOKEN_LENGTH = 2_048;

interface SiteverifyResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export function isPulseTurnstileRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.PULSE_REQUIRE_TURNSTILE === "false") return false;
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyPulseTurnstile(
  token: string,
  context: { action: PulseTurnstileAction; ip: string; requestId: string }
): Promise<TurnstileFailure | null> {
  if (!isPulseTurnstileRequired()) return null;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
  if (!secret || (process.env.NODE_ENV === "production" && !expectedHostname)) {
    console.error(`[turnstile][${context.requestId}] required but not configured`, {
      hasSecret: Boolean(secret),
      hasExpectedHostname: Boolean(expectedHostname),
    });
    return "TURNSTILE_UNAVAILABLE";
  }

  if (!token) return "TURNSTILE_REQUIRED";
  if (token.length > MAX_TOKEN_LENGTH) return "TURNSTILE_INVALID";

  const form = new URLSearchParams({ secret, response: token });
  if (context.ip && context.ip !== UNTRUSTED_CLIENT) form.set("remoteip", context.ip);

  let data: SiteverifyResult;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[turnstile][${context.requestId}] siteverify HTTP ${response.status}`);
      return "TURNSTILE_UNAVAILABLE";
    }
    data = (await response.json()) as SiteverifyResult;
  } catch {
    console.error(`[turnstile][${context.requestId}] siteverify unreachable`);
    return "TURNSTILE_UNAVAILABLE";
  }

  if (!data.success) {
    const codes = data["error-codes"] ?? [];
    console.warn(`[turnstile][${context.requestId}] rejected`, { codes });
    return codes.includes("timeout-or-duplicate") ? "TURNSTILE_EXPIRED" : "TURNSTILE_INVALID";
  }

  if (expectedHostname && data.hostname !== expectedHostname) {
    console.warn(`[turnstile][${context.requestId}] hostname mismatch`);
    return "TURNSTILE_INVALID";
  }
  if (data.action !== context.action) {
    console.warn(`[turnstile][${context.requestId}] action mismatch`, { expected: context.action });
    return "TURNSTILE_INVALID";
  }

  return null;
}

/** The token from a request body, under either accepted field name. */
export function readTurnstileToken(body: Record<string, unknown>): string {
  const value = body.turnstileToken ?? body["cf-turnstile-response"];
  return typeof value === "string" ? value.trim() : "";
}
