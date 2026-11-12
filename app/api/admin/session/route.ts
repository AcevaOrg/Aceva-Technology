import { getRequestSession } from "@/lib/admin/auth";
import { isAdminEnabled } from "@/lib/admin/config";
import {
  ApiError,
  apiSuccess,
  methodNotAllowedHandler,
  optionsHandler,
  withRouteErrorHandling,
} from "@/lib/api/response";

/**
 * Lets the login page and the console shell ask "am I signed in?" without provoking a 401. An
 * anonymous caller gets a normal 200 with `authenticated: false`; only a disabled console answers
 * differently (404), like every other /api/admin URL.
 */
export const GET = withRouteErrorHandling("admin-session", async (request) => {
  if (!isAdminEnabled()) throw new ApiError("NOT_FOUND");

  const session = await getRequestSession(request);
  return apiSuccess(session ? { authenticated: true, expiresAt: session.expiresAt } : { authenticated: false });
});

export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
