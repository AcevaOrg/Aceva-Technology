import { CATEGORIES, categoryFromSlug, isDocumentCategory } from "@/lib/documents/categories";
import {
  MAX_PHOTO_BYTES,
  MAX_REQUEST_BYTES,
  STATUS_LABELS,
  VISIBILITY_LABELS,
  DOCUMENT_VISIBILITIES,
  type CategorySpec,
  type DocumentCategory,
  type DocumentFileMeta,
  type DocumentRecord,
  type DocumentStatus,
  type DocumentVisibility,
  type FieldSpec,
  type FieldValue,
} from "@/lib/documents/types";
import { validateDocumentInput, visibleFieldKeys } from "@/lib/documents/validate";
import type { SegmentedOption } from "../SegmentedControl";
import { formatBytes } from "../utils";

/**
 * Everything the document editor decides, as pure functions.
 *
 * The form is rendered from lib/documents/categories.ts and validated by the SAME isomorphic
 * `validateDocumentInput` the server runs, so the two cannot drift: if the server would reject a
 * payload, the browser says so first, with the same words and the same keys. Nothing here touches
 * React, the DOM or the network, which is what lets it be unit tested.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary                                                          *
 * ------------------------------------------------------------------ */

export const BASE_KEYS = ["title", "summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const;
export type EditorBaseKey = (typeof BASE_KEYS)[number];

/** What a category field holds while it is being edited: booleans stay booleans, tags stay lists, the rest is text. */
export type EditorFieldValue = string | boolean | string[];

export const SETTING_KEYS = ["status", "visibility", "allowDownload", "featured", "enableVerification"] as const;
export type EditorSettingKey = (typeof SETTING_KEYS)[number];

export interface EditorValues {
  title: string;
  summary: string;
  holderName: string;
  referenceNo: string;
  /** YYYY-MM-DD, or "" for none. */
  issuedOn: string;
  expiresOn: string;
  data: Record<string, EditorFieldValue>;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  allowDownload: boolean;
  featured: boolean;
  enableVerification: boolean;
}

export type EditorMode = "create" | "edit";

/**
 * The consent switch is shown in the Publishing section (it gates Public) instead of among the
 * category fields, so there is exactly one place to tick it.
 */
export const CONSENT_FIELD_KEY = "consent_to_publish";

/** Phone photos are shrunk in the browser, so the picker accepts far more than the stored limit. */
export const PHOTO_INTAKE_BYTES = 25_000_000;
export const PHOTO_MAX_EDGE = 1200;
export const PHOTO_QUALITY = 0.85;

/** Allowance for the JSON payload and multipart framing when adding up one request's size. */
const REQUEST_OVERHEAD_BYTES = 40_000;

/* ------------------------------------------------------------------ *
 * Small helpers                                                       *
 * ------------------------------------------------------------------ */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Client-safe twin of the store's `isDocumentId`, so an id from a response is checked before it becomes a URL. */
export function isDocumentIdLike(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function requiresConsent(spec: CategorySpec): boolean {
  return spec.personal;
}

export function consentField(spec: CategorySpec): FieldSpec | undefined {
  return spec.personal ? spec.fields.find((field) => field.key === CONSENT_FIELD_KEY && field.type === "boolean") : undefined;
}

/** Whether a record in this category should have downloads switched on until someone decides otherwise. */
export function defaultAllowDownload(spec: CategorySpec): boolean {
  // Personal records default to "no": a file that names a person must be opted in, not opted out.
  return !spec.personal && spec.fileRequired;
}

function emptyFieldValue(field: FieldSpec): EditorFieldValue {
  switch (field.type) {
    case "boolean":
      return typeof field.defaultValue === "boolean" ? field.defaultValue : false;
    case "tags":
      return [];
    default:
      return "";
  }
}

function fromStored(field: FieldSpec, stored: FieldValue | undefined): EditorFieldValue {
  if (stored === undefined || stored === null) return emptyFieldValue(field);
  switch (field.type) {
    case "boolean":
      return typeof stored === "boolean" ? stored : emptyFieldValue(field);
    case "tags":
      if (Array.isArray(stored)) return stored.filter((tag): tag is string => typeof tag === "string");
      return typeof stored === "string" && stored.trim() ? [stored.trim()] : [];
    default:
      if (typeof stored === "string") return stored;
      return typeof stored === "number" ? String(stored) : "";
  }
}

/* ------------------------------------------------------------------ *
 * Initial values                                                      *
 * ------------------------------------------------------------------ */

/** The form's starting point: a blank record with the category's defaults, or the stored record. */
export function createInitialValues(category: DocumentCategory, record?: DocumentRecord | null): EditorValues {
  const spec = CATEGORIES[category];
  const data: Record<string, EditorFieldValue> = {};
  for (const field of spec.fields) {
    data[field.key] = record ? fromStored(field, record.data[field.key]) : emptyFieldValue(field);
  }
  if (record) {
    return {
      title: record.title,
      summary: record.summary,
      holderName: record.holderName,
      referenceNo: record.referenceNo,
      issuedOn: record.issuedOn ?? "",
      expiresOn: record.expiresOn ?? "",
      data,
      status: record.status,
      visibility: record.visibility,
      allowDownload: record.allowDownload,
      featured: record.featured,
      enableVerification: record.verificationCode !== null,
    };
  }
  return {
    title: "",
    summary: "",
    holderName: "",
    referenceNo: "",
    issuedOn: "",
    expiresOn: "",
    data,
    status: "draft",
    visibility: spec.defaultVisibility,
    allowDownload: defaultAllowDownload(spec),
    featured: false,
    enableVerification: spec.verifiable,
  };
}

/* ------------------------------------------------------------------ *
 * Conditional fields                                                  *
 * ------------------------------------------------------------------ */

/** The map `visibleFieldKeys` expects: blank text and empty lists count as "not answered", as on the server. */
export function toValueMap(data: Record<string, EditorFieldValue>): Record<string, FieldValue | undefined> {
  const map: Record<string, FieldValue | undefined> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) map[key] = trimmed;
    } else if (Array.isArray(value)) {
      if (value.length > 0) map[key] = value;
    } else {
      map[key] = value;
    }
  }
  return map;
}

/** Keys of the category fields that are currently shown (`showWhen` honoured, including chains). */
export function visibleFieldSet(category: DocumentCategory, data: Record<string, EditorFieldValue>): Set<string> {
  return visibleFieldKeys(category, toValueMap(data));
}

function controllerValue(spec: CategorySpec, key: string, map: Record<string, FieldValue | undefined>): FieldValue | undefined {
  const current = map[key];
  if (current !== undefined) return current;
  const controller = spec.fields.find((field) => field.key === key);
  if (controller?.type !== "boolean") return undefined;
  return typeof controller.defaultValue === "boolean" ? controller.defaultValue : false;
}

export interface FieldState {
  field: FieldSpec;
  visible: boolean;
  /** `required`, or `requiredWhen` satisfied right now. Switches are never "required". */
  required: boolean;
}

/** Visibility and requiredness of every category field for the current answers. */
export function evaluateFields(category: DocumentCategory, data: Record<string, EditorFieldValue>): FieldState[] {
  const spec = CATEGORIES[category];
  const map = toValueMap(data);
  const visible = visibleFieldKeys(category, map);
  return spec.fields.map((field) => {
    const isVisible = visible.has(field.key);
    let required = false;
    if (isVisible && field.type !== "boolean") {
      const rule = field.requiredWhen;
      required =
        Boolean(field.required) ||
        (rule !== undefined && visible.has(rule.key) && controllerValue(spec, rule.key, map) === rule.equals);
    }
    return { field, visible: isVisible, required };
  });
}

export interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

const groupCache = new Map<string, FieldGroup[]>();

/** Category fields gathered by `FieldSpec.group`, in order of first appearance. The consent switch lives elsewhere. */
export function groupFields(category: DocumentCategory): FieldGroup[] {
  const cached = groupCache.get(category);
  if (cached) return cached;
  const spec = CATEGORIES[category];
  const moved = consentField(spec)?.key;
  const groups: FieldGroup[] = [];
  for (const field of spec.fields) {
    if (field.key === moved) continue;
    let group = groups.find((candidate) => candidate.title === field.group);
    if (!group) {
      group = { title: field.group, fields: [] };
      groups.push(group);
    }
    group.fields.push(field);
  }
  groupCache.set(category, groups);
  return groups;
}

/* ------------------------------------------------------------------ *
 * Reconciling dependent settings                                      *
 * ------------------------------------------------------------------ */

/**
 * Keeps settings that depend on each other consistent after every edit. The one that matters: a
 * personal record cannot stay Public once consent is withdrawn, so it steps down rather than
 * leaving a state the server would refuse. The notice says why, so it is never a silent change.
 */
export function reconcileValues(category: DocumentCategory, values: EditorValues): { values: EditorValues; notice: string | null } {
  const spec = CATEGORIES[category];
  let next = values;
  let notice: string | null = null;

  if (!spec.allowedVisibility.includes(next.visibility)) {
    next = { ...next, visibility: spec.defaultVisibility };
    notice = `${spec.plural} cannot be ${values.visibility}. Visibility is now ${VISIBILITY_LABELS[spec.defaultVisibility].label}.`;
  }

  if (next.visibility === "public" && requiresConsent(spec) && next.data[CONSENT_FIELD_KEY] !== true) {
    const fallback = spec.allowedVisibility.find((visibility) => visibility !== "public") ?? spec.defaultVisibility;
    next = { ...next, visibility: fallback };
    notice = `Visibility changed to ${VISIBILITY_LABELS[fallback].label}: a person can only be listed publicly with their recorded consent.`;
  }

  if (!spec.verifiable && next.enableVerification) next = { ...next, enableVerification: false };

  return { values: next, notice };
}

/* ------------------------------------------------------------------ *
 * Options for the Publishing section                                  *
 * ------------------------------------------------------------------ */

/** Visibility choices limited to what the category allows; Public is locked until a personal record has consent. */
export function visibilityOptions(category: DocumentCategory, consentGiven: boolean): SegmentedOption<DocumentVisibility>[] {
  const spec = CATEGORIES[category];
  const consentMissing = requiresConsent(spec) && !consentGiven;
  return DOCUMENT_VISIBILITIES.filter((visibility) => spec.allowedVisibility.includes(visibility)).map((visibility) => ({
    value: visibility,
    label: VISIBILITY_LABELS[visibility].label,
    hint: VISIBILITY_LABELS[visibility].help,
    disabled: visibility === "public" && consentMissing,
  }));
}

const STATUS_HINTS: Record<DocumentStatus, string> = {
  draft: "Admin only. Nothing is visible to visitors yet.",
  published: "Live. Who can see it depends on the visibility you choose.",
  archived: "Hidden from visitors but kept, so it can be restored later.",
};

/** A new record can only start as a draft or go straight to published; archiving only makes sense later. */
export function statusOptions(mode: EditorMode): SegmentedOption<DocumentStatus>[] {
  const statuses: DocumentStatus[] = mode === "create" ? ["draft", "published"] : ["draft", "published", "archived"];
  return statuses.map((status) => ({ value: status, label: STATUS_LABELS[status], hint: STATUS_HINTS[status] }));
}

/* ------------------------------------------------------------------ *
 * Reducer                                                             *
 * ------------------------------------------------------------------ */

export interface EditorState {
  category: DocumentCategory;
  /** The latest stored version this editor knows about; null while creating. */
  record: DocumentRecord | null;
  /** The values that correspond to `record`: "not dirty" means values equal baseline. */
  baseline: EditorValues;
  values: EditorValues;
  /** Why a setting was changed on the person's behalf, until they dismiss it. */
  notice: string | null;
}

export type EditorAction =
  | { type: "field"; key: string; value: EditorFieldValue }
  | { type: "base"; key: EditorBaseKey; value: string }
  | { type: "setting"; patch: Partial<Pick<EditorValues, EditorSettingKey>> }
  | { type: "rebase"; record: DocumentRecord }
  | { type: "reset"; record: DocumentRecord }
  | { type: "dismissNotice" };

export function createEditorState(category: DocumentCategory, record?: DocumentRecord | null): EditorState {
  const baseline = createInitialValues(category, record);
  return { category, record: record ?? null, baseline, values: baseline, notice: null };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => item === b[index]);
  return a === b;
}

type ScalarKey = EditorBaseKey | EditorSettingKey;

function mergeKey<K extends ScalarKey>(key: K, old: EditorValues, next: EditorValues, current: EditorValues): EditorValues[K] {
  return sameValue(old[key], current[key]) ? next[key] : current[key];
}

/**
 * Three-way merge used when the stored record changes underneath an open form (an action from the
 * side panel, or a save that returned the new version): a value the person has not touched adopts
 * the new stored value, a value they have edited stays theirs. Without it, a stale "published"
 * still sitting in the form would silently undo an Archive done a moment earlier.
 */
export function rebaseValues(old: EditorValues, next: EditorValues, current: EditorValues): EditorValues {
  const data: Record<string, EditorFieldValue> = {};
  for (const key of new Set([...Object.keys(next.data), ...Object.keys(current.data)])) {
    const fresh = next.data[key];
    const mine = current.data[key];
    if (mine === undefined) data[key] = fresh;
    else if (fresh === undefined) data[key] = mine;
    else data[key] = sameValue(old.data[key], mine) ? fresh : mine;
  }
  return {
    title: mergeKey("title", old, next, current),
    summary: mergeKey("summary", old, next, current),
    holderName: mergeKey("holderName", old, next, current),
    referenceNo: mergeKey("referenceNo", old, next, current),
    issuedOn: mergeKey("issuedOn", old, next, current),
    expiresOn: mergeKey("expiresOn", old, next, current),
    data,
    status: mergeKey("status", old, next, current),
    visibility: mergeKey("visibility", old, next, current),
    allowDownload: mergeKey("allowDownload", old, next, current),
    featured: mergeKey("featured", old, next, current),
    enableVerification: mergeKey("enableVerification", old, next, current),
  };
}

function edited(state: EditorState, values: EditorValues): EditorState {
  const reconciled = reconcileValues(state.category, values);
  return { ...state, values: reconciled.values, notice: reconciled.notice ?? state.notice };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "field": {
      const current = state.values.data[action.key];
      if (sameValue(current, action.value)) return state;
      return edited(state, { ...state.values, data: { ...state.values.data, [action.key]: action.value } });
    }
    case "base": {
      if (state.values[action.key] === action.value) return state;
      return edited(state, { ...state.values, [action.key]: action.value });
    }
    case "setting":
      return edited(state, { ...state.values, ...action.patch });
    case "rebase": {
      const baseline = createInitialValues(state.category, action.record);
      return {
        ...state,
        record: action.record,
        baseline,
        values: rebaseValues(state.baseline, baseline, state.values),
      };
    }
    case "reset": {
      const baseline = createInitialValues(state.category, action.record);
      return { ...state, record: action.record, baseline, values: baseline, notice: null };
    }
    case "dismissNotice":
      return state.notice === null ? state : { ...state, notice: null };
  }
}

/* ------------------------------------------------------------------ *
 * Dirty detection                                                     *
 * ------------------------------------------------------------------ */

export interface FileLike {
  name: string;
  size: number;
  type: string;
}

export interface PendingFiles {
  primary: FileLike | null;
  photo: FileLike | null;
  removePrimary: boolean;
  removePhoto: boolean;
}

export const NO_PENDING_FILES: PendingFiles = { primary: null, photo: null, removePrimary: false, removePhoto: false };

function normalised(value: EditorFieldValue | undefined): string | boolean | string[] {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((tag) => tag.trim());
  return value ?? "";
}

/**
 * A stable string for "what would be saved". Hidden fields are left out (they are not saved) and
 * text is trimmed (the server trims it), so typing a space or toggling a controller and back is
 * not an unsaved change.
 */
export function fingerprintValues(category: DocumentCategory, values: EditorValues): string {
  const spec = CATEGORIES[category];
  const visible = visibleFieldSet(category, values.data);
  const data: Record<string, string | boolean | string[]> = {};
  for (const field of spec.fields) {
    if (visible.has(field.key)) data[field.key] = normalised(values.data[field.key]);
  }
  return JSON.stringify([
    values.title.trim(),
    values.summary.trim(),
    values.holderName.trim(),
    values.referenceNo.trim(),
    values.issuedOn.trim(),
    values.expiresOn.trim(),
    values.status,
    values.visibility,
    values.allowDownload,
    values.featured,
    values.enableVerification,
    data,
  ]);
}

export function hasPendingFiles(pending: PendingFiles): boolean {
  return Boolean(pending.primary || pending.photo || pending.removePrimary || pending.removePhoto);
}

export function isEditorDirty(category: DocumentCategory, baseline: EditorValues, values: EditorValues, pending: PendingFiles): boolean {
  return hasPendingFiles(pending) || fingerprintValues(category, baseline) !== fingerprintValues(category, values);
}

/* ------------------------------------------------------------------ *
 * Files                                                               *
 * ------------------------------------------------------------------ */

export function existingFiles(files: readonly DocumentFileMeta[] | undefined): { primary: DocumentFileMeta | null; photo: DocumentFileMeta | null } {
  const list = files ?? [];
  return {
    primary: list.find((file) => file.role === "primary") ?? null,
    photo: list.find((file) => file.role === "photo") ?? null,
  };
}

/** After a pick: is the (possibly shrunk) photo small enough to store? */
export function photoSizeError(file: FileLike): string | null {
  if (file.size <= MAX_PHOTO_BYTES) return null;
  return `This photo is still ${formatBytes(file.size)} after shrinking. The limit is ${formatBytes(MAX_PHOTO_BYTES)}. Try a smaller picture.`;
}

/** Whether primary + photo + the form fit in one request (Vercel rejects bodies over ~4.5 MB). */
export function requestSizeError(primarySize: number, photoSize: number): string | null {
  const total = primarySize + photoSize + REQUEST_OVERHEAD_BYTES;
  if (total <= MAX_REQUEST_BYTES) return null;
  return `Together these files are ${formatBytes(primarySize + photoSize)}, and one save can carry up to ${formatBytes(
    MAX_REQUEST_BYTES - REQUEST_OVERHEAD_BYTES,
  )}. Save with one file first, then add the other.`;
}

/* ------------------------------------------------------------------ *
 * Admin URLs for a record's files and QR                              *
 * ------------------------------------------------------------------ */

/** Admin-only preview of a stored file, whatever the record's visibility. */
export function adminFileUrl(
  documentId: string,
  role: "primary" | "photo",
  options: { download?: boolean; version?: string } = {},
): string {
  // The file's hash doubles as a cache key, so a replaced photo is never shown from the browser cache.
  const version = options.version ? `&v=${encodeURIComponent(options.version.slice(0, 16))}` : "";
  const query = `role=${role}${options.download ? "&download=1" : ""}${version}`;
  return `/api/admin/documents/${encodeURIComponent(documentId)}/file?${query}`;
}

/** The QR as an image. Rendered by the server behind the admin session; the page never injects the SVG markup. */
export function adminQrUrl(
  documentId: string,
  format: "svg" | "png",
  options: { size?: number; download?: boolean; version?: string } = {},
): string {
  const size = options.size !== undefined ? `&size=${Math.min(1024, Math.max(128, Math.round(options.size)))}` : "";
  // The code goes in as a cache key: after "regenerate" the URL changes, so a stale QR is never shown from cache.
  const version = options.version ? `&v=${encodeURIComponent(options.version)}` : "";
  return `/api/admin/documents/${encodeURIComponent(documentId)}/qr?format=${format}${size}${options.download ? "&download=1" : ""}${version}`;
}

/* ------------------------------------------------------------------ *
 * Payload and FormData                                                *
 * ------------------------------------------------------------------ */

/** The `data` object that would be saved: visible fields only, empty values dropped, booleans always explicit. */
export function buildDataPayload(category: DocumentCategory, data: Record<string, EditorFieldValue>): Record<string, FieldValue> {
  const spec = CATEGORIES[category];
  const visible = visibleFieldSet(category, data);
  const out: Record<string, FieldValue> = {};
  for (const field of spec.fields) {
    if (!visible.has(field.key)) continue;
    const value = data[field.key];
    if (field.type === "boolean") {
      // Always explicit: the server treats an omitted boolean as "keep the default", not "off".
      out[field.key] = typeof value === "boolean" ? value : typeof field.defaultValue === "boolean" ? field.defaultValue : false;
    } else if (field.type === "tags") {
      if (Array.isArray(value) && value.length > 0) out[field.key] = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      out[field.key] = field.type === "number" && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : value;
    }
  }
  return out;
}

/**
 * The JSON `payload` part of the request, shaped like `DocumentInput`. Hidden base fields and
 * hidden category fields are left out. `status` is sent only when given: an edit that did not
 * touch the status must not re-apply a stale one.
 */
export function buildPayload(category: DocumentCategory, values: EditorValues, options: { status?: DocumentStatus } = {}): Record<string, unknown> {
  const spec = CATEGORIES[category];
  const payload: Record<string, unknown> = { category };
  for (const key of ["title", "summary", "holderName", "referenceNo"] as const) {
    if (!spec.base[key].hidden) payload[key] = values[key];
  }
  for (const key of ["issuedOn", "expiresOn"] as const) {
    if (!spec.base[key].hidden) payload[key] = values[key].trim() === "" ? null : values[key].trim();
  }
  payload.data = buildDataPayload(category, values.data);
  if (options.status !== undefined) payload.status = options.status;
  payload.visibility = values.visibility;
  payload.allowDownload = values.allowDownload;
  payload.featured = values.featured;
  payload.enableVerification = spec.verifiable ? values.enableVerification : false;
  return payload;
}

export interface FormDataInput {
  payload: Record<string, unknown>;
  primary?: (Blob & { name?: string }) | null;
  photo?: (Blob & { name?: string }) | null;
  removePrimary?: boolean;
  removePhoto?: boolean;
  expectedUpdatedAt?: string | null;
}

/** The multipart body exactly as the admin API contract describes it. */
export function buildFormData(input: FormDataInput): FormData {
  const form = new FormData();
  form.append("payload", JSON.stringify(input.payload));
  if (input.primary) form.append("primary", input.primary, input.primary.name || "document");
  if (input.photo) form.append("photo", input.photo, input.photo.name || "photo");
  // A replacement already overwrites the stored file, so "remove" is only meaningful on its own.
  if (input.removePrimary && !input.primary) form.append("removePrimary", "1");
  if (input.removePhoto && !input.photo) form.append("removePhoto", "1");
  if (input.expectedUpdatedAt) form.append("expectedUpdatedAt", input.expectedUpdatedAt);
  return form;
}

/** The primary button's wording in edit mode, so a status change is named instead of hidden behind "Update". */
export function updateLabel(baseline: DocumentStatus, next: DocumentStatus): string {
  if (next === baseline) return "Update";
  if (next === "published") return "Update and publish";
  if (next === "archived") return "Update and archive";
  return baseline === "published" ? "Update and unpublish" : "Update and restore";
}

/* ------------------------------------------------------------------ *
 * Client-side validation                                              *
 * ------------------------------------------------------------------ */

export interface SubmissionCheck {
  category: DocumentCategory;
  values: EditorValues;
  /** The status the record will have once this save lands. */
  targetStatus: DocumentStatus;
  /** Whether `status` is part of the payload (always for create, only when changed for edit). */
  sendStatus: boolean;
  pending: PendingFiles;
  /** Which files are already stored. */
  stored: { primary: boolean; photo: boolean };
  maxUploadBytes: number;
}

/**
 * Everything the server would object to that the browser can know first, keyed exactly like the
 * server's `fieldMessages` (`primary` and `photo` for uploads). Reuses `validateDocumentInput`, so
 * the wording and the keys are the server's own.
 */
export function validateSubmission(check: SubmissionCheck): Record<string, string> {
  const { category, values, targetStatus, pending, stored } = check;
  const spec = CATEGORIES[category];
  const payload = buildPayload(category, values, { status: check.sendStatus ? targetStatus : undefined });
  const result = validateDocumentInput(payload, { category });
  const errors: Record<string, string> = result.ok ? {} : { ...result.errors };

  const hasPrimary = Boolean(pending.primary) || (stored.primary && !pending.removePrimary);
  const hasPhoto = spec.hasPhoto && (Boolean(pending.photo) || (stored.photo && !pending.removePhoto));

  if (targetStatus === "published") {
    if (spec.fileRequired && !hasPrimary) errors.primary = "Upload the document file before publishing.";
    if (spec.photoRequired && !hasPhoto) errors.photo = "Upload a photo before publishing.";
  }

  if (pending.primary && pending.primary.size > check.maxUploadBytes) {
    errors.primary = `That file is ${formatBytes(pending.primary.size)}. The limit is ${formatBytes(check.maxUploadBytes)}.`;
  }
  if (pending.photo) {
    if (!spec.hasPhoto) errors.photo = "This kind of document does not carry a photo.";
    else {
      const tooBig = photoSizeError(pending.photo);
      if (tooBig) errors.photo = tooBig;
    }
  }
  if (!errors.primary && !errors.photo) {
    const together = requestSizeError(pending.primary?.size ?? 0, pending.photo?.size ?? 0);
    if (together) errors[pending.primary ? "primary" : "photo"] = together;
  }
  return errors;
}

/**
 * Resolves a `?category=` value (a slug like "certifications", or a key like "certification") to a category.
 * Anything else, including the slug and key of the retired ID card category, resolves to nothing, so a stale
 * link opens the plain category picker instead of a form for a category that no longer exists.
 */
export function resolveCategoryParam(value: string | undefined): CategorySpec | undefined {
  if (!value) return undefined;
  return categoryFromSlug(value) ?? (isDocumentCategory(value) ? CATEGORIES[value] : undefined);
}
