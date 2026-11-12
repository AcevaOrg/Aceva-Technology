import { getRequestSession } from "@/lib/admin/auth";
import {
  ApiError,
  methodNotAllowedHandler,
  optionsHandler,
  withRouteErrorHandling,
} from "@/lib/api/response";
import { isDatabaseConfigured } from "@/lib/db";
import {
  canAccessFile,
  clientIpFromHeaders,
  fileCacheControl,
  fileSecurityHeaders,
  parseFileRole,
  servableContentType,
  wantsDownload,
} from "@/lib/documents/access";
import { contentDisposition } from "@/lib/documents/files";
import { getDocument, getFile, isDocumentId } from "@/lib/documents/store";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/documents/[id]/file?role=primary|photo&code=<optional>&download=1
 *
 * Serves a stored file to the public, or to an admin for any record. Every refusal is the same
 * 404: a malformed id, an unknown id, a draft, a private record, a wrong code and a disabled
 * download are indistinguishable from outside, so this URL cannot be used to find out what exists.
 */
export const dynamic = "force-dynamic";

const NOT_FOUND = () => new ApiError("NOT_FOUND");

/** An admin cookie is checked without ever failing the request: a disabled console is just "not an admin". */
async function hasAdminSession(request: Request): Promise<boolean> {
  try {
    return (await getRequestSession(request)) !== null;
  } catch {
    return false;
  }
}

async function serveFile(request: Request, requestId: string, params: Promise<{ id: string }>): Promise<Response> {
  const limit = checkRateLimit("documents-file", clientIpFromHeaders(request.headers));
  if (!limit.allowed) {
    throw new ApiError(
      "RATE_LIMITED",
      { retryAfter: limit.retryAfter, message: "Too many downloads. Please wait a minute and try again." },
      { scope: "documents-file" },
    );
  }

  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const role = parseFileRole(query.get("role"));
  if (!isDocumentId(id) || !role) throw NOT_FOUND();
  if (!isDatabaseConfigured()) throw NOT_FOUND();

  const isAdmin = await hasAdminSession(request);
  const code = query.get("code");

  let file: Awaited<ReturnType<typeof getFile>> = null;
  let cacheControl = "private, no-store";
  try {
    const record = await getDocument(id);
    if (!record) throw NOT_FOUND();

    const decision = canAccessFile({ record, role, code, isAdmin });
    if (!decision.allowed) throw NOT_FOUND();

    // A shared cache must only ever hold what an anonymous visitor could have fetched.
    const visitorDecision = isAdmin ? canAccessFile({ record, role, code, isAdmin: false }) : decision;
    cacheControl = fileCacheControl(record, visitorDecision.allowed);

    file = await getFile(id, role);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Only the class of failure is logged: a driver error message can carry connection detail.
    console.error(`[documents-file][${requestId}] storage failure`, error instanceof Error ? error.name : typeof error);
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "Files are temporarily unavailable. Please try again shortly." });
  }
  if (!file) throw NOT_FOUND();

  const { contentType, forceDownload } = servableContentType(file.meta.mimeType);
  const disposition = forceDownload || wantsDownload(query.get("download")) ? "attachment" : "inline";

  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      ...fileSecurityHeaders(),
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition(file.meta.filename, disposition),
      "Content-Length": String(file.bytes.length),
      "Cache-Control": cacheControl,
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return withRouteErrorHandling("documents-file", (req, requestId) => serveFile(req, requestId, context.params))(request);
}

export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
