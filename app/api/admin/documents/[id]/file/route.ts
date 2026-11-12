import { requireAdminRequest } from "@/lib/admin/auth";
import {
  ADMIN_FILE_CSP,
  binaryResponse,
  notFound,
  parseFileRole,
  resolveDocumentId,
  runStore,
  servableMimeType,
  wantsDownload,
  withDocumentRoute,
} from "@/lib/admin/documentsApi";
import { methodNotAllowedHandler, optionsHandler } from "@/lib/api/response";
import { contentDisposition } from "@/lib/documents/files";
import { getFile } from "@/lib/documents/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/documents/[id]/file?role=primary|photo&download=1
 *
 * The admin preview of a stored file, whatever the record's status or visibility. The session is
 * the authorisation (`getFile` itself checks nothing). The stored type is re-checked before it
 * becomes a Content-Type, and the response is locked down: nosniff, no caching, and a CSP that
 * lets a browser render a PDF or image but run nothing.
 */
export const GET = withDocumentRoute("admin-document-file", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);

  const params = new URL(request.url).searchParams;
  const role = parseFileRole(params.get("role"));

  const stored = await runStore(() => getFile(id, role));
  if (!stored) throw notFound();

  const { contentType, forceDownload } = servableMimeType(stored.meta.mimeType, role);
  const disposition = contentDisposition(stored.meta.filename, forceDownload || wantsDownload(params) ? "attachment" : "inline");
  return binaryResponse(stored.bytes, { contentType, disposition, csp: ADMIN_FILE_CSP });
});

export const HEAD = methodNotAllowedHandler(["GET"]);
export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
