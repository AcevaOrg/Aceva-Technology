"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import s from "./admin.module.css";
import { Button } from "./Button";
import { useMounted, useModalBehaviour } from "./hooks";
import { AlertIcon, InfoIcon } from "./icons";
import { TextInput } from "./inputs";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** The consequence, in plain words. Wrap the record's name in <strong>. */
  body: ReactNode;
  /** The verb on the confirm button: "Delete document", "Revoke code". */
  confirmLabel: string;
  cancelLabel?: string;
  /** danger = destructive (red button, alertdialog role, focus starts on Cancel). */
  tone?: "default" | "danger";
  /** An action is in flight: the confirm button spins and the dialog cannot be dismissed. */
  busy?: boolean;
  /** The person must type this exact text before the confirm button enables (the record's title, "DELETE"). */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DialogSurface({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  requireText,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, "open">) {
  const titleId = useId();
  const bodyId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const armed = !requireText || typed.trim() === requireText;

  useModalBehaviour({
    active: true,
    containerRef: dialogRef,
    onEscape: () => {
      if (!busy) onCancel();
    },
    // Land on the safe choice for destructive actions, and on the field when typing is required.
    initialFocus: () => inputRef.current ?? (tone === "danger" ? cancelRef.current : confirmRef.current),
  });

  const Icon = tone === "danger" ? AlertIcon : InfoIcon;

  return (
    <div
      className={s.dialogScrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role={tone === "danger" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-tone={tone}
        tabIndex={-1}
        className={s.dialog}
      >
        <span className={s.dialogIcon} aria-hidden="true">
          <Icon width={20} height={20} />
        </span>
        {/* ac-heading-sm opts out of the global <=767px h2 display scale in globals.css */}
        <h2 id={titleId} className={`ac-heading-sm ${s.dialogTitle}`}>
          {title}
        </h2>
        <div id={bodyId} className={s.dialogBody}>
          {body}
        </div>

        {requireText ? (
          <div className={s.dialogConfirm}>
            <label htmlFor={inputId} className={s.fieldLabel}>
              Type <strong>{requireText}</strong> to confirm
            </label>
            <TextInput
              ref={inputRef}
              id={inputId}
              value={typed}
              onChange={setTyped}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
              onKeyDown={(event) => {
                if (event.key === "Enter" && armed && !busy) {
                  event.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>
        ) : null}

        <div className={s.dialogActions}>
          <Button ref={cancelRef} variant="ghost" shine={false} disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "danger" : "primary"}
            loading={busy}
            disabled={!armed}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * A modal confirmation: focus is trapped and handed back, Escape and a click on the backdrop cancel
 * (both blocked while `busy`), and the page behind does not scroll. Rendered into the admin root so it
 * inherits the console's tokens. The typed text and focus reset every time it opens.
 */
export function ConfirmDialog({ open, ...surface }: ConfirmDialogProps) {
  const mounted = useMounted();
  if (!open || !mounted) return null;
  const host = document.querySelector<HTMLElement>("[data-admin-root]") ?? document.body;
  return createPortal(<DialogSurface {...surface} />, host);
}
