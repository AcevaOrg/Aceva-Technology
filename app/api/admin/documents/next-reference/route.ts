import { requireAdminRequest } from "@/lib/admin/auth";
import {
  collectReferenceNumbers,
  parseCategoryParam,
  runStore,
  suggestNextReference,
  validationFailed,
} from "@/lib/admin/documentsApi";
import { apiSuccess, methodNotAllowedHandler, optionsHandler, withRouteErrorHandling } from "@/lib/api/response";
import { CATEGORIES } from "@/lib/documents/categories";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/admin/documents/next-reference?category=<key>
 *
 * A suggestion only, e.g. "ACV/EL/2026/0008": the category's reference prefix, the current year
 * and one past the highest sequence already used. Nothing is reserved, so two people asking at the
 * same moment get the same answer; the editor treats it as a pre-filled, editable value.
 */
export const GET = withRouteErrorHandling("admin-document-reference", async (request) => {
  await requireAdminRequest(request);

  const category = parseCategoryParam(new URL(request.url).searchParams.get("category"));
  if (!category) throw validationFailed({ category: "Choose a document category." });

  const prefix = CATEGORIES[category].referencePrefix;
  const year = new Date().getUTCFullYear();
  const existing = await runStore(() => collectReferenceNumbers(prefix, year));
  return apiSuccess({ suggestion: suggestNextReference(prefix, year, existing) });
});

export const HEAD = methodNotAllowedHandler(["GET"]);
export const POST = methodNotAllowedHandler(["GET"]);
export const PUT = methodNotAllowedHandler(["GET"]);
export const PATCH = methodNotAllowedHandler(["GET"]);
export const DELETE = methodNotAllowedHandler(["GET"]);
export const OPTIONS = optionsHandler(["GET"]);
