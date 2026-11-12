import { requireAdminRequest } from "@/lib/admin/auth";
import {
  ADMIN_FILE_CSP,
  ADMIN_SVG_CSP,
  binaryResponse,
  clampQrSize,
  notFound,
  parseQrFormat,
  qrFilename,
  resolveDocumentId,
  runStore,
  wantsDownload,
  withDocumentRoute,
} from "@/lib/admin/documentsApi";
import { methodNotAllowedHandler, optionsHandler } from "@/lib/api/response";
import { contentDisposition } from "@/lib/documents/files";
import { renderQrPng, renderQrSvg, verificationUrl } from "@/lib/documents/qr";
import { getDocument } from "@/lib/documents/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/documents/[id]/qr?format=svg|png&size=128..1024&download=1
 *
 * Encodes the public verify URL of the record's current code. Records without a code have no QR:
 * that is a 404, not an empty image. The image is never cached (the code can be regenerated at any
 * moment) and is served from behind the admin session only.
 */
export const GET = withDocumentRoute("admin-document-qr", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);

  const params = new URL(request.url).searchParams;
  const format = parseQrFormat(params.get("format"));
  const size = clampQrSize(params.get("size"));

  const record = await runStore(() => getDocument(id));
  if (!record || !record.verificationCode) throw notFound();

  let target: string;
  try {
    target = verificationUrl(record.verificationCode);
  } catch {
    // A stored value that is not a valid code cannot be encoded; to the admin it is as good as absent.
    throw notFound();
  }

  const disposition = contentDisposition(qrFilename(record, format), wantsDownload(params) ? "attachment" : "inline");

  if (format === "png") {
    const png = await renderQrPng(target, { width: size });
    return binaryResponse(png, { contentType: "image/png", disposition, csp: ADMIN_FILE_CSP });
  }
  const svg = await renderQrSvg(target, { size });
  return binaryResponse(new TextEncoder().encode(svg), {
    contentType: "image/svg+xml; charset=utf-8",
    disposition,
    csp: ADMIN_SVG_CSP,
  });
});

export const HEAD = methodNotAllowedHandler(["GET"]);
export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
