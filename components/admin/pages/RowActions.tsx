"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FormField } from "@/components/admin/FormField";
import {
  AlertIcon,
  CopyIcon,
  EditIcon,
  ExternalIcon,
  EyeOffIcon,
  LinkIcon,
  LockIcon,
  PrintIcon,
  QrIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/admin/icons";
import { TextArea } from "@/components/admin/inputs";
import { useToast } from "@/components/admin/Toast";
import { adminDocumentRoute } from "@/lib/nav";
import { ActionMenu, type MenuItem } from "./ActionMenu";
import { copyText } from "./clipboard";
import s from "./pages.module.css";
import {
  MAX_REASON_LENGTH,
  buildActionGroups,
  buildActionRequest,
  cardHref,
  confirmCopy,
  describeActionFailure,
  destinationAfter,
  isWorkflowAction,
  qrDownloadHref,
  successMessage,
  validateRevokeReason,
  type MenuActionId,
  type RowActionsTarget,
} from "./actionRules";

/**
 * The three-dot menu on a documents row. It owns the whole round trip for a state change: confirm
 * (with a reason for revoke, a typed word for delete), call the admin API, say what happened in a
 * toast, and ask the server to re-render the list. The rules about which actions exist and what the
 * dialogs say live in rowActions.ts; this file is the wiring.
 */

const ICONS: Record<MenuActionId, ReactNode> = {
  edit: <EditIcon />,
  view_public: <ExternalIcon />,
  copy_link: <LinkIcon />,
  download_qr: <QrIcon />,
  print_card: <PrintIcon />,
  publish: <UploadIcon />,
  unpublish: <EyeOffIcon />,
  archive: <LockIcon />,
  restore: <RefreshIcon />,
  revoke: <AlertIcon />,
  reinstate: <ShieldCheckIcon />,
  duplicate: <CopyIcon />,
  delete: <TrashIcon />,
};

/** The reason box inside the revoke dialog. It takes focus once the dialog has finished placing it. */
function ReasonField({ value, error, onChange }: { value: string; error: string | null; onChange: (value: string) => void }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);

  // The dialog focuses its own safe button on open; waiting a frame lets this field take focus after that.
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={s.reasonBox}>
      <FormField id={id} label="Reason" required error={error ?? undefined} hint="Recorded in the activity log. Not shown to the public.">
        <TextArea ref={ref} value={value} onChange={onChange} rows={3} maxLength={MAX_REASON_LENGTH} />
      </FormField>
    </div>
  );
}

export function RowActions({ target }: { target: RowActionsTarget }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<MenuActionId | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  async function run(action: MenuActionId) {
    if (busy) return;
    if (!isWorkflowAction(action) && action !== "delete") return;

    if (action === "revoke") {
      const problem = validateRevokeReason(reason);
      if (problem) {
        setReasonError(problem);
        return;
      }
    }

    setBusy(true);
    try {
      const request = buildActionRequest(target.id, action, reason);
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.body ? { "Content-Type": "application/json" } : undefined,
        body: request.body,
        credentials: "same-origin",
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        toast.success(successMessage(action, target.title), action === "duplicate" ? { description: "Opening the copy so you can finish it." } : undefined);
        setPending(null);
        const destination = destinationAfter(action, body);
        if (destination) router.push(destination);
        else router.refresh();
        return;
      }

      const failure = describeActionFailure(action, response.status, body);
      toast.error(failure.message, { description: failure.description });
      setPending(null);
      // A vanished or changed record, or an ended session, makes the list on screen untrustworthy.
      if (failure.signedOut || response.status === 404 || response.status === 409) router.refresh();
    } catch {
      toast.error("Could not reach the server.", { description: "Check your connection and try again. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  function choose(action: MenuActionId) {
    if (confirmCopy(action, target)) {
      setReason("");
      setReasonError(null);
      setPending(action);
      return;
    }
    void run(action);
  }

  async function copyLink() {
    if (!target.verifyUrl) return;
    if (await copyText(target.verifyUrl)) toast.success("Verification link copied");
    else toast.error("Could not copy the link.", { description: "Open the document and copy it from there." });
  }

  const groups: MenuItem[][] = buildActionGroups(target).map((group) =>
    group.map((action) => {
      const item: MenuItem = { id: action.id, label: action.label, icon: ICONS[action.id], tone: action.tone };
      switch (action.id) {
        case "edit":
          return { ...item, href: adminDocumentRoute(target.id) };
        case "view_public":
          return { ...item, href: target.publicPath ?? undefined, newTab: true };
        case "copy_link":
          return { ...item, onSelect: () => void copyLink() };
        case "download_qr":
          return { ...item, href: qrDownloadHref(target.id), download: true };
        case "print_card":
          return { ...item, href: cardHref(target.id) };
        default:
          return { ...item, onSelect: () => choose(action.id) };
      }
    }),
  );

  const copy = pending ? confirmCopy(pending, target) : null;

  return (
    <>
      <ActionMenu label={`Actions for ${target.title}`} groups={groups} disabled={busy} />
      {pending && copy ? (
        <ConfirmDialog
          open
          title={copy.title}
          body={
            <>
              {copy.lead}
              <strong>{target.title}</strong>
              {copy.trail}
              {copy.needsReason ? (
                <ReasonField
                  value={reason}
                  error={reasonError}
                  onChange={(next) => {
                    setReason(next);
                    if (reasonError) setReasonError(null);
                  }}
                />
              ) : null}
            </>
          }
          confirmLabel={copy.confirmLabel}
          tone={copy.tone}
          busy={busy}
          requireText={copy.requireText}
          onConfirm={() => void run(pending)}
          onCancel={() => {
            if (!busy) setPending(null);
          }}
        />
      ) : null}
    </>
  );
}

