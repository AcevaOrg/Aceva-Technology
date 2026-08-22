import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function deniedResponse() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" },
  });
}

export function proxy(request: NextRequest) {
  const username = process.env.MOBILE_PREVIEW_USERNAME;
  const password = process.env.MOBILE_PREVIEW_PASSWORD;
  if (!username || !password) return deniedResponse();

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const [providedUser, providedPassword] = atob(authorization.slice(6)).split(":", 2);
      if (providedUser === username && providedPassword === password) {
        const response = NextResponse.next();
        response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
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
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "private, no-store",
    },
  });
}

export const config = { matcher: "/mobile/:path*" };
