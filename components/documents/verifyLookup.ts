import { hashIp } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import type { PublicDocument } from "@/lib/documents/public";
import { lookupVerification } from "@/lib/documents/store";
import type { VerificationState } from "@/lib/documents/types";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * One public verification lookup, shared by the /verify/[code] page and GET /api/verify/[code] so
 * the two can never disagree about rate limiting, logging or what "unavailable" means.
 * Server only.
 */

export type VerifyOutcome =
  | { kind: "result"; state: VerificationState; document: PublicDocument | null; checkedAt: string }
  /** The caller has used up this minute's lookups. */
  | { kind: "rate_limited"; retryAfter: number }
  /** No database, or it failed. Deliberately not "not found": an outage must never read as a verdict. */
  | { kind: "unavailable" };

/**
 * Counts one lookup against the caller's budget, then asks the registry.
 *
 * The rate limit is charged before the code is even normalised, so a script cannot probe for free
 * with malformed input. The address is stored only as a keyed hash (`hashIp`), never raw.
 */
export async function runVerifyLookup(code: string, ip: string): Promise<VerifyOutcome> {
  const limit = checkRateLimit("verify-lookup", ip);
  if (!limit.allowed) return { kind: "rate_limited", retryAfter: Math.max(1, limit.retryAfter) };

  if (!isDatabaseConfigured()) return { kind: "unavailable" };

  try {
    const { state, document } = await lookupVerification(code, { ipHash: hashIp(ip) });
    return { kind: "result", state, document, checkedAt: new Date().toISOString() };
  } catch (error) {
    // The cause can carry connection detail, so only its class is logged.
    console.error("[verify] lookup failed", error instanceof Error ? error.name : typeof error);
    return { kind: "unavailable" };
  }
}
