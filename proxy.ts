import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ADMIN_LOGIN_PATH,
  getAdminCookieName,
  isAdminEnabled,
  isAdminRequestHostAllowed,
  isCanonicalAdminPath,
  isOpenAdminPath,
  sanitizeNextPath,
} from "@/lib/admin/config";
import { verifySessionToken } from "@/lib/admin/session";
import { apiError, newRequestId } from "@/lib/api/response";

const ROBOTS_HEADER = "noindex, nofollow, noarchive";

function deniedResponse() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "X-Robots-Tag": ROBOTS_HEADER },
  });
}

/* ------------------------------------------------------------------ *
 * /mobile — HTTP Basic auth preview gate (behaviour unchanged)         *
 * ------------------------------------------------------------------ */

function gateMobilePreview(request: NextRequest) {
  const username = process.env.MOBILE_PREVIEW_USERNAME;
  const password = process.env.MOBILE_PREVIEW_PASSWORD;
  if (!username || !password) return deniedResponse();

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const [providedUser, providedPassword] = atob(authorization.slice(6)).split(":", 2);
      if (providedUser === username && providedPassword === password) {
        const response = NextResponse.next();
        response.headers.set("X-Robots-Tag", ROBOTS_HEADER);
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    } catch {
      // Fall through to the authentication challenge.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="ACEVA mobile preview", charset="UTF-8"',
      "X-Robots-Tag": ROBOTS_HEADER,
      "Cache-Control": "private, no-store",
    },
  });
}

/* ------------------------------------------------------------------ *
 * /admin and /api/admin — optimistic session gate                      *
 * ------------------------------------------------------------------ */

/**
 * Every response from the admin branches is private and unindexable, including the pass-through
 * for signed-in requests, so no CDN or crawler ever keeps a copy of an admin page. `no-referrer`
 * means that following any link out of the console never tells the destination where it came from.
 */
function markPrivate<T extends NextResponse>(response: T): T {
  response.headers.set("X-Robots-Tag", ROBOTS_HEADER);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function isApiPath(pathname: string): boolean {
  return pathname.toLowerCase().startsWith("/api/");
}

/**
 * This gate only decides "is there a valid session cookie?". It is deliberately not the last line
 * of defence: pages and handlers re-check with requireAdminPage / requireAdminRequest.
 */
async function gateAdmin(request: NextRequest) {
  // A console nobody configured, or one asked for on a host it is not meant to answer on (a
  // preview or alias URL), does not exist. Both reasons give the identical response, so the answer
  // never says which of them applied.
  if (!isAdminEnabled() || !isAdminRequestHostAllowed(request.headers)) return markPrivate(deniedResponse());

  const { pathname, search } = request.nextUrl;

  // The router decodes and trims paths on its own terms while the matcher is a regex over the raw
  // text; any spelling other than the canonical one is where those two could disagree, so it is
  // refused here instead of being judged. This is also the fail-closed answer for a path that is
  // not on the admin surface at all.
  if (!isCanonicalAdminPath(pathname)) return markPrivate(deniedResponse());

  // Exact allow-list (one trailing slash tolerated). Every other canonical path needs a session.
  if (isOpenAdminPath(pathname)) return markPrivate(NextResponse.next());

  const session = await verifySessionToken(request.cookies.get(getAdminCookieName())?.value);
  if (session.valid) return markPrivate(NextResponse.next());

  const method = request.method.toUpperCase();
  const isNavigation = method === "GET" || method === "HEAD";

  // Programmatic callers (and any mutation, including Server Action posts) get a machine-readable
  // 401; a redirect to an HTML login page would be meaningless to them.
  if (isApiPath(pathname) || !isNavigation) {
    return markPrivate(apiError("UNAUTHENTICATED", newRequestId()));
  }

  // `next` is validated by the same function the login route uses, so a hostile path can only
  // ever become "/admin".
  const next = sanitizeNextPath(`${pathname}${search}`);
  const target = new URL(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`, request.url);
  return markPrivate(NextResponse.redirect(target, 307));
}

function isMobilePath(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  return lower === "/mobile" || lower.startsWith("/mobile/");
}

export async function proxy(request: NextRequest) {
  // The matcher below only admits /mobile and the admin surface. Branching on /mobile and sending
  // everything else to the admin gate means a path the matcher normalised differently from the
  // router can still only land on the stricter of the two gates, never on neither.
  if (isMobilePath(request.nextUrl.pathname)) return gateMobilePreview(request);
  return gateAdmin(request);
}

export const config = { matcher: ["/mobile/:path*", "/admin", "/admin/:path*", "/api/admin/:path*"] };
