import { logAdminEvent } from "@/lib/admin/audit";
import { getRequestActor, hashIp, sanitizeNextPath, setSessionCookie } from "@/lib/admin/auth";
import { isAdminEnabled, isAdminRequestHostAllowed } from "@/lib/admin/config";
import { verifyPasskey } from "@/lib/admin/passkey";
import { createSessionToken } from "@/lib/admin/session";
import {
  checkLoginAllowed,
  recordLoginFailure,
  recordLoginSuccess,
  waitAfterLoginFailure,
} from "@/lib/admin/throttle";
import {
  ApiError,
  apiSuccess,
  assertJsonContentType,
  assertSameOrigin,
  methodNotAllowedHandler,
  optionsHandler,
  readJsonObjectBody,
  withRouteErrorHandling,
} from "@/lib/api/response";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/** { passkey, next? } is a few dozen bytes; anything near this size is not a login. */
const MAX_BODY_BYTES = 2_048;

const LOCKED_MESSAGE = "Too many sign-in attempts. Please wait before trying again.";
// One message for every rejection: it must not hint whether the key was short, long or close.
const REJECTED_MESSAGE = "That pass key was not accepted.";

export const POST = withRouteErrorHandling("admin-login", async (request) => {
  // 1. A disabled console does not exist: same 404 whatever the request looks like. A host the console is
  //    not allowed on gets the same answer (the proxy checks too; this is defence in depth).
  if (!isAdminEnabled() || !isAdminRequestHostAllowed(request.headers)) throw new ApiError("NOT_FOUND");

  // 2. Cheap in-process limiter first, before any parsing or database work.
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit("admin-login", ip);
  if (!rateLimit.allowed) {
    throw new ApiError("RATE_LIMITED", { retryAfter: rateLimit.retryAfter, message: LOCKED_MESSAGE }, { scope: "admin-login" });
  }

  // 3. Same origin, JSON, and a body small enough to be a login.
  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });

  // 4. Persistent lockout: holds across serverless instances and cold starts.
  const ipHash = hashIp(ip);
  const gate = await checkLoginAllowed(ipHash);
  if (!gate.allowed) {
    throw new ApiError("RATE_LIMITED", { retryAfter: gate.retryAfter, message: LOCKED_MESSAGE }, { scope: "admin-lockout" });
  }

  // 5. The pass key.
  if (!(await verifyPasskey(body.passkey))) {
    const outcome = await recordLoginFailure(ipHash);
    // The audit write runs alongside the delay so it adds nothing to the response time.
    await Promise.all([
      logAdminEvent({
        action: outcome.locked ? "login.locked" : "login.failure",
        actor: getRequestActor(request),
        detail: outcome.locked ? { retryAfter: outcome.retryAfter } : undefined,
      }),
      waitAfterLoginFailure(),
    ]);
    throw new ApiError("UNAUTHENTICATED", { message: REJECTED_MESSAGE }, { scope: "admin-login", locked: outcome.locked });
  }

  // 6. Success: clear the failure record, issue the cookie, audit.
  await recordLoginSuccess(ipHash);
  const token = await createSessionToken();
  const response = apiSuccess({ next: sanitizeNextPath(body.next) });
  setSessionCookie(response, token);
  await logAdminEvent({ action: "login.success", actor: getRequestActor(request) });
  return response;
});

// Proper 405s (with a JSON body) instead of Next.js's empty default.
export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const PUT = methodNotAllowedHandler(["POST"]);
export const PATCH = methodNotAllowedHandler(["POST"]);
export const DELETE = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
