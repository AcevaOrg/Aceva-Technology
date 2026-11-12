"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { CATEGORIES } from "@/lib/documents/categories";
import type { DocumentRecord } from "@/lib/documents/types";
import { ADMIN_ROUTES, adminDocumentRoute, verifyRoute } from "@/lib/nav";
import { Button, ButtonLink } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { CopyButton } from "../CopyButton";
import { DownloadIcon, PrintIcon, QrIcon, RefreshIcon, TrashIcon } from "../icons";
import { TextArea } from "../inputs";
import { Panel } from "../Panel";
import { useToast } from "../Toast";
import ed from "./editor.module.css";
import { requestJson } from "./editorApi";
import { interpretActionResponse, type ApiFailure } from "./editorErrors";
import { adminQrUrl, isDocumentIdLike } from "./editorModel";
import { formatDateTimeUtc } from "./editorPreview";

type ActionName = "archive" | "restore" | "revoke" | "reinstate" | "regenerate_code" | "duplicate";
type DialogName = "regenerate" | "revoke" | "delete" | null;

interface VerificationPanelProps {
  record: DocumentRecord;
  /** The absolute address the QR encodes (site URL + /verify/<code>), worked out on the server. */
  publicUrl: string | null;
}

const DONE_MESSAGES: Record<ActionName, string> = {
  archive: "Archived. It is hidden from visitors.",
  restore: "Restored to draft.",
  revoke: "Revoked. Its code now reports it as revoked.",
  reinstate: "Reinstated. Its code resolves again.",
  regenerate_code: "New code issued. Anything printed with the old QR no longer works.",
  duplicate: "Duplicated. You are now editing the copy.",
};

function failureText(failure: ApiFailure): string {
  return failure.message;
}

/**
 * Everything to do with a record once it exists: its code and QR, the link to print it, and the
 * actions that change its life (revoke, archive, duplicate, delete). Every action is a request to
 * the admin API followed by a refresh, so the page always shows what the server holds.
 *
 * The QR is an <img> pointing at the admin-only image route: the panel never receives or injects
 * SVG markup.
 */
export function VerificationPanel({ record, publicUrl }: VerificationPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const reasonId = useId();
  const reasonErrorId = useId();
  const [busy, setBusy] = useState<ActionName | "delete" | null>(null);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const spec = CATEGORIES[record.category];
  const code = record.verificationCode;
  const revoked = record.revokedAt !== null;
  const archived = record.status === "archived";
  const id = record.id;

  async function run(action: ActionName, body: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(action);
    const result = await requestJson({ url: `/api/admin/documents/${encodeURIComponent(id)}/actions`, method: "POST", body: { action, ...body } });
    setBusy(null);

    if (result.kind !== "response") {
      toast.error("Could not reach the server", { description: "Check your connection and try again." });
      return false;
    }
    const outcome = interpretActionResponse(result.status, result.body);
    if (outcome.type !== "done") {
      // A problem with the revoke reason belongs inside the dialog, next to the field.
      if (outcome.type === "invalid" && outcome.fieldMessages.reason) setReasonError(outcome.fieldMessages.reason);
      else toast.error("That did not work", { description: failureText(outcome) });
      return false;
    }
    toast.success(DONE_MESSAGES[action]);
    if (action === "duplicate" && outcome.document && isDocumentIdLike(outcome.document.id)) {
      router.push(adminDocumentRoute(outcome.document.id));
    } else {
      router.refresh();
    }
    return true;
  }

  async function remove() {
    setBusy("delete");
    const result = await requestJson({ url: `/api/admin/documents/${encodeURIComponent(id)}`, method: "DELETE" });
    setBusy(null);
    if (result.kind !== "response") {
      toast.error("Could not reach the server", { description: "Check your connection and try again." });
      return;
    }
    const outcome = interpretActionResponse(result.status, result.body);
    if (outcome.type !== "done") {
      toast.error("Could not delete", { description: failureText(outcome) });
      return;
    }
    setDialog(null);
    toast.success("Document deleted.");
    router.replace(ADMIN_ROUTES.documents);
  }

  async function confirmRevoke() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError("Say why it is being revoked. This is kept in the record.");
      return;
    }
    if (await run("revoke", { reason: trimmed })) {
      setDialog(null);
      setReason("");
      setReasonError(null);
    }
  }

  async function confirmRegenerate() {
    if (await run("regenerate_code")) setDialog(null);
  }

  const working = busy !== null;
  const lastChecked = formatDateTimeUtc(record.lastVerifiedAt);

  return (
    <>
      <Panel eyebrow={code ? "QR & code" : "Record"} title={code ? "Verification" : "Record actions"}>
        <div className={ed.vp}>
          {code ? (
            <>
              {revoked ? (
                <div className={ed.banner} data-tone="error" role="status">
                  <p>
                    <b>Revoked {formatDateTimeUtc(record.revokedAt)}.</b>
                    {record.revokedReason ? ` Reason: ${record.revokedReason}` : ""} Visitors who scan the code see that it has been revoked.
                  </p>
                </div>
              ) : null}

              <div className={ed.qr}>
                <div className={ed.qrTile} data-revoked={revoked ? "" : undefined}>
                  {/* An authenticated image route; next/image's optimiser cannot fetch it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={adminQrUrl(id, "svg", { size: 320, version: code })}
                    width={168}
                    height={168}
                    alt={`QR code that opens the verification page for code ${code}`}
                  />
                  {!revoked ? <span className={ed.scan} aria-hidden="true" /> : null}
                </div>
                <div className={ed.qrMeta}>
                  <p className={ed.metaLabel}>Verification code</p>
                  <p className={ed.metaValue}>{code}</p>
                  <CopyButton value={code} label="Copy code" />
                </div>
              </div>

              {publicUrl ? (
                <div className={ed.linkRow}>
                  <p className={ed.metaLabel}>Public link</p>
                  <p className={ed.metaValue}>{publicUrl}</p>
                  <CopyButton value={publicUrl} label="Copy link" />
                </div>
              ) : null}

              <dl className={ed.stats}>
                <div>
                  <dt>Lookups</dt>
                  <dd>{record.verifyCount}</dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>{lastChecked || "Never"}</dd>
                </div>
              </dl>

              <div className={ed.actions}>
                <ButtonLink
                  href={adminQrUrl(id, "svg", { size: 1024, download: true, version: code })}
                  external
                  download
                  variant="ghost"
                  size="sm"
                  iconLeading={<DownloadIcon width={16} height={16} />}
                  iconTrailing={false}
                >
                  SVG
                </ButtonLink>
                <ButtonLink
                  href={adminQrUrl(id, "png", { size: 1024, download: true, version: code })}
                  external
                  download
                  variant="ghost"
                  size="sm"
                  iconLeading={<DownloadIcon width={16} height={16} />}
                  iconTrailing={false}
                >
                  PNG
                </ButtonLink>
                <ButtonLink href={verifyRoute(code)} external variant="ghost" size="sm" iconLeading={<QrIcon width={16} height={16} />}>
                  Open verify page
                </ButtonLink>
                <ButtonLink href={`${adminDocumentRoute(id)}/card`} variant="ghost" size="sm" iconLeading={<PrintIcon width={16} height={16} />}>
                  Print QR labels
                </ButtonLink>
              </div>
            </>
          ) : spec.verifiable ? (
            <p className={ed.note}>
              QR verification is off for this document. Switch it on under Publishing and save to issue a code.
            </p>
          ) : (
            <p className={ed.note}>This kind of document is not verified by QR code.</p>
          )}

          <div className={ed.actions} role="group" aria-label="Record actions">
            {code && !revoked ? (
              <Button variant="ghost" size="sm" shine={false} disabled={working} onClick={() => setDialog("regenerate")} iconLeading={<RefreshIcon width={16} height={16} />}>
                Regenerate code
              </Button>
            ) : null}
            {code && !revoked ? (
              <Button variant="ghost" size="sm" shine={false} disabled={working} onClick={() => setDialog("revoke")}>
                Revoke
              </Button>
            ) : null}
            {code && revoked ? (
              <Button variant="ghost" size="sm" shine={false} loading={busy === "reinstate"} disabled={working} onClick={() => void run("reinstate")}>
                Reinstate
              </Button>
            ) : null}
            {archived ? (
              <Button variant="ghost" size="sm" shine={false} loading={busy === "restore"} disabled={working} onClick={() => void run("restore")}>
                Restore to draft
              </Button>
            ) : (
              <Button variant="ghost" size="sm" shine={false} loading={busy === "archive"} disabled={working} onClick={() => void run("archive")}>
                Archive
              </Button>
            )}
            <Button variant="ghost" size="sm" shine={false} loading={busy === "duplicate"} disabled={working} onClick={() => void run("duplicate")}>
              Duplicate
            </Button>
            <Button variant="quiet" size="sm" disabled={working} onClick={() => setDialog("delete")} iconLeading={<TrashIcon width={16} height={16} />}>
              Delete
            </Button>
          </div>
          <p className={ed.note}>Duplicate copies the saved version, not unsaved edits.</p>
        </div>
      </Panel>

      <ConfirmDialog
        open={dialog === "regenerate"}
        tone="danger"
        title="Issue a new verification code?"
        body={
          <>
            <p>
              A new code and QR replace the current one. <strong>Anything already printed or shared with the old QR stops working</strong> and
              reports &ldquo;not found&rdquo;.
            </p>
            <p>This cannot be undone. Reprint any QR labels and letters afterwards.</p>
          </>
        }
        confirmLabel="Issue new code"
        busy={busy === "regenerate_code"}
        onConfirm={() => void confirmRegenerate()}
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "revoke"}
        tone="danger"
        title="Revoke this document?"
        body={
          <>
            <p>
              Anyone who scans the code will see that it has been <strong>revoked</strong>. You can reinstate it later. Visitors see only that it
              was revoked, never your reason.
            </p>
            <label className={ed.reasonLabel} htmlFor={reasonId}>
              Reason (kept in the record)
            </label>
            <TextArea
              id={reasonId}
              value={reason}
              onChange={setReason}
              rows={3}
              maxLength={500}
              aria-describedby={reasonError ? reasonErrorId : undefined}
            />
            {reasonError ? (
              <p id={reasonErrorId} className={ed.reasonError} role="alert">
                {reasonError}
              </p>
            ) : null}
          </>
        }
        confirmLabel="Revoke"
        busy={busy === "revoke"}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => {
          setDialog(null);
          setReasonError(null);
        }}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        tone="danger"
        title="Delete this document?"
        body={
          <p>
            <strong>{record.title}</strong> is deleted for good, with its files and its QR code. Anything printed with that QR will stop
            working. This cannot be undone.
          </p>
        }
        confirmLabel="Delete document"
        requireText="DELETE"
        busy={busy === "delete"}
        onConfirm={() => void remove()}
        onCancel={() => setDialog(null)}
      />
    </>
  );
}
