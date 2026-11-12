import { requireAdminRequest } from "@/lib/admin/auth";
import {
  auditDocumentEvent,
  fileChange,
  notFound,
  parseDocumentMultipart,
  photoPlacementErrors,
  resolveDocumentId,
  runStore,
  validationFailed,
  withDocumentRoute,
} from "@/lib/admin/documentsApi";
import { apiSuccess, methodNotAllowedHandler, optionsHandler } from "@/lib/api/response";
import { deleteDocument, getDocument, updateDocument } from "@/lib/documents/store";
import { validateDocumentInput } from "@/lib/documents/validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/documents/[id] */
export const GET = withDocumentRoute("admin-document", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);
  const document = await runStore(() => getDocument(id));
  if (!document) throw notFound();
  return apiSuccess({ document });
});

/**
 * PATCH /api/admin/documents/[id] — save the editor's form.
 *
 * multipart/form-data: `payload`, optional `primary` / `photo` (replace), `removePrimary` /
 * `removePhoto` ("1" deletes the stored file), and `expectedUpdatedAt` (the `updatedAt` the editor
 * loaded; a record that changed since answers 409). The category cannot change: the record's own
 * category is the one validated against, and a different one in the payload is a field error.
 */
export const PATCH = withDocumentRoute("admin-document", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);

  // Looked up before the body is read: an unknown id should not cost a multi-megabyte upload.
  const existing = await runStore(() => getDocument(id));
  if (!existing) throw notFound();

  const form = await parseDocumentMultipart(request);
  const validation = validateDocumentInput(form.payload, { category: existing.category, existing });
  const errors = {
    ...(validation.ok ? {} : validation.errors),
    ...photoPlacementErrors(existing.category, form.photo !== null),
    ...form.fileErrors,
  };
  if (!validation.ok || Object.keys(errors).length > 0) throw validationFailed(errors);

  const primary = fileChange(form.primary, form.removePrimary);
  const photo = fileChange(form.photo, form.removePhoto);

  // The store re-checks publish rules against the files this save leaves behind.
  const updated = await runStore(() =>
    updateDocument(id, validation.value, {
      files: { primary, photo },
      expectedUpdatedAt: form.expectedUpdatedAt ?? undefined,
    }),
  );
  if (!updated) throw notFound();

  await auditDocumentEvent(request, "document.update", updated, {
    status: updated.status,
    ...(existing.status !== updated.status ? { statusFrom: existing.status } : {}),
    ...(primary !== undefined ? { primaryFile: primary === null ? "removed" : "replaced" } : {}),
    ...(photo !== undefined ? { photoFile: photo === null ? "removed" : "replaced" } : {}),
  });
  return apiSuccess({ document: updated });
});

/** DELETE /api/admin/documents/[id] — removes the record and, by cascade, its files. */
export const DELETE = withDocumentRoute("admin-document", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);

  // Read first so the audit entry can still say what was deleted.
  const document = await runStore(() => getDocument(id));
  if (!document) throw notFound();
  const removed = await runStore(() => deleteDocument(id));
  if (!removed) throw notFound();

  await auditDocumentEvent(request, "document.delete", document, {
    status: document.status,
    fileCount: document.files.length,
  });
  return apiSuccess({});
});

export const HEAD = methodNotAllowedHandler(["GET", "PATCH", "DELETE"]);
export const POST = methodNotAllowedHandler(["GET", "PATCH", "DELETE"]);
export const PUT = methodNotAllowedHandler(["GET", "PATCH", "DELETE"]);
export const OPTIONS = optionsHandler(["GET", "PATCH", "DELETE"]);
