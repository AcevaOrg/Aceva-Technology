import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentCategory, DocumentStatus, DocumentVisibility } from "@/lib/documents/types";
import { isApiErrorBody, resolveApiFieldMessages } from "@/lib/api/errorCodes";
import { ROUTES, adminDocumentRoute, verifyRoute } from "@/lib/nav";
import { clip } from "./format";

/**
 * What the per-row actions menu offers, and how each action talks to the API.
 *
 * Everything here is pure: which actions apply to a record in a given state, the copy for each
 * confirmation, the request body, and how a failed response is worded. The menu component only
 * wires these to fetch, dialogs and toasts, so the rules can be tested without a browser.
 *
 * Client-safe: no server imports (the constants come from isomorphic modules).
 */

/** The slice of a record the menu needs. Plain data, so it can cross the server/client boundary. */
export interface RowActionsTarget {
  id: string;
  title: string;
  category: DocumentCategory;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  revoked: boolean;
  /** The exact link encoded in the QR; null when the record has no verification code. */
  verifyUrl: string | null;
  /** Where the public can see this record; null when it is not public-facing. */
  publicPath: string | null;
}

export type MenuActionId =
  | "edit"
  | "view_public"
  | "copy_link"
  | "download_qr"
  | "print_card"
  | "publish"
  | "unpublish"
  | "archive"
  | "restore"
  | "revoke"
  | "reinstate"
  | "duplicate"
  | "delete";

/** Actions served by POST /api/admin/documents/[id]/actions. */
export type WorkflowAction = "publish" | "unpublish" | "archive" | "restore" | "revoke" | "reinstate" | "duplicate";

export interface MenuActionDescriptor {
  id: MenuActionId;
  label: string;
  tone?: "danger";
}

const LABELS: Record<MenuActionId, string> = {
  edit: "Edit",
  view_public: "View public page",
  copy_link: "Copy verification link",
  download_qr: "Download QR code",
  print_card: "Print QR labels",
  publish: "Publish",
  unpublish: "Unpublish",
  archive: "Archive",
  restore: "Restore",
  revoke: "Revoke",
  reinstate: "Reinstate",
  duplicate: "Duplicate",
  delete: "Delete",
};

const descriptor = (id: MenuActionId, tone?: "danger"): MenuActionDescriptor => ({ id, label: LABELS[id], tone });

/**
 * The menu, in three groups separated by hairlines: navigation, workflow, destructive. Order within
 * a group is the order of the task a person is likely doing: look at it, then change its state.
 */
export function buildActionGroups(target: RowActionsTarget): MenuActionDescriptor[][] {
  const navigation: MenuActionDescriptor[] = [descriptor("edit")];
  if (target.publicPath) navigation.push(descriptor("view_public"));
  // Everything that handles the QR needs a code: the label page (/admin/documents/[id]/card) prints it.
  if (target.verifyUrl) navigation.push(descriptor("copy_link"), descriptor("download_qr"), descriptor("print_card"));

  const workflow: MenuActionDescriptor[] = [];
  if (target.status === "draft") workflow.push(descriptor("publish"), descriptor("archive"));
  else if (target.status === "published") workflow.push(descriptor("unpublish"), descriptor("archive"));
  else workflow.push(descriptor("restore"));

  // A revoked record can always be reinstated. Revoking only makes sense where it has an effect: a QR
  // code to answer "revoked", or a live listing to pull.
  if (target.revoked) workflow.push(descriptor("reinstate"));
  else if (target.verifyUrl || target.status === "published") workflow.push(descriptor("revoke", "danger"));
  workflow.push(descriptor("duplicate"));

  return [navigation, workflow, [descriptor("delete", "danger")]];
}

/** Flat list of ids, for tests and for callers that only need to know what is available. */
export function availableActionIds(target: RowActionsTarget): MenuActionId[] {
  return buildActionGroups(target).flat().map((action) => action.id);
}

/* ------------------------------------------------------------------ *
 * Links                                                                *
 * ------------------------------------------------------------------ */

/**
 * Where the public can see a record. Only a published, non-private record is public-facing at all.
 * A record with a code is reached at its verify page; a public record without one is listed on
 * /documents under its category. An unlisted record without a code has no public address.
 */
export function publicPagePath(record: {
  category: DocumentCategory;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  verificationCode: string | null;
}): string | null {
  if (record.status !== "published" || record.visibility === "private") return null;
  if (record.verificationCode) return verifyRoute(record.verificationCode);
  if (record.visibility === "public") return `${ROUTES.documents}#${CATEGORIES[record.category].slug}`;
  return null;
}

export function qrDownloadHref(id: string, format: "png" | "svg" = "png", size = 768): string {
  return `/api/admin/documents/${encodeURIComponent(id)}/qr?format=${format}&size=${size}&download=1`;
}

export function cardHref(id: string): string {
  return `${adminDocumentRoute(id)}/card`;
}

/* ------------------------------------------------------------------ *
 * Confirmation copy                                                    *
 * ------------------------------------------------------------------ */

export interface ConfirmCopy {
  title: string;
  /** The body is `lead`, then the record's title in bold, then `trail`. */
  lead: string;
  trail: string;
  confirmLabel: string;
  tone: "default" | "danger";
  /** Ask for a reason before revoking. */
  needsReason?: boolean;
  /** The text the person must type to arm the button. */
  requireText?: string;
}

export const DELETE_PHRASE = "DELETE";

/**
 * The words on each confirmation, or null for actions that need none (restoring and duplicating undo
 * or add nothing). Wording says what the public will see, because that is what a publisher is risking.
 */
export function confirmCopy(action: MenuActionId, target: Pick<RowActionsTarget, "visibility">): ConfirmCopy | null {
  switch (action) {
    case "publish": {
      const where: Record<DocumentVisibility, string> = {
        public: " goes live and appears on the public Documents page.",
        unlisted: " goes live, reachable only through its QR code or verification code.",
        private: " is marked published but stays admin-only while its visibility is Private.",
      };
      return { title: "Publish this document?", lead: "", trail: where[target.visibility], confirmLabel: "Publish", tone: "default" };
    }
    case "unpublish":
      return {
        title: "Move back to draft?",
        lead: "",
        trail: " stops being public and returns to draft. Anyone who scans a printed QR code will see “not found” until you publish it again.",
        confirmLabel: "Unpublish",
        tone: "default",
      };
    case "archive":
      return {
        title: "Archive this document?",
        lead: "",
        trail: " is hidden from the public and moved to the archive. You can restore it at any time.",
        confirmLabel: "Archive",
        tone: "default",
      };
    case "revoke":
      return {
        title: "Revoke this document?",
        lead: "",
        trail: " is withdrawn: its QR code will say it was revoked and it leaves the public listing. You can reinstate it later.",
        confirmLabel: "Revoke",
        tone: "danger",
        needsReason: true,
      };
    case "reinstate":
      return {
        title: "Reinstate this document?",
        lead: "",
        trail: " becomes valid again (unless its expiry date has passed) and returns to the public listing if it is public.",
        confirmLabel: "Reinstate",
        tone: "default",
      };
    case "delete":
      return {
        title: "Delete this document?",
        lead: "",
        trail: " and its files are deleted permanently. This cannot be undone. Past verification lookups stay in the log as anonymous entries.",
        confirmLabel: "Delete permanently",
        tone: "danger",
        requireText: DELETE_PHRASE,
      };
    default:
      return null;
  }
}

export function isWorkflowAction(action: MenuActionId): action is WorkflowAction {
  return (
    action === "publish" ||
    action === "unpublish" ||
    action === "archive" ||
    action === "restore" ||
    action === "revoke" ||
    action === "reinstate" ||
    action === "duplicate"
  );
}

/* ------------------------------------------------------------------ *
 * Requests                                                             *
 * ------------------------------------------------------------------ */

export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 500;

/** `null` when the reason is acceptable, otherwise the sentence to show beside the field. */
export function validateRevokeReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) return "Say why it is being revoked, so the log explains it later.";
  if (trimmed.length > MAX_REASON_LENGTH) return `Keep the reason under ${MAX_REASON_LENGTH} characters.`;
  return null;
}

export interface ActionRequest {
  url: string;
  method: "POST" | "DELETE";
  /** JSON text, or undefined for DELETE. */
  body: string | undefined;
}

export function buildActionRequest(id: string, action: WorkflowAction | "delete", reason?: string): ActionRequest {
  const base = `/api/admin/documents/${encodeURIComponent(id)}`;
  if (action === "delete") return { url: base, method: "DELETE", body: undefined };
  const payload: { action: WorkflowAction; reason?: string } = { action };
  if (action === "revoke" && reason !== undefined) payload.reason = reason.trim();
  return { url: `${base}/actions`, method: "POST", body: JSON.stringify(payload) };
}

/* ------------------------------------------------------------------ *
 * Outcomes                                                             *
 * ------------------------------------------------------------------ */

const TITLE_ROOM = 60;

/** The success toast. Titles are clipped so a very long one cannot swamp the notification. */
export function successMessage(action: MenuActionId, title: string): string {
  const name = `“${clip(title, TITLE_ROOM)}”`;
  switch (action) {
    case "publish":
      return `Published ${name}`;
    case "unpublish":
      return `${name} moved back to draft`;
    case "archive":
      return `Archived ${name}`;
    case "restore":
      return `Restored ${name} as a draft`;
    case "revoke":
      return `Revoked ${name}`;
    case "reinstate":
      return `Reinstated ${name}`;
    case "duplicate":
      return `Duplicated ${name}`;
    case "delete":
      return `Deleted ${name}`;
    default:
      return "Done";
  }
}

export interface FailureNotice {
  message: string;
  description?: string;
  /** The session ended: the page should be refreshed so the server sends the person to sign in. */
  signedOut: boolean;
}

const MAX_LISTED_REASONS = 3;

/**
 * Words for a failed request, from the canonical error envelope. Publish refusals carry one reason per
 * missing field; they are listed so the person knows what to fix without opening the editor first.
 */
export function describeActionFailure(action: MenuActionId, status: number, body: unknown): FailureNotice {
  const code = isApiErrorBody(body) ? body.code : undefined;

  if (status === 401 || code === "UNAUTHENTICATED") {
    return { message: "Your session has ended.", description: "Sign in again to continue.", signedOut: true };
  }
  if (code === "VALIDATION_FAILED") {
    const reasons = Object.values(resolveApiFieldMessages(body));
    const headline = action === "publish" ? "It cannot be published yet." : "That change was not accepted.";
    if (reasons.length === 0) return { message: headline, description: isApiErrorBody(body) ? body.error : undefined, signedOut: false };
    const shown = reasons.slice(0, MAX_LISTED_REASONS).join(" ");
    const more = reasons.length > MAX_LISTED_REASONS ? ` And ${reasons.length - MAX_LISTED_REASONS} more.` : "";
    return { message: headline, description: `${shown}${more}`, signedOut: false };
  }
  if (code === "NOT_FOUND" || status === 404) {
    return { message: "That document no longer exists.", description: "The list has been refreshed.", signedOut: false };
  }
  if (code === "CONFLICT" || status === 409) {
    return { message: "The document changed in the meantime.", description: "The list has been refreshed. Try again.", signedOut: false };
  }
  if (code === "RATE_LIMITED" || status === 429) {
    return { message: "Too many requests.", description: "Wait a moment and try again.", signedOut: false };
  }
  return { message: "Something went wrong.", description: "Nothing was changed. Please try again.", signedOut: false };
}

const DOCUMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id of the record in a success response (`{ ok: true, document: { id } }`), or null. */
export function documentIdFromResponse(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const document = (body as { document?: unknown }).document;
  if (!document || typeof document !== "object") return null;
  const id = (document as { id?: unknown }).id;
  return typeof id === "string" && DOCUMENT_ID.test(id) ? id : null;
}

/** Where to go after an action: a duplicate opens its copy; everything else stays on the list. */
export function destinationAfter(action: MenuActionId, body: unknown): string | null {
  if (action !== "duplicate") return null;
  const id = documentIdFromResponse(body);
  return id ? adminDocumentRoute(id) : null;
}
