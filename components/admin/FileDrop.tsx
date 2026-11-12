"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import s from "./admin.module.css";
import { Button } from "./Button";
import { useObjectUrl } from "./hooks";
import { AlertIcon, CheckIcon, DocumentsIcon, ImageIcon, UploadIcon } from "./icons";
import { describeAccepted, formatBytes, inferMime, mimeLabel, validateUpload } from "./utils";

/** A file that is already stored on the server. */
export interface ExistingFile {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  /** Same-origin URL for an image thumbnail. PDFs get a type tile instead. */
  previewUrl?: string;
}

export interface FileDropProps {
  label: string;
  /** What the file is for: "The signed report as a PDF or scan." */
  hint: string;
  /** Allowed MIME types, e.g. PRIMARY_FILE_TYPES from lib/documents/types. */
  accept: readonly string[];
  maxBytes: number;
  /** The newly picked file, or null. Controlled by the form. */
  file: File | null;
  /** The file currently stored, shown until a new one is picked. */
  existing?: ExistingFile | null;
  /** Called with a validated file, or null when the picked file is removed. Invalid files never reach it. */
  onChange: (file: File | null) => void;
  /** Called when the person removes the stored file. Omit to hide the button (e.g. a file is required). */
  onRemoveExisting?: () => void;
  /** A server-side message; takes precedence over the built-in type and size checks. */
  error?: string;
  /** Show a thumbnail of a picked image (photos). PDFs always get a type tile. */
  previewImage?: boolean;
  disabled?: boolean;
  id?: string;
}

function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

function Thumb({ mime, url }: { mime: string; url: string | null }) {
  const isImage = mime.startsWith("image/");
  return (
    <span className={s.fileThumb} aria-hidden="true">
      {url ? (
        // A blob: or same-origin preview URL cannot go through next/image's optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <>
          {isImage ? <ImageIcon width={28} height={28} /> : <DocumentsIcon width={28} height={28} />}
          <span className={s.fileKind}>{mimeLabel(mime)}</span>
        </>
      )}
    </span>
  );
}

/**
 * Drag-and-drop, click or keyboard file picker with client-side type and size checks, an image
 * preview, a PDF tile and a "ready to upload" state. The server re-validates everything; these checks
 * only save a round trip.
 */
export function FileDrop({
  label,
  hint,
  accept,
  maxBytes,
  file,
  existing,
  onChange,
  onRemoveExisting,
  error,
  previewImage,
  disabled,
  id,
}: FileDropProps) {
  const generated = useId();
  const base = id ?? generated;
  const labelId = `${base}-label`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const zoneId = `${base}-zone`;
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const pickedMime = file ? inferMime(file) : "";
  const previewUrl = useObjectUrl(file && previewImage && pickedMime.startsWith("image/") ? file : null);
  const message = error ?? localError;

  // Releasing a file anywhere outside a drop zone would make the browser navigate to it and throw the
  // whole unsaved form away. While an uploader is on the page, such a drop does nothing instead.
  useEffect(() => {
    const swallow = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  function open() {
    inputRef.current?.click();
  }

  function take(candidate: File | undefined) {
    if (!candidate) return;
    const problem = validateUpload(candidate, accept, maxBytes);
    setLocalError(problem);
    if (!problem) onChange(candidate);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    take(event.target.files?.[0]);
    // Clearing the value lets the same file be picked again after it was removed.
    event.target.value = "";
  }

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      if (!disabled) setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (!disabled) take(event.dataTransfer.files[0]);
    },
  };

  return (
    <div className={s.drop} data-drag={dragging ? "" : undefined} {...dragHandlers}>
      <div className={s.fieldHead}>
        <span id={labelId} className={s.fieldLabel}>
          {label}
        </span>
      </div>
      <p id={hintId} className={s.fieldHint}>
        {hint}
      </p>

      {file ? (
        <div className={s.fileTile} data-ready="">
          <Thumb mime={pickedMime} url={previewUrl} />
          <div className={s.fileMeta}>
            <p className={s.fileName}>{file.name}</p>
            <p className={s.fileSub}>
              {mimeLabel(pickedMime)} · {formatBytes(file.size)}
            </p>
            <p className={s.fileReady}>
              <CheckIcon width={14} height={14} />
              Ready to upload{existing ? `, replaces ${existing.filename}` : ""}
            </p>
          </div>
          <div className={s.fileActions}>
            <Button variant="ghost" size="sm" shine={false} disabled={disabled} onClick={open} aria-describedby={hintId}>
              Replace
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setLocalError(null);
                onChange(null);
              }}
            >
              {existing ? "Keep current" : "Remove"}
            </Button>
          </div>
        </div>
      ) : existing ? (
        <div className={s.fileTile}>
          <Thumb mime={existing.mimeType} url={existing.mimeType.startsWith("image/") ? (existing.previewUrl ?? null) : null} />
          <div className={s.fileMeta}>
            <p className={s.fileName}>{existing.filename}</p>
            <p className={s.fileSub}>
              {mimeLabel(existing.mimeType)} · {formatBytes(existing.sizeBytes)}
            </p>
            <p className={s.fileSub}>Currently uploaded</p>
          </div>
          <div className={s.fileActions}>
            <Button variant="ghost" size="sm" shine={false} disabled={disabled} onClick={open}>
              Replace
            </Button>
            {onRemoveExisting ? (
              <Button variant="quiet" size="sm" disabled={disabled} onClick={onRemoveExisting}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          id={zoneId}
          type="button"
          className={s.dropZone}
          disabled={disabled}
          onClick={open}
          aria-labelledby={`${labelId} ${zoneId}`}
          aria-describedby={message ? `${hintId} ${errorId}` : hintId}
        >
          <span className={s.dropIcon} aria-hidden="true">
            <UploadIcon width={20} height={20} />
          </span>
          <span className={s.dropTitle}>
            Drop a file here or <u>browse</u>
          </span>
          <span className={s.dropHint}>
            {describeAccepted(accept)} · up to {formatBytes(maxBytes)}
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept.join(",")}
        disabled={disabled}
        aria-labelledby={labelId}
        onChange={onInputChange}
      />

      {message ? (
        <p id={errorId} className={s.fieldError} role="alert">
          <AlertIcon width={14} height={14} />
          <span>{message}</span>
        </p>
      ) : null}
      <span role="status" className={s.srOnly}>
        {file ? `${file.name} selected and ready to upload.` : ""}
      </span>
    </div>
  );
}
