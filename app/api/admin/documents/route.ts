import { requireAdminRequest } from "@/lib/admin/auth";
import {
  auditDocumentEvent,
  parseDocumentMultipart,
  parseListFilters,
  photoPlacementErrors,
  runStore,
  validationFailed,
} from "@/lib/admin/documentsApi";
import { apiSuccess, methodNotAllowedHandler, optionsHandler, withRouteErrorHandling } from "@/lib/api/response";
import { isDocumentCategory } from "@/lib/documents/categories";
import { createDocument, listDocuments } from "@/lib/documents/store";
import { validateDocumentInput } from "@/lib/documents/validate";

// Admin data must never be prerendered or cached, and the store needs Node (crypto, Buffer).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/documents — filtered, paginated list. Records carry file metadata, never bytes. */
export const GET = withRouteErrorHandling("admin-documents", async (request) => {
  await requireAdminRequest(request);
  const filters = parseListFilters(new URL(request.url).searchParams);
  const { items, total } = await runStore(() => listDocuments(filters));
  return apiSuccess({ items, total });
});

/**
 * POST /api/admin/documents — create from multipart/form-data: `payload` (JSON), optional `primary`
 * and `photo` files. The category comes from the payload and is fixed from here on.
 */
export const POST = withRouteErrorHandling("admin-documents", async (request) => {
  await requireAdminRequest(request);
  const form = await parseDocumentMultipart(request);

  const category = form.payload.category;
  if (!isDocumentCategory(category)) throw validationFailed({ category: "Choose a document category." });

  const validation = validateDocumentInput(form.payload, { category });
  // Field problems and upload problems are reported together so the editor can mark everything at once.
  const errors = {
    ...(validation.ok ? {} : validation.errors),
    ...photoPlacementErrors(category, form.photo !== null),
    ...form.fileErrors,
  };
  if (!validation.ok || Object.keys(errors).length > 0) throw validationFailed(errors);

  // The store re-checks publish rules (validatePublishable) when the payload asks for "published".
  const document = await runStore(() =>
    createDocument(validation.value, { primary: form.primary ?? undefined, photo: form.photo ?? undefined }),
  );

  await auditDocumentEvent(request, "document.create", document, {
    status: document.status,
    visibility: document.visibility,
    files: document.files.map((file) => file.role),
  });
  return apiSuccess({ document }, { status: 201, headers: { Location: `/api/admin/documents/${document.id}` } });
});

export const HEAD = methodNotAllowedHandler(["GET", "POST"]);
export const PUT = methodNotAllowedHandler(["GET", "POST"]);
export const PATCH = methodNotAllowedHandler(["GET", "POST"]);
export const DELETE = methodNotAllowedHandler(["GET", "POST"]);
export const OPTIONS = optionsHandler(["GET", "POST"]);
