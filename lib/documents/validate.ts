import { CATEGORIES } from "./categories";
import type {
  BaseFieldSpec,
  CategorySpec,
  DocumentCategory,
  DocumentRecord,
  DocumentStatus,
  DocumentVisibility,
  FieldSpec,
  FieldValue,
  StampOptions,
} from "./types";
import {
  DEFAULT_STAMP_OPTIONS,
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  STAMP_PAGE_LABELS,
  STAMP_POSITION_LABELS,
  STAMP_SIZE_LABELS,
  isStampPages,
  isStampPosition,
  isStampSize,
} from "./types";

/**
 * Server-side validation for the document registry. Pure and isomorphic: it imports no Node API,
 * so the admin editor may reuse the same rules to hint at problems before a request is sent.
 *
 * Everything is derived from the category specs in ./categories.ts. The client is never trusted:
 * the editor's own checks are a convenience, these are the ones that count.
 */

/* ------------------------------------------------------------------ *
 * Public types                                                        *
 * ------------------------------------------------------------------ */

export type DocumentInput = {
  category: DocumentCategory;
  title: string;
  summary: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  allowDownload: boolean;
  featured: boolean;
  /** Integer within -9999..9999. */
  sortOrder: number;
  holderName: string;
  referenceNo: string;
  /** YYYY-MM-DD, or null. */
  issuedOn: string | null;
  expiresOn: string | null;
  /**
   * Ask for a QR verification code. The store only ever ADDS a code: once one has been printed
   * on a card or letter it must not silently stop resolving, so `false` never removes it
   * (use revoke, or make the record private, for that).
   */
  enableVerification: boolean;
  /**
   * The QR stamp on the uploaded file. `undefined` = the request said nothing, so stamping is left exactly
   * as it is; `null` = switched off (a stamped file goes back to the original); options = on, with a code.
   */
  stamp?: StampOptions | null;
  /** Only keys declared in the category spec, only fields currently visible, only non-empty values. */
  data: Record<string, FieldValue>;
};

export type ValidationResult =
  | { ok: true; value: DocumentInput }
  | { ok: false; errors: Record<string, string> };

export type PublishableResult = { ok: true } | { ok: false; errors: Record<string, string> };

/* ------------------------------------------------------------------ *
 * Limits                                                              *
 * ------------------------------------------------------------------ */

export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 600;
export const MAX_HOLDER_LENGTH = 160;
export const MAX_REFERENCE_LENGTH = 80;
export const MAX_TAGS = 12;
export const SORT_ORDER_LIMIT = 9999;

const DEFAULT_TEXT_LENGTH = 200;
const DEFAULT_TEXTAREA_LENGTH = 2000;
const DEFAULT_URL_LENGTH = 2048;
const DEFAULT_TAG_LENGTH = 40;
const EMAIL_MAX_LENGTH = 254;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

/** Field pairs whose second member must not precede the first. */
const DATE_PAIRS: ReadonlyArray<readonly [start: string, end: string]> = [
  ["period_start", "period_end"],
  ["start_date", "end_date"],
];

/* ------------------------------------------------------------------ *
 * Text hygiene                                                        *
 * ------------------------------------------------------------------ */

// C0 controls except tab/newline/carriage return, DEL, and the C1 block.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// Zero-width and bidirectional-formatting characters: invisible, so they let two different
// strings look identical (and U+202E reverses what a reader sees). Includes the soft hyphen.
const INVISIBLE_CHARACTERS = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

/** Drops unpaired UTF-16 surrogates, which Postgres cannot store and JSON.stringify escapes. */
function stripLoneSurrogates(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i += 1;
      }
    } else if (code < 0xdc00 || code > 0xdfff) {
      out += text[i];
    }
  }
  return out;
}

/**
 * Normalises free text for storage. Single-line text has its whitespace collapsed; multi-line text
 * keeps paragraph breaks (at most one blank line) and loses trailing spaces.
 */
export function cleanText(value: string, options: { multiline?: boolean } = {}): string {
  let text = stripLoneSurrogates(value).normalize("NFC").replace(CONTROL_CHARACTERS, "").replace(INVISIBLE_CHARACTERS, "");
  if (options.multiline) {
    return text
      .replace(/\r\n|\r|\u2028|\u2029/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  text = text.replace(/[\s\u2028\u2029]+/g, " ");
  return text.trim();
}

/** Length in characters as a person counts them (an emoji is one, not two UTF-16 units). */
function charLength(text: string): number {
  return Array.from(text).length;
}

/* ------------------------------------------------------------------ *
 * Scalar parsers                                                      *
 * ------------------------------------------------------------------ */

/** Returns the date when `value` is a real calendar day written YYYY-MM-DD, else null. */
export function parseIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? value : null;
}

const TRUE_WORDS = new Set(["true", "on", "yes", "1"]);
const FALSE_WORDS = new Set(["false", "off", "no", "0"]);

/** Accepts real booleans and the strings an HTML form or query string produces. */
export function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : undefined;
  if (typeof value !== "string") return undefined;
  const word = value.trim().toLowerCase();
  if (TRUE_WORDS.has(word)) return true;
  if (FALSE_WORDS.has(word)) return false;
  return undefined;
}

const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Returns the email with its domain lower-cased, or null when it is not syntactically valid. */
export function parseEmail(value: string): string | null {
  if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) return null;
  const at = value.lastIndexOf("@");
  if (at < 1 || at > 64) return null;
  return `${value.slice(0, at)}@${value.slice(at + 1).toLowerCase()}`;
}

/**
 * Returns the canonical href for a web URL, or null. Only http and https are accepted: a stored
 * `javascript:` or `data:` URL would become a script the moment a page renders it as a link.
 * Credentials in the URL are refused too (they are a phishing tell and leak into logs).
 */
export function parseHttpUrl(value: string): string | null {
  if (/\s/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password) return null;
  return url.href;
}

/* ------------------------------------------------------------------ *
 * Per-field parsing                                                   *
 * ------------------------------------------------------------------ */

type ParsedField = { kind: "empty" } | { kind: "value"; value: FieldValue } | { kind: "error"; message: string };

const EMPTY: ParsedField = { kind: "empty" };
const found = (v: FieldValue): ParsedField => ({ kind: "value", value: v });
const invalid = (message: string): ParsedField => ({ kind: "error", message });

function lengthError(max: number): string {
  return `Must be at most ${max} characters.`;
}

function parseText(raw: unknown, multiline: boolean, max: number): ParsedField {
  if (raw === undefined || raw === null) return EMPTY;
  let text: string;
  if (typeof raw === "string") text = raw;
  else if (typeof raw === "number" && Number.isFinite(raw)) text = String(raw);
  else return invalid("Enter text.");
  const cleaned = cleanText(text, { multiline });
  if (!cleaned) return EMPTY;
  if (charLength(cleaned) > max) return invalid(lengthError(max));
  return found(cleaned);
}

function parseSelect(raw: unknown, field: FieldSpec): ParsedField {
  const text = parseText(raw, false, DEFAULT_TEXT_LENGTH);
  if (text.kind !== "value") return text;
  const options = field.options;
  if (!options || options.length === 0) return text;
  return options.some((option) => option.value === text.value) ? text : invalid("Choose one of the listed options.");
}

function parseDateField(raw: unknown): ParsedField {
  if (raw === undefined || raw === null) return EMPTY;
  if (typeof raw !== "string") return invalid("Enter a date as YYYY-MM-DD.");
  const cleaned = cleanText(raw);
  if (!cleaned) return EMPTY;
  const date = parseIsoDate(cleaned);
  return date ? found(date) : invalid("Enter a real date as YYYY-MM-DD.");
}

function parseNumberField(raw: unknown, field: FieldSpec): ParsedField {
  if (raw === undefined || raw === null) return EMPTY;
  let number: number;
  if (typeof raw === "number") number = raw;
  else if (typeof raw === "string") {
    const cleaned = cleanText(raw);
    if (!cleaned) return EMPTY;
    if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return invalid("Enter a number.");
    number = Number(cleaned);
  } else return invalid("Enter a number.");
  if (!Number.isFinite(number)) return invalid("Enter a number.");
  const { min, max } = field;
  if (min !== undefined && max !== undefined && (number < min || number > max)) return invalid(`Must be between ${min} and ${max}.`);
  if (min !== undefined && number < min) return invalid(`Must be at least ${min}.`);
  if (max !== undefined && number > max) return invalid(`Must be at most ${max}.`);
  return found(number);
}

function parseUrlField(raw: unknown, field: FieldSpec): ParsedField {
  const text = parseText(raw, false, field.maxLength ?? DEFAULT_URL_LENGTH);
  if (text.kind !== "value") return text;
  const href = parseHttpUrl(String(text.value));
  return href ? found(href) : invalid("Enter a full web address starting with http:// or https://.");
}

function parseEmailField(raw: unknown, field: FieldSpec): ParsedField {
  const text = parseText(raw, false, field.maxLength ?? EMAIL_MAX_LENGTH);
  if (text.kind !== "value") return text;
  const email = parseEmail(String(text.value));
  return email ? found(email) : invalid("Enter a valid email address.");
}

function parseTagsField(raw: unknown, field: FieldSpec): ParsedField {
  if (raw === undefined || raw === null) return EMPTY;
  let pieces: string[];
  if (typeof raw === "string") pieces = [raw];
  else if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) pieces = raw as string[];
  else return invalid("Enter tags separated by commas.");

  const perTag = field.maxLength ?? DEFAULT_TAG_LENGTH;
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const piece of pieces) {
    for (const part of piece.split(",")) {
      const tag = cleanText(part);
      if (!tag) continue;
      if (charLength(tag) > perTag) return invalid(`Each tag must be at most ${perTag} characters.`);
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  if (tags.length === 0) return EMPTY;
  if (tags.length > MAX_TAGS) return invalid(`Use at most ${MAX_TAGS} tags.`);
  return found(tags);
}

function parseBooleanField(raw: unknown, field: FieldSpec): ParsedField {
  if (raw === undefined || raw === null || raw === "") return found(typeof field.defaultValue === "boolean" ? field.defaultValue : false);
  const parsed = parseBooleanLike(raw);
  return parsed === undefined ? invalid("Must be yes or no.") : found(parsed);
}

function parseField(field: FieldSpec, raw: unknown): ParsedField {
  switch (field.type) {
    case "text":
      return parseText(raw, false, field.maxLength ?? DEFAULT_TEXT_LENGTH);
    case "textarea":
      return parseText(raw, true, field.maxLength ?? DEFAULT_TEXTAREA_LENGTH);
    case "select":
      return parseSelect(raw, field);
    case "date":
      return parseDateField(raw);
    case "number":
      return parseNumberField(raw, field);
    case "boolean":
      return parseBooleanField(raw, field);
    case "tags":
      return parseTagsField(raw, field);
    case "url":
      return parseUrlField(raw, field);
    case "email":
      return parseEmailField(raw, field);
  }
}

/* ------------------------------------------------------------------ *
 * Conditional fields                                                  *
 * ------------------------------------------------------------------ */

type ValueMap = Record<string, FieldValue | undefined>;

/** A boolean field that was never answered counts as its default, exactly as the editor shows it. */
function effectiveValue(field: FieldSpec, values: ValueMap): FieldValue | undefined {
  const current = values[field.key];
  if (current !== undefined) return current;
  return field.type === "boolean" ? (typeof field.defaultValue === "boolean" ? field.defaultValue : false) : undefined;
}

/**
 * Which fields of a category are currently shown, given the values of the others.
 *
 * `showWhen` can chain (a controls b controls c), so a field is visible only when its controller
 * is visible too. A rule that points at a missing key, or that loops, hides the field: failing
 * closed means a typo in a spec can hide a field but never expose one.
 */
export function visibleFieldKeys(category: DocumentCategory, values: ValueMap): Set<string> {
  const fields = CATEGORIES[category].fields;
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const memo = new Map<string, boolean>();

  const visible = (field: FieldSpec, trail: Set<string>): boolean => {
    const known = memo.get(field.key);
    if (known !== undefined) return known;
    let result = true;
    if (field.showWhen) {
      const controller = byKey.get(field.showWhen.key);
      if (!controller || trail.has(field.key)) result = false;
      else {
        const nextTrail = new Set(trail).add(field.key);
        result = visible(controller, nextTrail) && effectiveValue(controller, values) === field.showWhen.equals;
      }
    }
    memo.set(field.key, result);
    return result;
  };

  return new Set(fields.filter((field) => visible(field, new Set())).map((field) => field.key));
}

/** True when `requiredWhen` is satisfied (the controller is visible and holds the trigger value). */
function requiredByCondition(spec: CategorySpec, field: FieldSpec, values: ValueMap, visibleKeys: Set<string>): boolean {
  const rule = field.requiredWhen;
  if (!rule || !visibleKeys.has(rule.key)) return false;
  const controller = spec.fields.find((candidate) => candidate.key === rule.key);
  return controller !== undefined && effectiveValue(controller, values) === rule.equals;
}

function isEmptyValue(v: FieldValue | undefined): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function fieldIsRequired(spec: CategorySpec, field: FieldSpec, values: ValueMap, visibleKeys: Set<string>): boolean {
  // A checkbox is always answered (unticked is "no"), so "required" cannot apply to it.
  if (field.type === "boolean") return false;
  return Boolean(field.required) || requiredByCondition(spec, field, values, visibleKeys);
}

/* ------------------------------------------------------------------ *
 * Base columns                                                        *
 * ------------------------------------------------------------------ */

type BaseKey = "title" | "summary" | "holderName" | "referenceNo" | "issuedOn" | "expiresOn";

const BASE_TEXT_LIMITS = {
  title: MAX_TITLE_LENGTH,
  summary: MAX_SUMMARY_LENGTH,
  holderName: MAX_HOLDER_LENGTH,
  referenceNo: MAX_REFERENCE_LENGTH,
} as const;

function requiredMessage(label: string): string {
  return `${label} is required.`;
}

function isPlainObject(candidate: unknown): candidate is Record<string, unknown> {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return false;
  const proto = Object.getPrototypeOf(candidate);
  return proto === Object.prototype || proto === null;
}

function has(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined;
}

/* ------------------------------------------------------------------ *
 * validateDocumentInput                                               *
 * ------------------------------------------------------------------ */

/**
 * Validates and normalises a create/update payload for one category.
 *
 * Update semantics when `existing` is given:
 *  - the workflow settings `status`, `visibility`, `allowDownload`, `featured`, `sortOrder` and
 *    `enableVerification` keep the existing record's value when omitted, because they are changed
 *    from list actions as often as from the editor and an editor that omits them must not reset them;
 *  - the content (`title`, `summary`, `holderName`, `referenceNo`, `issuedOn`, `expiresOn` and the
 *    whole `data` object) is replaced: omitted means empty, so send the complete form;
 *  - the category itself can never change.
 */
export function validateDocumentInput(
  raw: unknown,
  options: { category: DocumentCategory; existing?: DocumentRecord },
): ValidationResult {
  const spec = CATEGORIES[options.category];
  if (!spec) return { ok: false, errors: { category: "Unknown document category." } };
  if (!isPlainObject(raw)) return { ok: false, errors: { form: "The request body must be an object." } };

  const existing = options.existing;
  const errors: Record<string, string> = {};

  if (existing && existing.category !== options.category) {
    errors.category = "A document's category cannot be changed. Create a new document instead.";
  }
  if (has(raw, "category") && raw.category !== options.category) {
    errors.category = "The category does not match this document.";
  }

  /* ---- base text columns ---- */
  const text: Record<"title" | "summary" | "holderName" | "referenceNo", string> = {
    title: "",
    summary: "",
    holderName: "",
    referenceNo: "",
  };
  for (const key of ["title", "summary", "holderName", "referenceNo"] as const) {
    const base: BaseFieldSpec = spec.base[key];
    if (base.hidden) continue;
    const parsed = parseText(raw[key], key === "summary", BASE_TEXT_LIMITS[key]);
    if (parsed.kind === "error") errors[key] = parsed.message;
    else if (parsed.kind === "value") text[key] = String(parsed.value);
    else if (base.required) errors[key] = requiredMessage(base.label);
  }

  /* ---- base dates ---- */
  const dates: Record<"issuedOn" | "expiresOn", string | null> = { issuedOn: null, expiresOn: null };
  for (const key of ["issuedOn", "expiresOn"] as const) {
    const base = spec.base[key];
    if (base.hidden) continue;
    const parsed = parseDateField(raw[key]);
    if (parsed.kind === "error") errors[key] = parsed.message;
    else if (parsed.kind === "value") dates[key] = String(parsed.value);
    else if (base.required) errors[key] = requiredMessage(base.label);
  }
  if (dates.issuedOn && dates.expiresOn && dates.expiresOn < dates.issuedOn && !errors.expiresOn) {
    errors.expiresOn = "Must be on or after the issue date.";
  }

  /* ---- category fields ---- */
  const dataSource = isPlainObject(raw.data) ? raw.data : {};
  if (has(raw, "data") && !isPlainObject(raw.data)) errors.data = "Field values must be sent as an object.";

  const parsedFields = new Map<string, ParsedField>();
  const values: ValueMap = {};
  for (const field of spec.fields) {
    const parsed = parseField(field, dataSource[field.key]);
    parsedFields.set(field.key, parsed);
    if (parsed.kind === "value") values[field.key] = parsed.value;
  }

  const visibleKeys = visibleFieldKeys(options.category, values);
  const data: Record<string, FieldValue> = {};
  for (const field of spec.fields) {
    // A hidden field is cleared, and whatever the client sent for it (even garbage) is ignored.
    if (!visibleKeys.has(field.key)) continue;
    const parsed = parsedFields.get(field.key) ?? EMPTY;
    if (parsed.kind === "error") errors[field.key] = parsed.message;
    else if (parsed.kind === "value") data[field.key] = parsed.value;
    else if (fieldIsRequired(spec, field, values, visibleKeys)) errors[field.key] = requiredMessage(field.label);
  }

  for (const [startKey, endKey] of DATE_PAIRS) {
    const start = data[startKey];
    const end = data[endKey];
    if (typeof start === "string" && typeof end === "string" && end < start && !errors[endKey]) {
      const label = spec.fields.find((f) => f.key === endKey)?.label ?? "End";
      errors[endKey] = `${label} cannot be before the start.`;
    }
  }

  /* ---- workflow settings ---- */
  let status: DocumentStatus = existing?.status ?? "draft";
  if (has(raw, "status")) {
    const requested = typeof raw.status === "string" ? raw.status.trim() : "";
    if ((DOCUMENT_STATUSES as readonly string[]).includes(requested)) status = requested as DocumentStatus;
    else errors.status = "Choose Draft, Published or Archived.";
  }

  let visibility: DocumentVisibility = existing?.visibility ?? spec.defaultVisibility;
  if (has(raw, "visibility")) {
    const requested = typeof raw.visibility === "string" ? raw.visibility.trim() : "";
    if (!(DOCUMENT_VISIBILITIES as readonly string[]).includes(requested)) {
      errors.visibility = "Choose Public, Unlisted or Private.";
    } else if (!spec.allowedVisibility.includes(requested as DocumentVisibility)) {
      errors.visibility = `${spec.plural} cannot be ${requested}. Choose ${spec.allowedVisibility.join(" or ")}.`;
    } else {
      visibility = requested as DocumentVisibility;
    }
  } else if (!spec.allowedVisibility.includes(visibility)) {
    errors.visibility = `${spec.plural} cannot be ${visibility}. Choose ${spec.allowedVisibility.join(" or ")}.`;
  }

  // A personal record may be listed publicly only with the person's recorded consent.
  if (!errors.visibility && visibility === "public" && spec.personal && data.consent_to_publish !== true) {
    errors.visibility = "Listing a person publicly needs their consent. Confirm it, or choose Unlisted or Private.";
  }

  const flag = (key: "allowDownload" | "featured" | "enableVerification", fallback: boolean): boolean => {
    if (!has(raw, key)) return fallback;
    const parsed = parseBooleanLike(raw[key]);
    if (parsed === undefined) {
      errors[key] = "Must be yes or no.";
      return fallback;
    }
    return parsed;
  };
  const allowDownload = flag("allowDownload", existing?.allowDownload ?? false);
  const featured = flag("featured", existing?.featured ?? false);
  const enableVerification = flag("enableVerification", existing ? existing.verificationCode !== null : spec.verifiable);

  const stamp = parseStamp(raw, errors, enableVerification || existing?.verificationCode != null);

  let sortOrder = existing?.sortOrder ?? 0;
  if (has(raw, "sortOrder") && raw.sortOrder !== null && raw.sortOrder !== "") {
    const parsed = parseSortOrder(raw.sortOrder);
    if (parsed === null) errors.sortOrder = "Enter a whole number.";
    else sortOrder = parsed;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      category: options.category,
      title: text.title,
      summary: text.summary,
      status,
      visibility,
      allowDownload,
      featured,
      sortOrder,
      holderName: text.holderName,
      referenceNo: text.referenceNo,
      issuedOn: dates.issuedOn,
      expiresOn: dates.expiresOn,
      enableVerification,
      ...(stamp === undefined ? {} : { stamp }),
      data,
    },
  };
}

/**
 * The `stamp` setting of a save: `{ enabled, position?, size?, pages? }`. Absent keeps things as they are.
 * Switching it on needs a verification code, because the code is what gets printed on the file.
 */
function parseStamp(raw: Record<string, unknown>, errors: Record<string, string>, willHaveCode: boolean): StampOptions | null | undefined {
  if (!has(raw, "stamp")) return undefined;
  const value = raw.stamp;
  if (value === null || value === false) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    errors.stamp = "The QR stamp setting is not valid.";
    return undefined;
  }
  const settings = value as Record<string, unknown>;
  if (has(settings, "enabled") && parseBooleanLike(settings.enabled) !== true) return null;

  const pick = <T extends string>(key: string, valid: (v: unknown) => v is T, fallback: T, labels: Record<T, string>): T => {
    if (!has(settings, key) || settings[key] === undefined || settings[key] === null || settings[key] === "") return fallback;
    if (valid(settings[key])) return settings[key];
    errors.stamp = `Choose one of: ${Object.values(labels).join(", ")}.`;
    return fallback;
  };
  const options: StampOptions = {
    position: pick("position", isStampPosition, DEFAULT_STAMP_OPTIONS.position, STAMP_POSITION_LABELS),
    size: pick("size", isStampSize, DEFAULT_STAMP_OPTIONS.size, STAMP_SIZE_LABELS),
    pages: pick("pages", isStampPages, DEFAULT_STAMP_OPTIONS.pages, STAMP_PAGE_LABELS),
  };
  if (!willHaveCode) {
    errors.stamp = "The QR on the file needs a verification code. Turn on QR verification first, or turn the stamp off.";
  }
  return options;
}

function parseSortOrder(raw: unknown): number | null {
  let number: number;
  if (typeof raw === "number") number = raw;
  else if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) number = Number(raw.trim());
  else return null;
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null;
  return Math.min(SORT_ORDER_LIMIT, Math.max(-SORT_ORDER_LIMIT, number));
}

/* ------------------------------------------------------------------ *
 * validatePublishable                                                 *
 * ------------------------------------------------------------------ */

function baseValue(record: DocumentRecord, key: BaseKey): string | null {
  return record[key];
}

/**
 * Whether a stored record may go live. Checked again at publish time (not only at save) because
 * files are uploaded separately from fields, and because a category spec can tighten after a
 * record was saved. Error keys: a base field name, a data field key, `file`, `photo`.
 */
export function validatePublishable(record: DocumentRecord): PublishableResult {
  const spec: CategorySpec | undefined = CATEGORIES[record.category];
  if (!spec) return { ok: false, errors: { category: "Unknown document category." } };
  const errors: Record<string, string> = {};

  for (const key of ["title", "summary", "holderName", "referenceNo", "issuedOn", "expiresOn"] as const) {
    const base = spec.base[key];
    if (base.hidden || !base.required) continue;
    const present = (baseValue(record, key) ?? "").trim() !== "";
    if (!present) errors[key] = requiredMessage(base.label);
  }

  const values: ValueMap = record.data;
  const visibleKeys = visibleFieldKeys(record.category, values);
  for (const field of spec.fields) {
    if (!visibleKeys.has(field.key)) continue;
    if (fieldIsRequired(spec, field, values, visibleKeys) && isEmptyValue(values[field.key])) {
      errors[field.key] = requiredMessage(field.label);
    }
  }

  if (record.issuedOn && record.expiresOn && record.expiresOn < record.issuedOn) {
    errors.expiresOn = "Must be on or after the issue date.";
  }

  if (!spec.allowedVisibility.includes(record.visibility)) {
    errors.visibility = `${spec.plural} cannot be ${record.visibility}.`;
  } else if (spec.personal && record.visibility === "public" && record.data.consent_to_publish !== true) {
    errors.visibility = "Listing a person publicly needs their consent. Confirm it, or choose Unlisted or Private.";
  }

  if (spec.fileRequired && !record.files.some((file) => file.role === "primary")) {
    errors.file = "Upload the document file before publishing.";
  }
  if (spec.photoRequired && !record.files.some((file) => file.role === "photo")) {
    errors.photo = "Upload a photo before publishing.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}
