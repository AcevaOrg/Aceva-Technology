import { requireAdminRequest } from "@/lib/admin/auth";
import {
  auditDocumentEvent,
  isDocumentAction,
  notFound,
  parseRevokeReason,
  parseStampOptions,
  planStatusAction,
  resolveDocumentId,
  runStore,
  validationFailed,
  withDocumentRoute,
  type DocumentAction,
  type StatusAction,
} from "@/lib/admin/documentsApi";
import {
  ApiError,
  apiSuccess,
  methodNotAllowedHandler,
  optionsHandler,
  readJsonObjectBody,
} from "@/lib/api/response";
import {
  duplicateDocument,
  getDocument,
  regenerateVerificationCode,
  reinstateDocument,
  restampDocument,
  revokeDocument,
  setDocumentStatus,
} from "@/lib/documents/store";
import { DEFAULT_STAMP_OPTIONS, type DocumentRecord } from "@/lib/documents/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** { action, reason? } is a few dozen bytes; anything near this size is not an action. */
const MAX_BODY_BYTES = 4_096;

function isStatusAction(action: DocumentAction): action is StatusAction {
  return action === "publish" || action === "unpublish" || action === "archive" || action === "restore";
}

/**
 * POST /api/admin/documents/[id]/actions — { action, reason? }.
 *
 * publish / unpublish / archive / restore move the record between draft, published and archived
 * (unpublish and restore both land on draft). revoke / reinstate flip the revoked flag, so a
 * printed QR keeps resolving and says "revoked". regenerate_code replaces the verification code,
 * which immediately stops the old one resolving (a file that carries the QR is stamped again with the new code).
 * stamp_file puts the QR and the code on the stored file now, or draws them again in the placement given
 * (position, size, pages). duplicate answers with the NEW draft copy.
 * Repeating a status action is a harmless no-op; an action the lifecycle does not allow is a 409.
 */
export const POST = withDocumentRoute("admin-document-actions", async (request, _requestId, context) => {
  await requireAdminRequest(request);
  const id = await resolveDocumentId(context);

  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });
  if (!isDocumentAction(body.action)) throw validationFailed({ action: "Choose a valid action." });
  const action = body.action;
  // Parsed before any database work: a bad reason should not cost a query.
  const reason = action === "revoke" ? parseRevokeReason(body.reason) : "";

  const record = await runStore(() => getDocument(id));
  if (!record) throw notFound();

  if (isStatusAction(action)) {
    const plan = planStatusAction(action, record.status);
    if (plan.kind === "conflict") throw new ApiError("CONFLICT", { message: plan.message }, { action, status: record.status });
    // Nothing changed, so nothing is written and nothing is logged.
    if (plan.kind === "noop") return apiSuccess({ document: record });

    const updated = await runStore(() => setDocumentStatus(id, plan.status));
    if (!updated) throw notFound();
    await auditDocumentEvent(request, `document.${action}`, updated, { statusFrom: record.status, statusTo: updated.status });
    return apiSuccess({ document: updated });
  }

  switch (action) {
    case "revoke": {
      const updated = await runStore(() => revokeDocument(id, reason));
      if (!updated) throw notFound();
      await auditDocumentEvent(request, "document.revoke", updated, { reason: updated.revokedReason });
      return apiSuccess({ document: updated });
    }
    case "reinstate": {
      if (record.revokedAt === null) return apiSuccess({ document: record });
      const updated = await runStore(() => reinstateDocument(id));
      if (!updated) throw notFound();
      await auditDocumentEvent(request, "document.reinstate", updated);
      return apiSuccess({ document: updated });
    }
    case "regenerate_code": {
      const updated = await runStore(() => regenerateVerificationCode(id));
      if (!updated) throw notFound();
      // Neither the old nor the new code is logged: the log is not a place to keep live credentials.
      await auditDocumentEvent(request, "document.regenerate_code", updated, { hadCode: record.verificationCode !== null });
      return apiSuccess({ document: updated });
    }
    case "stamp_file": {
      const current = record.files.find((file) => file.role === "primary")?.stamp;
      const options = parseStampOptions(body, current ?? DEFAULT_STAMP_OPTIONS);
      const updated = await runStore(() => restampDocument(id, options));
      if (!updated) throw notFound();
      // The placement is logged; the code is not (the log is not a place to keep live credentials).
      await auditDocumentEvent(request, "document.stamp_file", updated, { ...options });
      return apiSuccess({ document: updated });
    }
    case "duplicate": {
      const copy: DocumentRecord | null = await runStore(() => duplicateDocument(id));
      if (!copy) throw notFound();
      // Logged against the copy, like a create, with a pointer back to what it was copied from.
      await auditDocumentEvent(request, "document.duplicate", copy, { sourceId: record.id, sourceTitle: record.title });
      return apiSuccess({ document: copy });
    }
  }
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const PUT = methodNotAllowedHandler(["POST"]);
export const PATCH = methodNotAllowedHandler(["POST"]);
export const DELETE = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
