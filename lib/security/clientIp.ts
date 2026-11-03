/**
 * The client address to rate-limit on, without trusting what a client can set.
 *
 * `lib/rateLimit.ts#getClientIp` takes the first `x-forwarded-for` entry from
 * any request, so outside a trusted proxy a caller picks its own bucket by
 * sending a different header each time (red-team R5: 40 lookups, none limited).
 *
 * On Vercel the edge overwrites `x-forwarded-for` and sets `x-real-ip` to the
 * address it actually saw, and documents that client values are not forwarded,
 * so there they are trustworthy. Anywhere else they are only trusted when the
 * operator says a proxy sets them (`TRUST_PROXY_HEADERS=1`). Otherwise every
 * request shares one bucket: stricter, never looser, and the other dimensions
 * (session, email, reference) still separate legitimate visitors.
 */
export const UNTRUSTED_CLIENT = "untrusted-direct";

export function getTrustedClientIp(request: Request): string {
  const trusted = process.env.VERCEL === "1" || process.env.TRUST_PROXY_HEADERS === "1";
  if (!trusted) return UNTRUSTED_CLIENT;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || UNTRUSTED_CLIENT;
}
