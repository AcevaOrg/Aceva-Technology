"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentCategory, DocumentRecord, DocumentStatus } from "@/lib/documents/types";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";
import ui from "../admin.module.css";
import { Button, ButtonLink } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { ActionBar } from "../FormSection";
import { useObjectUrl } from "../hooks";
import { resizeImageFile } from "../imageResize";
import { AlertIcon, InfoIcon } from "../icons";
import { useToast } from "../Toast";
import { cx } from "../utils";
import { BasicsSection } from "./BasicsSection";
import { CategorySections } from "./CategorySections";
import ed from "./editor.module.css";
import { requestJson, sendForm } from "./editorApi";
import {
  controlDomId,
  interpretSaveResponse,
  mapFieldMessages,
  readDocument,
  readSuggestion,
  summariseErrors,
  type ErrorContext,
} from "./editorErrors";
import {
  CONSENT_FIELD_KEY,
  PHOTO_MAX_EDGE,
  PHOTO_QUALITY,
  adminFileUrl,
  buildFormData,
  buildPayload,
  createEditorState,
  editorReducer,
  existingFiles,
  isDocumentIdLike,
  isEditorDirty,
  photoSizeError,
  updateLabel,
  validateSubmission,
  type EditorBaseKey,
  type EditorFieldValue,
  type EditorMode,
  type EditorSettingKey,
  type EditorValues,
} from "./editorModel";
import { formatDateTimeUtc, type PreviewFile } from "./editorPreview";
import { FilesSection } from "./FilesSection";
import { focusControl } from "./focusControl";
import { LivePreview } from "./LivePreview";
import { PublishingSection } from "./PublishingSection";
import { useUnsavedChangesGuard } from "./useUnsavedGuard";

type Intent = "draft" | "publish" | "update";

interface PendingFileState {
  primary: File | null;
  photo: File | null;
  removePrimary: boolean;
  removePhoto: boolean;
}

const NO_FILES: PendingFileState = { primary: null, photo: null, removePrimary: false, removePhoto: false };

type Banner =
  | { kind: "error"; text: string }
  | { kind: "warn"; text: string }
  | { kind: "conflict"; text: string }
  | { kind: "signed_out"; text: string };

export interface DocumentEditorProps {
  mode: EditorMode;
  category: DocumentCategory;
  /** The stored record. Required in edit mode; a newer version handed down later is merged in. */
  record?: DocumentRecord | null;
  /** The per-file cap from `getMaxUploadBytes()`, worked out on the server. */
  maxUploadBytes: number;
  /** Where Cancel goes. */
  cancelHref: string;
  /** Extra panels under the preview, such as the VerificationPanel. */
  aside?: ReactNode;
}

/**
 * The create / edit form for every document category. What it shows comes from
 * lib/documents/categories.ts, and what it checks before sending comes from the same
 * `validateDocumentInput` the server runs, so the form cannot drift from validation.
 *
 * Performance: one reducer holds the answers; every field is a memoised leaf that gets a single stable
 * `onChange`, so a keystroke re-renders its own field and the (deferred) preview, nothing else.
 */
export function DocumentEditor({ mode, category, record = null, maxUploadBytes, cancelHref, aside }: DocumentEditorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const spec = CATEGORIES[category];

  const [state, dispatch] = useReducer(editorReducer, undefined, () => createEditorState(category, record));
  const [files, setFiles] = useState<PendingFileState>(NO_FILES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState<Intent | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [confirmPrivatePublish, setConfirmPrivatePublish] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ key: string; token: number } | null>(null);
  const savingRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusToken = useRef(0);

  // A newer stored version arrives (an action in the side panel, or the refresh after a save): merge it in
  // instead of remounting, so nothing the person is typing is lost.
  const [seenStamp, setSeenStamp] = useState(record?.updatedAt ?? null);
  if (record && record.updatedAt !== seenStamp) {
    setSeenStamp(record.updatedAt);
    dispatch({ type: "rebase", record });
  }

  const { values, baseline } = state;
  const stored = useMemo(() => existingFiles(state.record?.files), [state.record]);
  const hasCode = Boolean(state.record?.verificationCode);
  const documentId = state.record?.id ?? null;
  const dirty = useMemo(() => isEditorDirty(category, baseline, values, files), [category, baseline, values, files]);
  const guard = useUnsavedChangesGuard(dirty);
  const { release: releaseGuard } = guard;
  const errorContext = useMemo<ErrorContext>(() => ({ mode, verificationSwitch: spec.verifiable && !hasCode }), [mode, spec.verifiable, hasCode]);
  const locked = saving !== null || navigating;

  /* ---------------------------- field handlers (stable) ---------------------------- */

  const clearError = useCallback((key: string) => {
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, []);

  const onField = useCallback(
    (key: string, value: EditorFieldValue) => {
      dispatch({ type: "field", key, value });
      clearError(key);
      // Ticking consent is what unlocks Public, so a stale visibility complaint goes with it.
      if (key === CONSENT_FIELD_KEY) clearError("visibility");
    },
    [clearError],
  );

  const onBase = useCallback(
    (key: EditorBaseKey, value: string) => {
      dispatch({ type: "base", key, value });
      clearError(key);
    },
    [clearError],
  );

  const onSetting = useCallback(
    (patch: Partial<Pick<EditorValues, EditorSettingKey>>) => {
      dispatch({ type: "setting", patch });
      for (const key of Object.keys(patch)) clearError(key);
    },
    [clearError],
  );

  const onDismissNotice = useCallback(() => dispatch({ type: "dismissNotice" }), []);

  const onPrimaryChange = useCallback(
    (file: File | null) => {
      setFiles((previous) => ({ ...previous, primary: file, removePrimary: file ? false : previous.removePrimary }));
      clearError("primary");
    },
    [clearError],
  );

  const onRemovePrimary = useCallback(
    (remove: boolean) => {
      setFiles((previous) => ({ ...previous, removePrimary: remove, primary: remove ? null : previous.primary }));
      clearError("primary");
    },
    [clearError],
  );

  const onRemovePhoto = useCallback(
    (remove: boolean) => {
      setFiles((previous) => ({ ...previous, removePhoto: remove, photo: remove ? null : previous.photo }));
      clearError("photo");
    },
    [clearError],
  );

  const pickPhoto = useCallback(
    async (file: File | null) => {
      clearError("photo");
      if (!file) {
        setFiles((previous) => ({ ...previous, photo: null }));
        return;
      }
      setPhotoBusy(true);
      // A phone picture is routinely larger than the stored limit; shrinking it here is what makes it fit.
      const shrunk = await resizeImageFile(file, { maxEdge: PHOTO_MAX_EDGE, quality: PHOTO_QUALITY, mimeType: "image/jpeg" });
      setPhotoBusy(false);
      const problem = photoSizeError(shrunk);
      if (problem) {
        setErrors((previous) => ({ ...previous, photo: problem }));
        return;
      }
      setFiles((previous) => ({ ...previous, photo: shrunk, removePhoto: false }));
    },
    [clearError],
  );
  const onPhotoChange = useCallback((file: File | null) => void pickPhoto(file), [pickPhoto]);

  const suggest = useCallback(async () => {
    setSuggesting(true);
    const result = await requestJson({ url: `/api/admin/documents/next-reference?category=${encodeURIComponent(category)}`, method: "GET" });
    setSuggesting(false);
    const suggestion = result.kind === "response" ? readSuggestion(result.status, result.body) : null;
    if (suggestion) {
      onBase("referenceNo", suggestion);
      toast.info(`Suggested ${suggestion}`);
    } else {
      toast.error("Could not suggest a reference number", { description: "Type one in, or try again in a moment." });
    }
  }, [category, onBase, toast]);
  const onSuggest = useCallback(() => void suggest(), [suggest]);

  /* ---------------------------- errors and focus ---------------------------- */

  const showErrors = useCallback(
    (messages: Record<string, string>, fallback?: string) => {
      const mapped = mapFieldMessages(category, messages, errorContext);
      setErrors(mapped.fields);
      const extra = mapped.order.length === 0 && mapped.general.length === 0 && fallback ? [fallback] : [];
      setGeneral([...mapped.general, ...extra]);
      focusToken.current += 1;
      setFocusRequest({ key: mapped.order[0] ?? "", token: focusToken.current });
    },
    [category, errorContext],
  );

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.key && focusControl(controlDomId(category, focusRequest.key))) return;
    summaryRef.current?.focus();
  }, [focusRequest, category]);

  /* ---------------------------- saving ---------------------------- */

  const finishCreate = useCallback(
    (document: DocumentRecord) => {
      setNavigating(true);
      releaseGuard();
      router.replace(isDocumentIdLike(document.id) ? adminDocumentRoute(document.id) : ADMIN_ROUTES.documents);
    },
    [releaseGuard, router],
  );

  const submit = useCallback(
    async (intent: Intent) => {
      if (savingRef.current || navigating || photoBusy) return;
      const targetStatus: DocumentStatus = intent === "publish" ? "published" : intent === "draft" ? "draft" : values.status;
      // An edit that did not touch the status leaves it out, so a stale value can never re-apply itself.
      const sendStatus = mode === "create" || values.status !== baseline.status;

      const problems = validateSubmission({
        category,
        values,
        targetStatus,
        sendStatus,
        pending: files,
        stored: { primary: Boolean(stored.primary), photo: Boolean(stored.photo) },
        maxUploadBytes,
      });
      setBanner(null);
      if (Object.keys(problems).length > 0) {
        showErrors(problems);
        return;
      }

      setErrors({});
      setGeneral([]);
      savingRef.current = true;
      setSaving(intent);
      setProgress(null);

      const payload = buildPayload(category, values, { status: sendStatus ? targetStatus : undefined });
      const body = buildFormData({
        payload,
        primary: files.primary,
        photo: files.photo,
        removePrimary: files.removePrimary,
        removePhoto: files.removePhoto,
        expectedUpdatedAt: state.record?.updatedAt ?? null,
      });
      const target = state.record;
      const result = await sendForm({
        url: mode === "create" || !target ? "/api/admin/documents" : `/api/admin/documents/${encodeURIComponent(target.id)}`,
        method: mode === "create" || !target ? "POST" : "PATCH",
        body,
        onProgress: setProgress,
      });
      savingRef.current = false;
      setSaving(null);
      setProgress(null);

      if (result.kind === "aborted") return;
      if (result.kind === "network") {
        setBanner({ kind: "error", text: "Could not reach the server. Your edits are still here: check your connection and try again." });
        return;
      }

      const outcome = interpretSaveResponse(result.status, result.body);
      switch (outcome.type) {
        case "saved": {
          setErrors({});
          setGeneral([]);
          toast.success(intent === "publish" ? "Published" : intent === "draft" ? "Draft saved" : "Changes saved");
          if (mode === "create") {
            finishCreate(outcome.document);
          } else {
            dispatch({ type: "reset", record: outcome.document });
            setSeenStamp(outcome.document.updatedAt);
            setFiles(NO_FILES);
            router.refresh();
          }
          return;
        }
        case "invalid":
          showErrors(outcome.fieldMessages, outcome.message);
          return;
        case "conflict":
          setBanner({
            kind: "conflict",
            text: "Someone else changed this document after you opened it. Load the latest version to continue; your unsaved edits will be replaced.",
          });
          return;
        case "signed_out":
          setBanner({ kind: "signed_out", text: outcome.message });
          return;
        case "rate_limited":
          setBanner({ kind: "warn", text: outcome.message });
          return;
        case "too_large":
        case "not_found":
        case "failed":
          setBanner({ kind: "error", text: outcome.message });
          return;
      }
    },
    [
      baseline.status,
      category,
      files,
      finishCreate,
      maxUploadBytes,
      mode,
      navigating,
      photoBusy,
      router,
      showErrors,
      state.record,
      stored.photo,
      stored.primary,
      toast,
      values,
    ],
  );

  const requestPublish = useCallback(() => {
    // A published record that is also Private is visible to nobody: worth a second look before it happens.
    if (values.visibility === "private") setConfirmPrivatePublish(true);
    else void submit("publish");
  }, [submit, values.visibility]);

  const loadLatest = useCallback(async () => {
    if (!state.record) return;
    const result = await requestJson({ url: `/api/admin/documents/${encodeURIComponent(state.record.id)}`, method: "GET" });
    const latest = result.kind === "response" && result.status === 200 && result.body && typeof result.body === "object" ? readDocument((result.body as Record<string, unknown>).document) : null;
    if (!latest) {
      setBanner({ kind: "error", text: "Could not load the latest version. Check your connection and try again." });
      return;
    }
    dispatch({ type: "reset", record: latest });
    setSeenStamp(latest.updatedAt);
    setFiles(NO_FILES);
    setErrors({});
    setGeneral([]);
    setBanner(null);
    toast.info("Loaded the latest version.");
    router.refresh();
  }, [router, state.record, toast]);

  /* ---------------------------- preview inputs ---------------------------- */

  const deferredValues = useDeferredValue(values);
  const photoObjectUrl = useObjectUrl(files.photo);
  const keptPrimary = files.removePrimary ? null : stored.primary;
  const keptPhoto = files.removePhoto ? null : stored.photo;

  const primaryPreview = useMemo<PreviewFile | null>(() => {
    if (files.primary) return { filename: files.primary.name, mimeType: files.primary.type || "application/octet-stream", sizeBytes: files.primary.size };
    return keptPrimary ? { filename: keptPrimary.filename, mimeType: keptPrimary.mimeType, sizeBytes: keptPrimary.sizeBytes } : null;
  }, [files.primary, keptPrimary]);

  const photoPreview = useMemo<PreviewFile | null>(() => {
    if (!spec.hasPhoto) return null;
    if (files.photo) return { filename: files.photo.name, mimeType: files.photo.type || "image/jpeg", sizeBytes: files.photo.size };
    return keptPhoto ? { filename: keptPhoto.filename, mimeType: keptPhoto.mimeType, sizeBytes: keptPhoto.sizeBytes } : null;
  }, [files.photo, keptPhoto, spec.hasPhoto]);

  const photoUrl = files.photo ? photoObjectUrl : keptPhoto && documentId ? adminFileUrl(documentId, "photo", { version: keptPhoto.sha256 }) : null;
  const willHaveCode = hasCode || (spec.verifiable && values.enableVerification);

  /* ---------------------------- render ---------------------------- */

  const summary = useMemo(() => summariseErrors(category, mapFieldMessages(category, errors, errorContext)), [errors, category, errorContext]);
  const problemCount = summary.length + general.length;
  const primaryLabel = mode === "edit" ? updateLabel(baseline.status, values.status) : "Publish";
  const stamp = formatDateTimeUtc(state.record?.updatedAt);

  const statusNode: ReactNode = navigating
    ? "Saved. Opening the record…"
    : saving
      ? progress !== null && (files.primary || files.photo)
        ? `Uploading ${Math.round(progress * 100)}%…`
        : "Saving…"
      : dirty
        ? "Unsaved changes"
        : mode === "edit" && stamp
          ? `Saved ${stamp}`
          : "No changes yet";

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Enter in a field saves quietly (a draft, or the edit as chosen). Going live is always a deliberate click.
    void submit(mode === "create" ? "draft" : "update");
  };

  return (
    <>
      <div className={ui.split}>
        <form className={ed.main} noValidate onSubmit={onFormSubmit} aria-busy={locked || undefined} aria-label={mode === "create" ? `New ${spec.label.toLowerCase()}` : `Edit ${spec.label.toLowerCase()}`}>
          {banner ? (
            <div className={ed.banner} data-tone={banner.kind === "error" ? "error" : "warn"} role={banner.kind === "error" ? "alert" : "status"}>
              <AlertIcon width={18} height={18} />
              <p>{banner.text}</p>
              {banner.kind === "conflict" ? (
                <Button size="sm" variant="ghost" shine={false} onClick={() => void loadLatest()}>
                  Load latest version
                </Button>
              ) : null}
              {banner.kind === "signed_out" ? (
                <ButtonLink href={`${ADMIN_ROUTES.login}?next=${encodeURIComponent(pathname || ADMIN_ROUTES.documents)}`} external size="sm" variant="ghost">
                  Sign in again
                </ButtonLink>
              ) : null}
            </div>
          ) : null}

          {problemCount > 0 ? (
            <div ref={summaryRef} tabIndex={-1} className={ed.summary} role="alert">
              <p className={ed.summaryTitle}>
                <InfoIcon width={16} height={16} />
                {problemCount === 1 ? "One thing needs your attention." : `${problemCount} things need your attention.`}
              </p>
              <ul>
                {summary.map((entry) => (
                  <li key={entry.key}>
                    <button type="button" className={ed.summaryLink} onClick={() => focusControl(controlDomId(category, entry.key))}>
                      {entry.label}
                    </button>
                    <span>{entry.message}</span>
                  </li>
                ))}
                {general.map((message) => (
                  <li key={message}>
                    <span>{message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className={ed.lock} disabled={locked}>
            <div className={cx(ui.formSections, ui.stagger)}>
              <BasicsSection category={category} values={values} errors={errors} onChange={onBase} onSuggest={onSuggest} suggesting={suggesting} />
              <CategorySections category={category} data={values.data} errors={errors} onChange={onField} />
              <FilesSection
                category={category}
                documentId={documentId}
                stored={stored}
                primary={files.primary}
                photo={files.photo}
                removePrimary={files.removePrimary}
                removePhoto={files.removePhoto}
                photoBusy={photoBusy}
                maxUploadBytes={maxUploadBytes}
                errors={errors}
                stamp={
                  spec.verifiable
                    ? {
                        enabled: values.stampEnabled,
                        position: values.stampPosition,
                        size: values.stampSize,
                        pages: values.stampPages,
                        hasCode: willHaveCode,
                        currentCode: state.record?.verificationCode ?? null,
                      }
                    : null
                }
                onSetting={onSetting}
                onPrimaryChange={onPrimaryChange}
                onPhotoChange={onPhotoChange}
                onRemovePrimary={onRemovePrimary}
                onRemovePhoto={onRemovePhoto}
              />
              <PublishingSection
                category={category}
                mode={mode}
                hasCode={hasCode}
                status={values.status}
                visibility={values.visibility}
                allowView={values.allowView}
                allowDownload={values.allowDownload}
                featured={values.featured}
                enableVerification={values.enableVerification}
                consent={values.data[CONSENT_FIELD_KEY] === true}
                notice={state.notice}
                errors={errors}
                onSetting={onSetting}
                onField={onField}
                onDismissNotice={onDismissNotice}
              />
            </div>
          </fieldset>

          <ActionBar
            dirty={dirty && !locked}
            status={
              <>
                {statusNode}
                {saving && progress !== null && (files.primary || files.photo) ? (
                  <span
                    className={ed.progress}
                    role="progressbar"
                    aria-label="Upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <span className={ed.progressFill} style={{ "--p": progress } as CSSProperties} />
                  </span>
                ) : null}
              </>
            }
          >
            <ButtonLink href={cancelHref} variant="quiet">
              Cancel
            </ButtonLink>
            {mode === "create" ? (
              <>
                <Button type="submit" variant="ghost" loading={saving === "draft"} disabled={locked || photoBusy}>
                  Save draft
                </Button>
                <Button className={ed.shineIdle} loading={saving === "publish"} disabled={locked || photoBusy} onClick={requestPublish}>
                  Publish
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                className={values.status !== baseline.status ? ed.shineIdle : undefined}
                loading={saving === "update"}
                disabled={locked || photoBusy}
              >
                {primaryLabel}
              </Button>
            )}
          </ActionBar>
        </form>

        <aside className={cx(ui.splitAside, ed.aside)} aria-label="Preview and record tools">
          <LivePreview
            category={category}
            values={deferredValues}
            stored={state.record}
            primary={primaryPreview}
            photo={photoPreview}
            photoUrl={photoUrl}
            willHaveCode={willHaveCode}
          />
          {aside}
        </aside>
      </div>

      <ConfirmDialog
        open={guard.pendingHref !== null}
        tone="danger"
        title="Leave without saving?"
        body="You have unsaved changes on this page. If you leave now, they are lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={guard.confirmLeave}
        onCancel={guard.stay}
      />

      <ConfirmDialog
        open={confirmPrivatePublish}
        title="Publish as Private?"
        body="Private records are visible only in this console, so visitors still will not see this one. Publish anyway, or go back and choose Unlisted or Public."
        confirmLabel="Publish anyway"
        cancelLabel="Go back"
        onConfirm={() => {
          setConfirmPrivatePublish(false);
          void submit("publish");
        }}
        onCancel={() => setConfirmPrivatePublish(false)}
      />
    </>
  );
}
