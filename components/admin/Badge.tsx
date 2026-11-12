import type { ReactNode } from "react";
import {
  STATUS_LABELS,
  VERIFICATION_LABELS,
  VISIBILITY_LABELS,
  type DocumentStatus,
  type DocumentVisibility,
  type VerificationState,
} from "@/lib/documents/types";
import s from "./admin.module.css";
import { cx } from "./utils";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  tone?: BadgeTone;
  /** A small leading dot. Colour is never the only signal: the badge always carries text. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

/** A mono-caps pill for a short state word. */
export function Badge({ tone = "neutral", dot, className, children }: BadgeProps) {
  return (
    <span className={cx(s.badge, className)} data-tone={tone}>
      {dot ? <span className={s.badgeDot} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<DocumentStatus, BadgeTone> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

/** draft / published / archived. */
export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const VISIBILITY_TONE: Record<DocumentVisibility, BadgeTone> = {
  public: "info",
  unlisted: "warning",
  private: "neutral",
};

/** public / unlisted / private. The tooltip carries the longer explanation. */
export function VisibilityBadge({ visibility }: { visibility: DocumentVisibility }) {
  const { label, help } = VISIBILITY_LABELS[visibility];
  return (
    <span title={help}>
      <Badge tone={VISIBILITY_TONE[visibility]}>{label}</Badge>
    </span>
  );
}

const VERIFICATION_TONE: Record<VerificationState, BadgeTone> = {
  valid: "success",
  expired: "warning",
  revoked: "danger",
  not_found: "neutral",
};

/** The public verification outcome, or `"off"` for a record with no QR code enabled. */
export function VerificationBadge({ state }: { state: VerificationState | "off" }) {
  if (state === "off") return <Badge tone="neutral">No QR</Badge>;
  return (
    <Badge tone={VERIFICATION_TONE[state]} dot>
      {VERIFICATION_LABELS[state]}
    </Badge>
  );
}
