/**
 * Document editor for the admin console.
 *
 *   DocumentEditor      client form for create and edit, rendered from lib/documents/categories.ts
 *   CategoryPicker      step one of /admin/documents/new (server component, plain links)
 *   LivePreview         "as visitors see it", drawn through the real privacy boundary
 *   VerificationPanel   code, QR, downloads and record actions for a stored document
 *   SetupNotice         calm notice for a missing or unreachable database
 *
 * The pure logic (state, payloads, validation, error mapping, preview projection) is in editorModel.ts,
 * editorErrors.ts, editorPreview.ts and editorGuard.ts, and is covered by tests/unit/adminEditor*.test.ts.
 */

export { DocumentEditor, type DocumentEditorProps } from "./DocumentEditor";
export { CategoryPicker } from "./CategoryPicker";
export { LivePreview } from "./LivePreview";
export { VerificationPanel } from "./VerificationPanel";
export { DatabaseSetupNotice, SetupNotice } from "./SetupNotice";
