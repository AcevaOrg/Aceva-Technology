import {
  ApiError,
  apiSuccess,
  methodNotAllowedHandler,
  optionsHandler,
  withRouteErrorHandling,
} from "@/lib/api/response";
import { runVerifyLookup } from "@/components/documents/verifyLookup";
import { clientIpFromHeaders } from "@/lib/documents/access";

/**
 * GET /api/verify/[code] → { ok: true, state, document?, checkedAt }
 *
 * For employers and tools that want to check a code programmatically. It answers from the same
 * `PublicDocument` the verify page renders, so it exposes nothing the page does not. A code that is
 * malformed, unknown, private, draft or archived is the same `{ state: "not_found" }` with the same
 * 200 status: the status code must not become an existence oracle.
 *
 * Deliberately no CORS headers (and a bare 204 for OPTIONS): a browser on another site cannot read
 * the answer, so a page elsewhere cannot silently harvest lookups on a visitor's behalf.
 */
export const dynamic = "force-dynamic";

async function lookup(request: Request, params: Promise<{ code: string }>) {
  const { code } = await params;
  const outcome = await runVerifyLookup(code, clientIpFromHeaders(request.headers));

  switch (outcome.kind) {
    case "rate_limited":
      throw new ApiError(
        "RATE_LIMITED",
        { retryAfter: outcome.retryAfter, message: "Too many lookups. Please wait a minute and try again." },
        { scope: "verify-lookup" },
      );
    case "unavailable":
      throw new ApiError("SERVICE_UNAVAILABLE", { message: "Verification is temporarily unavailable. Please try again shortly." });
    case "result":
      return apiSuccess({
        state: outcome.state,
        ...(outcome.document ? { document: outcome.document } : {}),
        checkedAt: outcome.checkedAt,
      });
  }
}

export async function GET(request: Request, context: { params: Promise<{ code: string }> }): Promise<Response> {
  return withRouteErrorHandling("verify-api", (req) => lookup(req, context.params))(request);
}

export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
