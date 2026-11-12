import { logAdminEvent } from "@/lib/admin/audit";
import { clearSessionCookie, getRequestActor, getRequestSession } from "@/lib/admin/auth";
import { isAdminEnabled } from "@/lib/admin/config";
import {
  ApiError,
  apiSuccess,
  assertSameOrigin,
  methodNotAllowedHandler,
  optionsHandler,
  withRouteErrorHandling,
} from "@/lib/api/response";

export const POST = withRouteErrorHandling("admin-logout", async (request) => {
  if (!isAdminEnabled()) throw new ApiError("NOT_FOUND");

  // A cross-site page must not be able to sign the admin out.
  assertSameOrigin(request);

  // Read before clearing, so the audit trail only records sign-outs of real sessions.
  const session = await getRequestSession(request);

  // The cookie is cleared even when the session was already invalid or expired: "log out" must
  // always leave the browser with no cookie, whatever state it was in.
  const response = apiSuccess();
  clearSessionCookie(response);

  if (session) await logAdminEvent({ action: "logout", actor: getRequestActor(request) });
  return response;
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const PUT = methodNotAllowedHandler(["POST"]);
export const PATCH = methodNotAllowedHandler(["POST"]);
export const DELETE = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
