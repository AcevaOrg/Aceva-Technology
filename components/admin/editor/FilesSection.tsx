"use client";

import { memo } from "react";
import { CATEGORIES } from "@/lib/documents/categories";
import {
  MAX_PHOTO_BYTES,
  MAX_REQUEST_BYTES,
  PHOTO_FILE_TYPES,
  PRIMARY_FILE_TYPES,
  type DocumentCategory,
  type DocumentFileMeta,
  type StampPages,
  type StampPosition,
  type StampSize,
} from "@/lib/documents/types";
import { Button, ButtonLink } from "../Button";
import { FileDrop, type ExistingFile } from "../FileDrop";
import { FormSection } from "../FormSection";
import { DownloadIcon } from "../icons";
import { Spinner } from "../Spinner";
import { describeAccepted, formatBytes } from "../utils";
import ed from "./editor.module.css";
import { adminFileUrl, PHOTO_INTAKE_BYTES, type EditorSettingKey, type EditorValues } from "./editorModel";
import { StampOptions } from "./StampOptions";

interface FilesSectionProps {
  category: DocumentCategory;
  documentId: string | null;
  stored: { primary: DocumentFileMeta | null; photo: DocumentFileMeta | null };
  primary: File | null;
  photo: File | null;
  removePrimary: boolean;
  removePhoto: boolean;
  /** A photo is being shrunk in the browser. */
  photoBusy: boolean;
  /** The per-file cap the server enforces (`getMaxUploadBytes()`). */
  maxUploadBytes: number;
  errors: Record<string, string>;
  /** The QR stamp controls; null for a category that is not verified by QR. */
  stamp: { enabled: boolean; position: StampPosition; size: StampSize; pages: StampPages; hasCode: boolean; currentCode: string | null } | null;
  onSetting: (patch: Partial<Pick<EditorValues, EditorSettingKey>>) => void;
  onPrimaryChange: (file: File | null) => void;
  onPhotoChange: (file: File | null) => void;
  onRemovePrimary: (remove: boolean) => void;
  onRemovePhoto: (remove: boolean) => void;
}

function toExisting(meta: DocumentFileMeta, documentId: string | null): ExistingFile {
  return {
    filename: meta.filename,
    sizeBytes: meta.sizeBytes,
    mimeType: meta.mimeType,
    previewUrl:
      documentId && meta.mimeType.startsWith("image/") ? adminFileUrl(documentId, meta.role, { version: meta.sha256 }) : undefined,
  };
}

function RemovedNote({ filename, onUndo }: { filename: string; onUndo: () => void }) {
  return (
    <div className={ed.removed} role="status">
      <p>
        <strong>{filename}</strong> will be removed when you save.
      </p>
      <Button variant="quiet" size="sm" onClick={onUndo}>
        Undo
      </Button>
    </div>
  );
}

/**
 * The record's files. The document file takes PDF or an image up to the server's per-file cap; the
 * photo (only for categories that carry one) is shrunk in the browser first, so a phone picture
 * does not hit the limit. Stored files can be opened through the admin file route, which works
 * whatever the record's visibility.
 */
function FilesSectionImpl({
  category,
  documentId,
  stored,
  primary,
  photo,
  removePrimary,
  removePhoto,
  photoBusy,
  maxUploadBytes,
  errors,
  stamp,
  onSetting,
  onPrimaryChange,
  onPhotoChange,
  onRemovePrimary,
  onRemovePhoto,
}: FilesSectionProps) {
  const spec = CATEGORIES[category];
  const storedPrimary = stored.primary && !removePrimary ? stored.primary : null;
  const storedPhoto = stored.photo && !removePhoto ? stored.photo : null;

  return (
    <FormSection
      title="Files"
      description="Files are stored with the record. Visitors can open the document file only if you allow public download below."
    >
      <div className={ed.fileCell} id="ed-primary-cell">
        <FileDrop
          id="ed-primary"
          label={spec.fileRequired ? "Document file (required to publish)" : "Document file"}
          hint={`${describeAccepted(PRIMARY_FILE_TYPES)}, up to ${formatBytes(maxUploadBytes)} per file. One save carries at most ${formatBytes(
            MAX_REQUEST_BYTES,
          )} in total.`}
          accept={PRIMARY_FILE_TYPES}
          maxBytes={maxUploadBytes}
          file={primary}
          existing={storedPrimary ? toExisting(storedPrimary, documentId) : null}
          onChange={onPrimaryChange}
          onRemoveExisting={stored.primary ? () => onRemovePrimary(true) : undefined}
          error={errors.primary}
        />
        {storedPrimary && !primary && documentId ? (
          <div className={ed.fileLinks}>
            <ButtonLink href={adminFileUrl(documentId, "primary", { version: storedPrimary.sha256 })} external variant="quiet" size="sm" aria-label={`View ${storedPrimary.filename}`}>
              View
            </ButtonLink>
            {/* The file as stored, so a certificate that carries the QR downloads with the QR on it. */}
            <ButtonLink
              href={adminFileUrl(documentId, "primary", { version: storedPrimary.sha256, download: true })}
              external
              download
              variant="ghost"
              size="sm"
              iconLeading={<DownloadIcon width={16} height={16} />}
              iconTrailing={false}
              aria-label={`Download ${storedPrimary.filename}${storedPrimary.stamp ? " with the QR on it" : ""}`}
            >
              {storedPrimary.stamp ? "Download with QR" : "Download"}
            </ButtonLink>
          </div>
        ) : null}
        {removePrimary && stored.primary ? <RemovedNote filename={stored.primary.filename} onUndo={() => onRemovePrimary(false)} /> : null}
        {stamp ? (
          <StampOptions
            hasCode={stamp.hasCode}
            enabled={stamp.enabled}
            position={stamp.position}
            size={stamp.size}
            pages={stamp.pages}
            fileMime={primary ? primary.type || null : storedPrimary ? storedPrimary.mimeType : null}
            storedStamp={storedPrimary && !primary ? (storedPrimary.stamp ?? null) : null}
            currentCode={stamp.currentCode}
            error={errors.stamp}
            onSetting={onSetting}
          />
        ) : null}
      </div>

      {spec.hasPhoto ? (
        <div className={ed.fileCell} id="ed-photo-cell">
          <FileDrop
            id="ed-photo"
            label={spec.photoRequired ? "Photo (required to publish)" : "Photo"}
            hint={`${describeAccepted(PHOTO_FILE_TYPES)}. Large pictures are shrunk in your browser to fit the ${formatBytes(
              MAX_PHOTO_BYTES,
            )} limit before they upload.`}
            accept={PHOTO_FILE_TYPES}
            maxBytes={PHOTO_INTAKE_BYTES}
            file={photo}
            existing={storedPhoto ? toExisting(storedPhoto, documentId) : null}
            onChange={onPhotoChange}
            onRemoveExisting={stored.photo ? () => onRemovePhoto(true) : undefined}
            error={errors.photo}
            previewImage
            disabled={photoBusy}
          />
          {photoBusy ? (
            <p className={ed.busyLine} role="status">
              <Spinner size={16} />
              Shrinking photo…
            </p>
          ) : null}
          {storedPhoto && !photo && documentId ? (
            <div className={ed.fileLinks}>
              <ButtonLink href={adminFileUrl(documentId, "photo", { version: storedPhoto.sha256 })} external variant="quiet" size="sm" aria-label={`View ${storedPhoto.filename}`}>
                View
              </ButtonLink>
            </div>
          ) : null}
          {removePhoto && stored.photo ? <RemovedNote filename={stored.photo.filename} onUndo={() => onRemovePhoto(false)} /> : null}
        </div>
      ) : null}
    </FormSection>
  );
}

export const FilesSection = memo(FilesSectionImpl);
