import { describe, expect, it } from "vitest";
import {
  CONSENT_FIELD_KEY,
  NO_PENDING_FILES,
  adminFileUrl,
  adminQrUrl,
  buildDataPayload,
  buildFormData,
  buildPayload,
  consentField,
  createEditorState,
  createInitialValues,
  editorReducer,
  evaluateFields,
  existingFiles,
  fingerprintValues,
  groupFields,
  isDocumentIdLike,
  isEditorDirty,
  photoSizeError,
  rebaseValues,
  reconcileValues,
  requestSizeError,
  resolveCategoryParam,
  statusOptions,
  toValueMap,
  updateLabel,
  validateSubmission,
  visibilityOptions,
  visibleFieldSet,
  type EditorValues,
  type PendingFiles,
} from "@/components/admin/editor/editorModel";
import { CATEGORIES, CATEGORY_LIST } from "@/lib/documents/categories";
import {
  MAX_PHOTO_BYTES,
  VISIBILITY_LABELS,
  type DocumentCategory,
  type DocumentFileMeta,
  type DocumentRecord,
} from "@/lib/documents/types";
import { validateDocumentInput } from "@/lib/documents/validate";
import { requirePhoto, setBooleanDefault } from "../helpers/specOverrides";

/**
 * The editor's pure logic. These tests pin the contract between the form and the server: what is
 * sent, what is checked first, and which settings may be combined.
 */

const ID = "0b9d3a52-6f5e-4c1a-9a53-1f2f7d0a4b11";

function makeRecord(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: ID,
    category,
    title: "A title",
    summary: "",
    status: "draft",
    visibility: CATEGORIES[category].defaultVisibility,
    allowDownload: false,
    featured: false,
    sortOrder: 0,
    holderName: "",
    referenceNo: "",
    issuedOn: null,
    expiresOn: null,
    verificationCode: null,
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    publishedAt: null,
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function fileMeta(role: "primary" | "photo", overrides: Partial<DocumentFileMeta> = {}): DocumentFileMeta {
  return {
    id: `f-${role}`,
    documentId: ID,
    role,
    filename: role === "primary" ? "report.pdf" : "face.jpg",
    mimeType: role === "primary" ? "application/pdf" : "image/jpeg",
    sizeBytes: 1000,
    sha256: "a".repeat(64),
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function withValues(category: DocumentCategory, patch: Partial<EditorValues>, data: EditorValues["data"] = {}): EditorValues {
  const base = createInitialValues(category);
  return { ...base, ...patch, data: { ...base.data, ...data } };
}

const noFiles: PendingFiles = { ...NO_PENDING_FILES };
const pdf = (size = 1000) => ({ name: "a.pdf", size, type: "application/pdf" });

/* ------------------------------------------------------------------ */

describe("createInitialValues", () => {
  it("starts a record with the category's own defaults", () => {
    const cert = createInitialValues("certification");
    expect(cert.status).toBe("draft");
    expect(cert.visibility).toBe("public");
    expect(cert.enableVerification).toBe(true);
    expect(cert.title).toBe("");

    const finance = createInitialValues("financial_report");
    expect(finance.visibility).toBe("private");
    expect(finance.enableVerification).toBe(false);
    expect(finance.allowDownload).toBe(true);

    const letter = createInitialValues("experience_letter");
    expect(letter.visibility).toBe("unlisted");
    expect(letter.allowDownload).toBe(false);
  });

  it("never defaults a personal record to downloadable", () => {
    for (const spec of CATEGORY_LIST.filter((candidate) => candidate.personal)) {
      expect(createInitialValues(spec.key).allowDownload).toBe(false);
    }
  });

  it("gives every field of every category an entry of the right shape", () => {
    for (const spec of CATEGORY_LIST) {
      const values = createInitialValues(spec.key);
      for (const field of spec.fields) {
        const value = values.data[field.key];
        if (field.type === "boolean") expect(typeof value, `${spec.key}.${field.key}`).toBe("boolean");
        else if (field.type === "tags") expect(Array.isArray(value), `${spec.key}.${field.key}`).toBe(true);
        else expect(value, `${spec.key}.${field.key}`).toBe("");
      }
    }
  });

  it("honours a boolean field's own default", () => {
    expect(createInitialValues("program_record").data.show_photo).toBe(false);
    expect(createInitialValues("program_record").data[CONSENT_FIELD_KEY]).toBe(false);

    // Every shipped boolean defaults to false, so a true default is switched on to prove the spec is read.
    const undo = setBooleanDefault("program_record", "show_photo", true);
    try {
      expect(createInitialValues("program_record").data.show_photo).toBe(true);
    } finally {
      undo();
    }
  });

  it("loads a stored record, tolerating missing and malformed values", () => {
    const record = makeRecord("certification", {
      title: "ISO 27001",
      holderName: "ACEVA",
      issuedOn: "2026-02-03",
      status: "published",
      allowDownload: true,
      verificationCode: "ACV-AAAA-BBBB-CCCC",
      data: { direction: "held", skills: ["a", "b"], level: 5 as unknown as string },
    });
    const values = createInitialValues("certification", record);
    expect(values.title).toBe("ISO 27001");
    expect(values.issuedOn).toBe("2026-02-03");
    expect(values.expiresOn).toBe("");
    expect(values.status).toBe("published");
    expect(values.enableVerification).toBe(true);
    expect(values.data.direction).toBe("held");
    expect(values.data.skills).toEqual(["a", "b"]);
    expect(values.data.level).toBe("5");
    expect(values.data.issuing_body).toBe("");
  });

  it("treats a boolean missing from an older record as its default", () => {
    expect(createInitialValues("program_record", makeRecord("program_record", { data: {} })).data.show_photo).toBe(false);

    const undo = setBooleanDefault("program_record", "show_photo", true);
    try {
      const values = createInitialValues("program_record", makeRecord("program_record", { data: {} }));
      expect(values.data.show_photo).toBe(true);
    } finally {
      undo();
    }
  });
});

describe("conditional fields", () => {
  it("shows a showWhen field only while its controller has the trigger value", () => {
    const off = createInitialValues("financial_report");
    expect(visibleFieldSet("financial_report", off.data).has("auditor")).toBe(false);
    const on = { ...off.data, audited: true };
    expect(visibleFieldSet("financial_report", on).has("auditor")).toBe(true);
  });

  it("evaluates requiredWhen live", () => {
    const data = { ...createInitialValues("financial_report").data };
    const required = (key: string) => evaluateFields("financial_report", data).find((state) => state.field.key === key)?.required;

    expect(required("period_start")).toBe(false);
    data.period = "custom";
    expect(required("period_start")).toBe(true);
    expect(required("period_end")).toBe(true);
    data.period = "full_year";
    expect(required("period_start")).toBe(false);

    data.audited = true;
    expect(required("auditor")).toBe(true);
  });

  it("uses the default of a boolean controller nobody has touched", () => {
    // currently_employed defaults to false, which is what makes end_date appear and be required.
    const states = evaluateFields("experience_letter", createInitialValues("experience_letter").data);
    const end = states.find((state) => state.field.key === "end_date");
    expect(end?.visible).toBe(true);
    expect(end?.required).toBe(true);

    const employed = evaluateFields("experience_letter", { ...createInitialValues("experience_letter").data, currently_employed: true });
    expect(employed.find((state) => state.field.key === "end_date")?.visible).toBe(false);
  });

  it("never marks a switch as required, and counts blank text as unanswered", () => {
    const states = evaluateFields("certification", createInitialValues("certification").data);
    expect(states.every((state) => state.field.type !== "boolean" || !state.required)).toBe(true);
    expect(toValueMap({ a: "  ", b: "x ", c: [], d: ["t"], e: false })).toEqual({ b: "x", d: ["t"], e: false });
  });

  it("agrees with the specs: every showWhen/requiredWhen rule points at a field of the same category", () => {
    for (const spec of CATEGORY_LIST) {
      const keys = new Set(spec.fields.map((field) => field.key));
      for (const field of spec.fields) {
        if (field.showWhen) expect(keys.has(field.showWhen.key), `${spec.key}.${field.key}`).toBe(true);
        if (field.requiredWhen) expect(keys.has(field.requiredWhen.key), `${spec.key}.${field.key}`).toBe(true);
      }
    }
  });
});

describe("groupFields", () => {
  it("groups by FieldSpec.group in order of first appearance", () => {
    expect(groupFields("financial_report").map((group) => group.title)).toEqual(["Report", "Assurance", "Internal"]);
    expect(groupFields("experience_letter").map((group) => group.title)).toEqual(["Employment", "Issuer", "Letter content", "Private contact", "Internal"]);
  });

  it("opens a team profile with the Position group, the level first", () => {
    const groups = groupFields("program_record");
    expect(groups[0].title).toBe("Position");
    expect(groups[0].fields.map((field) => field.key)).toEqual(["hierarchy_level", "reports_to", "role_title", "department", "record_kind"]);
    expect(groups.map((group) => group.title)).toEqual(["Position", "Program", "Dates & status", "Profile", "Private contact", "Consent", "Internal"]);
  });

  it("moves the consent switch out of the groups, and keeps every other field", () => {
    const grouped = groupFields("program_record").flatMap((group) => group.fields.map((field) => field.key));
    expect(grouped).not.toContain(CONSENT_FIELD_KEY);
    expect(grouped).toHaveLength(CATEGORIES.program_record.fields.length - 1);
    expect(groupFields("program_record").find((group) => group.title === "Consent")?.fields.map((f) => f.key)).toEqual(["show_photo"]);

    for (const spec of CATEGORY_LIST.filter((candidate) => !consentField(candidate))) {
      expect(groupFields(spec.key).flatMap((group) => group.fields)).toHaveLength(spec.fields.length);
    }
  });

  it("finds a consent field only for personal categories that declare one", () => {
    expect(consentField(CATEGORIES.program_record)?.key).toBe(CONSENT_FIELD_KEY);
    expect(consentField(CATEGORIES.certification)).toBeUndefined();
    // Personal, but with no consent switch of its own: it can never be public, so it never needs one.
    expect(CATEGORIES.experience_letter.personal).toBe(true);
    expect(consentField(CATEGORIES.experience_letter)).toBeUndefined();
  });
});

describe("reconcileValues", () => {
  it("steps a personal record down from Public when consent is not recorded, and says why", () => {
    const values = withValues("program_record", { visibility: "public" }, { [CONSENT_FIELD_KEY]: false });
    const result = reconcileValues("program_record", values);
    expect(result.values.visibility).toBe("unlisted");
    expect(result.notice).toMatch(/consent/i);
  });

  it("leaves Public alone once consent is given", () => {
    const values = withValues("program_record", { visibility: "public" }, { [CONSENT_FIELD_KEY]: true });
    const result = reconcileValues("program_record", values);
    expect(result.values.visibility).toBe("public");
    expect(result.notice).toBeNull();
  });

  it("does not interfere with non-personal categories", () => {
    const values = withValues("certification", { visibility: "public" });
    expect(reconcileValues("certification", values).values).toBe(values);
  });

  it("pulls a visibility the category does not allow back to its default", () => {
    const values = withValues("experience_letter", { visibility: "public" });
    expect(reconcileValues("experience_letter", values).values.visibility).toBe("unlisted");
  });

  it("switches QR verification off for categories that have none", () => {
    const values = withValues("financial_report", { enableVerification: true });
    expect(reconcileValues("financial_report", values).values.enableVerification).toBe(false);
  });
});

describe("visibility and status options", () => {
  it("offers only what the category allows, with the shared help text", () => {
    expect(visibilityOptions("certification", false).map((option) => option.value)).toEqual(["public", "unlisted", "private"]);
    expect(visibilityOptions("experience_letter", false).map((option) => option.value)).toEqual(["unlisted", "private"]);
    expect(visibilityOptions("experience_letter", true).map((option) => option.value)).toEqual(["unlisted", "private"]);
    for (const option of visibilityOptions("certification", false)) {
      expect(option.hint).toBe(VISIBILITY_LABELS[option.value].help);
      expect(option.label).toBe(VISIBILITY_LABELS[option.value].label);
    }
  });

  it("locks Public for a personal record until consent is recorded", () => {
    const locked = visibilityOptions("program_record", false);
    expect(locked.find((option) => option.value === "public")?.disabled).toBe(true);
    expect(locked.find((option) => option.value === "unlisted")?.disabled).toBe(false);
    expect(visibilityOptions("program_record", true).every((option) => !option.disabled)).toBe(true);
    expect(visibilityOptions("certification", false).every((option) => !option.disabled)).toBe(true);
  });

  it("lets a new record be a draft or published, and an existing one also archived", () => {
    expect(statusOptions("create").map((option) => option.value)).toEqual(["draft", "published"]);
    expect(statusOptions("edit").map((option) => option.value)).toEqual(["draft", "published", "archived"]);
  });

  it("names a status change on the button", () => {
    expect(updateLabel("draft", "draft")).toBe("Update");
    expect(updateLabel("draft", "published")).toBe("Update and publish");
    expect(updateLabel("published", "archived")).toBe("Update and archive");
    expect(updateLabel("published", "draft")).toBe("Update and unpublish");
    expect(updateLabel("archived", "draft")).toBe("Update and restore");
  });
});

describe("editorReducer", () => {
  it("changes a field without mutating the previous state", () => {
    const before = createEditorState("certification");
    const after = editorReducer(before, { type: "field", key: "issuing_body", value: "BSI" });
    expect(after.values.data.issuing_body).toBe("BSI");
    expect(before.values.data.issuing_body).toBe("");
    expect(after.baseline).toBe(before.baseline);
  });

  it("returns the same state object when nothing changed", () => {
    const state = createEditorState("certification");
    expect(editorReducer(state, { type: "field", key: "issuing_body", value: "" })).toBe(state);
    expect(editorReducer(state, { type: "base", key: "title", value: "" })).toBe(state);
    expect(editorReducer(state, { type: "dismissNotice" })).toBe(state);
  });

  it("withdrawing consent steps Public down and leaves a notice that can be dismissed", () => {
    let state = createEditorState("program_record");
    state = editorReducer(state, { type: "field", key: CONSENT_FIELD_KEY, value: true });
    state = editorReducer(state, { type: "setting", patch: { visibility: "public" } });
    expect(state.values.visibility).toBe("public");
    state = editorReducer(state, { type: "field", key: CONSENT_FIELD_KEY, value: false });
    expect(state.values.visibility).toBe("unlisted");
    expect(state.notice).toMatch(/consent/i);
    expect(editorReducer(state, { type: "dismissNotice" }).notice).toBeNull();
  });

  it("rebases onto a newer stored record: untouched values adopt it, edited values stay", () => {
    const published = makeRecord("certification", { status: "published", title: "Old title", summary: "old" });
    let state = createEditorState("certification", published);
    state = editorReducer(state, { type: "base", key: "title", value: "My edit" });

    // Meanwhile an action in the side panel archived it and someone fixed the summary.
    const archived = makeRecord("certification", {
      status: "archived",
      title: "Old title",
      summary: "new summary",
      updatedAt: "2026-02-02T00:00:00.000Z",
    });
    const next = editorReducer(state, { type: "rebase", record: archived });

    expect(next.values.title).toBe("My edit");
    expect(next.values.summary).toBe("new summary");
    expect(next.values.status).toBe("archived");
    expect(next.baseline.status).toBe("archived");
    expect(next.record).toBe(archived);
  });

  it("a rebase with nothing edited leaves the form clean", () => {
    const state = createEditorState("certification", makeRecord("certification"));
    const next = editorReducer(state, { type: "rebase", record: makeRecord("certification", { title: "Renamed", updatedAt: "2026-03-01T00:00:00.000Z" }) });
    expect(next.values.title).toBe("Renamed");
    expect(isEditorDirty("certification", next.baseline, next.values, noFiles)).toBe(false);
  });

  it("a reset throws away edits and adopts the stored record", () => {
    let state = createEditorState("certification", makeRecord("certification"));
    state = editorReducer(state, { type: "base", key: "title", value: "Unsaved" });
    const next = editorReducer(state, { type: "reset", record: makeRecord("certification", { title: "Stored" }) });
    expect(next.values.title).toBe("Stored");
    expect(isEditorDirty("certification", next.baseline, next.values, noFiles)).toBe(false);
  });

  it("rebaseValues merges field by field", () => {
    const old = createInitialValues("certification");
    const current = { ...old, title: "mine", data: { ...old.data, level: "L2" } };
    const next = { ...old, summary: "theirs", data: { ...old.data, level: "L9", issuing_body: "BSI" } };
    const merged = rebaseValues(old, next, current);
    expect(merged.title).toBe("mine");
    expect(merged.summary).toBe("theirs");
    expect(merged.data.level).toBe("L2");
    expect(merged.data.issuing_body).toBe("BSI");
  });
});

describe("dirty detection", () => {
  it("is clean until something is changed", () => {
    const state = createEditorState("certification", makeRecord("certification"));
    expect(isEditorDirty("certification", state.baseline, state.values, noFiles)).toBe(false);
  });

  it("notices a change and a change reverted", () => {
    const state = createEditorState("certification", makeRecord("certification"));
    const edited = editorReducer(state, { type: "base", key: "title", value: "Changed" });
    expect(isEditorDirty("certification", state.baseline, edited.values, noFiles)).toBe(true);
    const reverted = editorReducer(edited, { type: "base", key: "title", value: state.values.title });
    expect(isEditorDirty("certification", state.baseline, reverted.values, noFiles)).toBe(false);
  });

  it("ignores whitespace the server would trim", () => {
    const state = createEditorState("certification", makeRecord("certification", { title: "Same" }));
    const padded = editorReducer(state, { type: "base", key: "title", value: "  Same  " });
    expect(isEditorDirty("certification", state.baseline, padded.values, noFiles)).toBe(false);
  });

  it("ignores a hidden field, which is not saved", () => {
    const state = createEditorState("financial_report");
    const edited = editorReducer(state, { type: "field", key: "auditor", value: "Hidden while not audited" });
    expect(isEditorDirty("financial_report", state.baseline, edited.values, noFiles)).toBe(false);
    const shown = editorReducer(edited, { type: "field", key: "audited", value: true });
    expect(isEditorDirty("financial_report", state.baseline, shown.values, noFiles)).toBe(true);
  });

  it("counts a settings change, a tag change and pending files", () => {
    const state = createEditorState("certification");
    expect(isEditorDirty("certification", state.baseline, editorReducer(state, { type: "setting", patch: { featured: true } }).values, noFiles)).toBe(true);
    expect(isEditorDirty("certification", state.baseline, editorReducer(state, { type: "field", key: "skills", value: ["a"] }).values, noFiles)).toBe(true);
    expect(isEditorDirty("certification", state.baseline, state.values, { ...noFiles, primary: pdf() })).toBe(true);
    expect(isEditorDirty("certification", state.baseline, state.values, { ...noFiles, removePhoto: true })).toBe(true);
  });

  it("fingerprints are stable for equal content", () => {
    const a = createInitialValues("certification");
    const b = createInitialValues("certification");
    expect(fingerprintValues("certification", a)).toBe(fingerprintValues("certification", b));
  });
});

describe("buildPayload", () => {
  const filled = () =>
    withValues(
      "certification",
      {
        title: "ISO/IEC 27001",
        holderName: "ACEVA Technology",
        referenceNo: "ACV/CERT/2026/0042",
        issuedOn: "2026-01-10",
        expiresOn: "",
      },
      { direction: "held", issuing_body: "BSI", skills: ["security", "audit"], level: "  " },
    );

  it("is shaped like DocumentInput and passes the server's own validator", () => {
    const payload = buildPayload("certification", filled(), { status: "draft" });
    expect(payload).toMatchObject({
      category: "certification",
      title: "ISO/IEC 27001",
      issuedOn: "2026-01-10",
      expiresOn: null,
      status: "draft",
      visibility: "public",
      allowDownload: true,
      featured: false,
      enableVerification: true,
    });
    const result = validateDocumentInput(payload, { category: "certification" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.data).toEqual({ direction: "held", issuing_body: "BSI", skills: ["security", "audit"] });
  });

  it("sends the status only when it is given", () => {
    expect("status" in buildPayload("certification", filled())).toBe(false);
    expect(buildPayload("certification", filled(), { status: "published" }).status).toBe("published");
  });

  it("drops empty text and empty tag lists, but always sends booleans", () => {
    const data = buildDataPayload("certification", filled().data);
    expect(data).not.toHaveProperty("level");
    expect(data).not.toHaveProperty("standard_scope");
    expect(buildDataPayload("program_record", createInitialValues("program_record").data)).toMatchObject({ show_photo: false, [CONSENT_FIELD_KEY]: false });
    expect(buildDataPayload("financial_report", createInitialValues("financial_report").data)).toMatchObject({ audited: false });
  });

  it("leaves out fields the category hides and fields a condition hides", () => {
    const finance = buildPayload("financial_report", withValues("financial_report", { holderName: "ignored", expiresOn: "2030-01-01" }));
    expect(finance).not.toHaveProperty("holderName");
    expect(finance).not.toHaveProperty("expiresOn");
    expect(finance).toHaveProperty("title");

    const letter = buildPayload("experience_letter", createInitialValues("experience_letter"));
    expect(letter).not.toHaveProperty("summary");

    const hidden = buildDataPayload("financial_report", { ...createInitialValues("financial_report").data, audited: false, auditor: "Firm" });
    expect(hidden).not.toHaveProperty("auditor");
  });

  it("never asks for a QR on a category without one", () => {
    const values = withValues("financial_report", { enableVerification: true });
    expect(buildPayload("financial_report", values).enableVerification).toBe(false);
  });

  it("round-trips every category's blank form to exactly the errors the specs predict", () => {
    for (const spec of CATEGORY_LIST) {
      const result = validateDocumentInput(buildPayload(spec.key, createInitialValues(spec.key), { status: "draft" }), { category: spec.key });
      expect(result.ok, spec.key).toBe(false);
      if (result.ok) continue;
      const required = ["title", "holderName", "referenceNo", "issuedOn", "expiresOn", "summary"].filter((key) => {
        const base = spec.base[key as keyof typeof spec.base];
        return base.required && !base.hidden;
      });
      for (const key of required) expect(result.errors[key], `${spec.key}.${key}`).toBeTruthy();
      for (const field of spec.fields.filter((candidate) => candidate.required && candidate.type !== "boolean")) {
        expect(result.errors[field.key], `${spec.key}.${field.key}`).toBeTruthy();
      }
      // No error may name a control the form does not have.
      for (const key of Object.keys(result.errors)) {
        expect(["form", "category"].includes(key), `${spec.key}.${key}`).toBe(false);
      }
    }
  });
});

describe("buildFormData", () => {
  const file = (name: string, type: string) => new File(["bytes"], name, { type });

  it("carries the payload as JSON and nothing else by default", () => {
    const form = buildFormData({ payload: { category: "certification", title: "T" } });
    expect(JSON.parse(String(form.get("payload")))).toEqual({ category: "certification", title: "T" });
    expect([...form.keys()]).toEqual(["payload"]);
  });

  it("attaches the primary file and the photo under the contract's names", () => {
    const form = buildFormData({
      payload: {},
      primary: file("report.pdf", "application/pdf"),
      photo: file("face.jpg", "image/jpeg"),
      expectedUpdatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect((form.get("primary") as File).name).toBe("report.pdf");
    expect((form.get("photo") as File).name).toBe("face.jpg");
    expect(form.get("expectedUpdatedAt")).toBe("2026-01-02T00:00:00.000Z");
    expect(form.has("removePrimary")).toBe(false);
  });

  it("asks to remove a file only when no replacement is attached", () => {
    const alone = buildFormData({ payload: {}, removePrimary: true, removePhoto: true });
    expect(alone.get("removePrimary")).toBe("1");
    expect(alone.get("removePhoto")).toBe("1");

    const replaced = buildFormData({ payload: {}, primary: file("new.pdf", "application/pdf"), removePrimary: true });
    expect(replaced.has("removePrimary")).toBe(false);
    expect(replaced.has("primary")).toBe(true);
  });

  it("omits expectedUpdatedAt when creating", () => {
    expect(buildFormData({ payload: {}, expectedUpdatedAt: null }).has("expectedUpdatedAt")).toBe(false);
  });
});

describe("validateSubmission", () => {
  const base = {
    pending: noFiles,
    stored: { primary: false, photo: false },
    maxUploadBytes: 4_000_000,
    sendStatus: true,
  };

  it("reports the same keys the server would for a blank certification", () => {
    const errors = validateSubmission({ ...base, category: "certification", values: createInitialValues("certification"), targetStatus: "draft" });
    expect(Object.keys(errors).sort()).toEqual(["direction", "holderName", "issuedOn", "issuing_body", "referenceNo", "title"].sort());
  });

  it("asks for the document file only when publishing", () => {
    const values = withValues("company_identity", { title: "Certificate" }, { identity_type: "incorporation_certificate" });
    expect(validateSubmission({ ...base, category: "company_identity", values, targetStatus: "draft" })).toEqual({});
    expect(validateSubmission({ ...base, category: "company_identity", values, targetStatus: "published" }).primary).toMatch(/file/i);
  });

  it("counts a stored file unless the person is removing it", () => {
    const values = withValues("company_identity", { title: "Certificate" }, { identity_type: "incorporation_certificate" });
    const stored = { primary: true, photo: false };
    expect(validateSubmission({ ...base, stored, category: "company_identity", values, targetStatus: "published" })).toEqual({});
    const removing = validateSubmission({
      ...base,
      stored,
      pending: { ...noFiles, removePrimary: true },
      category: "company_identity",
      values,
      targetStatus: "published",
    });
    expect(removing.primary).toBeTruthy();
    const replacing = validateSubmission({
      ...base,
      stored,
      pending: { ...noFiles, removePrimary: true, primary: pdf() },
      category: "company_identity",
      values,
      targetStatus: "published",
    });
    expect(replacing.primary).toBeUndefined();
  });

  it("requires a photo to publish where the category asks for one", () => {
    const values = withValues(
      "program_record",
      { title: "Intern", holderName: "Aisha" },
      { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer", start_date: "2026-06-01", record_status: "active" },
    );
    // A people record may be published without a portrait: its category does not require one.
    expect(validateSubmission({ ...base, category: "program_record", values, targetStatus: "published" })).toEqual({});

    // No shipped category requires a photo, so the requirement is switched on for one category here.
    const undo = requirePhoto("program_record");
    try {
      expect(validateSubmission({ ...base, category: "program_record", values, targetStatus: "published" }).photo).toMatch(/photo/i);
      expect(validateSubmission({ ...base, category: "program_record", values, targetStatus: "draft" }).photo).toBeUndefined();
      expect(
        validateSubmission({ ...base, pending: { ...noFiles, photo: { name: "p.jpg", size: 1000, type: "image/jpeg" } }, category: "program_record", values, targetStatus: "published" }),
      ).toEqual({});
      // A stored photo counts, unless the person is removing it.
      const stored = { primary: false, photo: true };
      expect(validateSubmission({ ...base, stored, category: "program_record", values, targetStatus: "published" })).toEqual({});
      expect(
        validateSubmission({ ...base, stored, pending: { ...noFiles, removePhoto: true }, category: "program_record", values, targetStatus: "published" }).photo,
      ).toMatch(/photo/i);
    } finally {
      undo();
    }
  });

  it("refuses to list a person publicly without consent, with the server's wording", () => {
    const values = withValues(
      "program_record",
      { title: "Intern", holderName: "Aisha", visibility: "public" },
      { hierarchy_level: "trainee", role_title: "Frontend Intern", record_kind: "intern", program_name: "Summer", start_date: "2026-06-01", record_status: "active", [CONSENT_FIELD_KEY]: false },
    );
    const errors = validateSubmission({ ...base, category: "program_record", values, targetStatus: "draft" });
    expect(errors.visibility).toMatch(/consent/i);
  });

  it("checks upload sizes before anything is sent", () => {
    const values = withValues("company_identity", { title: "Certificate" }, { identity_type: "incorporation_certificate" });
    const tooBig = validateSubmission({ ...base, maxUploadBytes: 1_000_000, pending: { ...noFiles, primary: pdf(2_000_000) }, category: "company_identity", values, targetStatus: "draft" });
    expect(tooBig.primary).toMatch(/limit/i);

    const photoValues = withValues("program_record", { title: "x" });
    const photoTooBig = validateSubmission({
      ...base,
      pending: { ...noFiles, photo: { name: "p.jpg", size: MAX_PHOTO_BYTES + 1, type: "image/jpeg" } },
      category: "program_record",
      values: photoValues,
      targetStatus: "draft",
    });
    expect(photoTooBig.photo).toMatch(/limit/i);

    const together = validateSubmission({
      ...base,
      pending: { ...noFiles, primary: pdf(3_900_000), photo: { name: "p.jpg", size: 1_000_000, type: "image/jpeg" } },
      category: "program_record",
      values: photoValues,
      targetStatus: "draft",
    });
    expect(together.primary ?? together.photo).toMatch(/one save/i);
  });

  it("rejects a photo for a category that has none", () => {
    const values = withValues("certification", { title: "x" });
    const errors = validateSubmission({
      ...base,
      pending: { ...noFiles, photo: { name: "p.jpg", size: 10, type: "image/jpeg" } },
      category: "certification",
      values,
      targetStatus: "draft",
    });
    expect(errors.photo).toBeTruthy();
  });

  it("leaves status out of the check when the edit did not change it", () => {
    const values = withValues("certification", { title: "x" });
    const withStatus = validateSubmission({ ...base, sendStatus: true, category: "certification", values, targetStatus: "draft" });
    const without = validateSubmission({ ...base, sendStatus: false, category: "certification", values, targetStatus: "draft" });
    expect(withStatus.status).toBeUndefined();
    expect(without.status).toBeUndefined();
  });
});

describe("upload size helpers", () => {
  it("accepts a photo within the limit and explains one over it", () => {
    expect(photoSizeError({ name: "a.jpg", size: MAX_PHOTO_BYTES, type: "image/jpeg" })).toBeNull();
    expect(photoSizeError({ name: "a.jpg", size: MAX_PHOTO_BYTES + 1, type: "image/jpeg" })).toMatch(/smaller/i);
  });

  it("budgets the whole request, not just each file", () => {
    expect(requestSizeError(1_000_000, 500_000)).toBeNull();
    expect(requestSizeError(4_000_000, 1_000_000)).toMatch(/one save/i);
  });
});

describe("urls and small helpers", () => {
  it("builds admin file and QR urls with the document id encoded", () => {
    expect(adminFileUrl(ID, "photo")).toBe(`/api/admin/documents/${ID}/file?role=photo`);
    expect(adminFileUrl(ID, "primary", { download: true, version: "abcdef0123456789zzzz" })).toBe(
      `/api/admin/documents/${ID}/file?role=primary&download=1&v=abcdef0123456789`,
    );
    expect(adminQrUrl(ID, "svg")).toBe(`/api/admin/documents/${ID}/qr?format=svg`);
    expect(adminQrUrl(ID, "png", { size: 5000, download: true })).toBe(`/api/admin/documents/${ID}/qr?format=png&size=1024&download=1`);
    expect(adminQrUrl(ID, "svg", { size: 10, version: "ACV-A B" })).toBe(`/api/admin/documents/${ID}/qr?format=svg&size=128&v=ACV-A%20B`);
    expect(adminFileUrl("a/b?c", "photo")).toContain("a%2Fb%3Fc");
  });

  it("recognises document ids", () => {
    expect(isDocumentIdLike(ID)).toBe(true);
    expect(isDocumentIdLike("not-an-id")).toBe(false);
    expect(isDocumentIdLike(undefined)).toBe(false);
  });

  it("splits a record's files by role", () => {
    expect(existingFiles(undefined)).toEqual({ primary: null, photo: null });
    const files = [fileMeta("photo"), fileMeta("primary")];
    expect(existingFiles(files).primary?.role).toBe("primary");
    expect(existingFiles(files).photo?.role).toBe("photo");
  });

  it("resolves a category from a slug or a key", () => {
    expect(resolveCategoryParam("certifications")?.key).toBe("certification");
    expect(resolveCategoryParam("certification")?.key).toBe("certification");
    expect(resolveCategoryParam("team")?.key).toBe("program_record");
    expect(resolveCategoryParam("nope")).toBeUndefined();
    expect(resolveCategoryParam("")).toBeUndefined();
    expect(resolveCategoryParam(undefined)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * The QR stamp controls                                                *
 * ------------------------------------------------------------------ */

describe("the QR stamp in the form", () => {
  const CODE = "ACV-7K3M-9QXD-4TRH";
  const file = (stamp: DocumentFileMeta["stamp"]): DocumentFileMeta => ({
    id: "f1",
    documentId: ID,
    role: "primary",
    filename: "certificate.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    sha256: "a".repeat(64),
    createdAt: "2026-01-01T00:00:00.000Z",
    stamp,
  });

  it("starts ON for a new certificate, in the bottom-right corner", () => {
    const values = createInitialValues("certification");
    expect(values).toMatchObject({ enableVerification: true, stampEnabled: true, stampPosition: "bottom-right", stampSize: "medium", stampPages: "first" });
  });

  it("is never on for a category that is not verified by QR", () => {
    expect(createInitialValues("financial_report").stampEnabled).toBe(false);
    expect(createInitialValues("company_identity").stampEnabled).toBe(false);
  });

  it("starts OFF for a stored file that has no QR, so editing something else never changes the file", () => {
    const record = makeRecord("certification", { verificationCode: CODE, files: [file(null)] });
    expect(createInitialValues("certification", record).stampEnabled).toBe(false);
  });

  it("starts ON, in its own placement, for a stored file that carries the QR", () => {
    const stamp = { code: CODE, position: "top-left", size: "large", pages: "all", at: "2026-01-01T00:00:00.000Z" } as const;
    const record = makeRecord("certification", { verificationCode: CODE, files: [file(stamp)] });
    expect(createInitialValues("certification", record)).toMatchObject({ stampEnabled: true, stampPosition: "top-left", stampSize: "large", stampPages: "all" });
  });

  it("starts ON for a stored record that has a code but no file yet (one is about to be uploaded)", () => {
    const record = makeRecord("certification", { verificationCode: CODE, files: [] });
    expect(createInitialValues("certification", record).stampEnabled).toBe(true);
  });

  it("starts OFF for a stored record with no code, since there is nothing to print", () => {
    const record = makeRecord("certification", { verificationCode: null, files: [] });
    expect(createInitialValues("certification", record).stampEnabled).toBe(false);
  });

  it("is switched off when QR verification is switched off", () => {
    const state = createEditorState("certification");
    const off = editorReducer(state, { type: "setting", patch: { enableVerification: false } });
    expect(off.values.stampEnabled).toBe(false);
  });

  it("sends the choices when on, and an explicit off when not", () => {
    const on = buildPayload("certification", { ...createInitialValues("certification"), stampPosition: "top-right", stampSize: "small", stampPages: "last" });
    expect(on.stamp).toEqual({ enabled: true, position: "top-right", size: "small", pages: "last" });
    const off = buildPayload("certification", { ...createInitialValues("certification"), stampEnabled: false });
    expect(off.stamp).toEqual({ enabled: false });
    // Without a code there is nothing to print, so a stamp is never requested.
    const noCode = buildPayload("certification", { ...createInitialValues("certification"), enableVerification: false, stampEnabled: true });
    expect(noCode.stamp).toEqual({ enabled: false });
  });

  it("the payload it builds passes the server's own validation", () => {
    const values = {
      ...createInitialValues("certification"),
      title: "ISO/IEC 27001",
      holderName: "ACEVA",
      referenceNo: "ACV/CERT/1",
      issuedOn: "2026-01-10",
      data: { ...createInitialValues("certification").data, direction: "held", issuing_body: "BSI" },
    };
    const result = validateDocumentInput(buildPayload("certification", values), { category: "certification" });
    expect(result.ok, JSON.stringify(result.ok ? "" : result.errors)).toBe(true);
    if (result.ok) expect(result.value.stamp).toMatchObject({ position: "bottom-right", size: "medium", pages: "first" });
  });

  it("counts a change of corner as unsaved only while the stamp is on", () => {
    const state = createEditorState("certification");
    const moved = editorReducer(state, { type: "setting", patch: { stampPosition: "top-left" } });
    expect(isEditorDirty("certification", state.baseline, moved.values, NO_PENDING_FILES)).toBe(true);

    const offState = editorReducer(state, { type: "setting", patch: { stampEnabled: false } });
    const offMoved = editorReducer(offState, { type: "setting", patch: { stampPosition: "top-left" } });
    expect(fingerprintValues("certification", offMoved.values)).toBe(fingerprintValues("certification", offState.values));
  });

  it("keeps an untouched stamp setting when the stored record changes underneath the form", () => {
    const old = createInitialValues("certification");
    const mine = { ...old, stampPosition: "top-left" as const };
    const next = { ...old, stampSize: "large" as const };
    const merged = rebaseValues(old, next, mine);
    expect(merged.stampPosition).toBe("top-left");
    expect(merged.stampSize).toBe("large");
  });
});
