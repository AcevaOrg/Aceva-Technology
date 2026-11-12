"use client";

import { memo, useCallback, useMemo } from "react";
import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentCategory, DocumentStatus, DocumentVisibility } from "@/lib/documents/types";
import { Button } from "../Button";
import { FormField } from "../FormField";
import { FormSection } from "../FormSection";
import { CloseIcon, InfoIcon, LockIcon } from "../icons";
import { SegmentedControl } from "../SegmentedControl";
import { Switch } from "../Switch";
import { cx } from "../utils";
import ed from "./editor.module.css";
import { fieldDomId, settingDomId } from "./editorErrors";
import {
  CONSENT_FIELD_KEY,
  consentField,
  statusOptions,
  visibilityOptions,
  type EditorFieldValue,
  type EditorMode,
  type EditorSettingKey,
  type EditorValues,
} from "./editorModel";
import { visitorSummary } from "./editorPreview";
import { InlineError, VisibilityMark } from "./FieldControl";

interface PublishingSectionProps {
  category: DocumentCategory;
  mode: EditorMode;
  /** The record already has a verification code, which can never be switched off. */
  hasCode: boolean;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  allowDownload: boolean;
  featured: boolean;
  enableVerification: boolean;
  consent: boolean;
  /** Why a setting was changed for the person (for example Public stepping down). */
  notice: string | null;
  errors: Record<string, string>;
  onSetting: (patch: Partial<Pick<EditorValues, EditorSettingKey>>) => void;
  onField: (key: string, value: EditorFieldValue) => void;
  onDismissNotice: () => void;
}

function listLabels(labels: readonly string[]): string {
  return labels.join(", ");
}

/**
 * Who can see the record and how: status, visibility (limited to what the category allows), download,
 * featuring and QR verification, plus the privacy notice and consent gate for records about people.
 */
function PublishingSectionImpl({
  category,
  mode,
  hasCode,
  status,
  visibility,
  allowDownload,
  featured,
  enableVerification,
  consent,
  notice,
  errors,
  onSetting,
  onField,
  onDismissNotice,
}: PublishingSectionProps) {
  const spec = CATEGORIES[category];
  const consentSpec = consentField(spec);
  const summary = useMemo(() => visitorSummary(category), [category]);

  const visibilityChoices = useMemo(() => visibilityOptions(category, consent), [category, consent]);
  const statusChoices = useMemo(() => statusOptions(mode), [mode]);
  const publicLocked = visibilityChoices.some((option) => option.value === "public" && option.disabled);

  const setVisibility = useCallback((next: DocumentVisibility) => onSetting({ visibility: next }), [onSetting]);
  const setStatus = useCallback((next: DocumentStatus) => onSetting({ status: next }), [onSetting]);
  const setDownload = useCallback((next: boolean) => onSetting({ allowDownload: next }), [onSetting]);
  const setFeatured = useCallback((next: boolean) => onSetting({ featured: next }), [onSetting]);
  const setVerification = useCallback((next: boolean) => onSetting({ enableVerification: next }), [onSetting]);
  const setConsent = useCallback((next: boolean) => onField(CONSENT_FIELD_KEY, next), [onField]);

  return (
    <FormSection title="Publishing" description="Choose when this goes live and who can reach it.">
      <div className={ed.fullCell}>
        {spec.personal ? (
          <div className={ed.privacy} role="note">
            <LockIcon width={20} height={20} className={ed.privacyIcon} />
            <div>
              <p className={ed.privacyTitle}>This record is about a person</p>
              <p>
                Only fields tagged <VisibilityMark publicField /> can ever reach visitors, and only once the record is published and not
                Private. Everything tagged <VisibilityMark publicField={false} /> stays inside this console.
              </p>
            </div>
          </div>
        ) : null}
        <details className={ed.visible} open={spec.personal}>
          <summary>What visitors can see</summary>
          <p>
            <b>Shown:</b> {listLabels(summary.shown)}.
          </p>
          {summary.admin.length > 0 ? (
            <p>
              <b>Admin only:</b> {listLabels(summary.admin)}.
            </p>
          ) : null}
        </details>
      </div>

      {notice ? (
        <div className={ed.fullCell}>
          <div className={ed.banner} data-tone="warn" role="status">
            <InfoIcon width={18} height={18} />
            <p>{notice}</p>
            <Button variant="quiet" size="sm" onClick={onDismissNotice} aria-label="Dismiss this message">
              <CloseIcon width={16} height={16} />
            </Button>
          </div>
        </div>
      ) : null}

      {consentSpec ? (
        <div className={ed.fullCell}>
          <Switch
            id={fieldDomId(consentSpec.key)}
            checked={consent}
            onChange={setConsent}
            label={consentSpec.label}
            hint={consentSpec.help}
          />
          {errors[consentSpec.key] ? <InlineError message={errors[consentSpec.key]} /> : null}
        </div>
      ) : null}

      <div className={ed.fullCell}>
        <FormField id={settingDomId("visibility")} label="Visibility" error={errors.visibility} required>
          <SegmentedControl<DocumentVisibility> options={visibilityChoices} value={visibility} onChange={setVisibility} label="Visibility" />
        </FormField>
        {publicLocked ? (
          <p className={ed.note}>Public is locked until the person&rsquo;s consent is recorded above.</p>
        ) : null}
      </div>

      {mode === "edit" ? (
        <div className={ed.fullCell}>
          <FormField id={settingDomId("status")} label="Publication status" error={errors.status} required>
            <SegmentedControl<DocumentStatus> options={statusChoices} value={status} onChange={setStatus} label="Publication status" />
          </FormField>
        </div>
      ) : (
        <p className={cx(ed.note, ed.fullCell)}>
          New documents start as a draft. Use <b>Publish</b> below to make it live as soon as it passes the checks.
        </p>
      )}

      <div className={ed.switchCell}>
        <Switch
          id={settingDomId("allowDownload")}
          checked={allowDownload}
          onChange={setDownload}
          label="Allow public download"
          hint="Visitors can open the document file from the listing and the verify page."
        />
        {errors.allowDownload ? <InlineError message={errors.allowDownload} /> : null}
      </div>

      <div className={ed.switchCell}>
        <Switch
          id={settingDomId("featured")}
          checked={featured}
          onChange={setFeatured}
          label="Feature on the Documents page"
          hint="Pins it to the top of its section when it is publicly listed."
        />
        {errors.featured ? <InlineError message={errors.featured} /> : null}
      </div>

      {spec.verifiable ? (
        <div className={ed.fullCell}>
          {hasCode ? (
            <div className={ed.banner} data-tone="info">
              <InfoIcon width={18} height={18} />
              <p>
                <b>QR verification is on.</b> A code has been issued and printed copies may depend on it, so it cannot be switched off. To
                stop it resolving, revoke it or make the record Private.
              </p>
            </div>
          ) : (
            <>
              <Switch
                id={settingDomId("enableVerification")}
                checked={enableVerification}
                onChange={setVerification}
                label="Enable QR verification"
                hint="Creates a unique code and QR on save. Anyone who scans it sees whether the document is valid, expired or revoked."
              />
              {errors.enableVerification ? <InlineError message={errors.enableVerification} /> : null}
            </>
          )}
        </div>
      ) : null}
    </FormSection>
  );
}

export const PublishingSection = memo(PublishingSectionImpl);
