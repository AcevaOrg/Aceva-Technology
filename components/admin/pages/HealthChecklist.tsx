import type { CSSProperties } from "react";
import { adminStyles as ui, AlertIcon, Badge, CheckIcon, InfoIcon, type BadgeTone } from "@/components/admin";
import type { CheckStatus, HealthCheck, HealthSummary } from "./health";
import { splitInlineCode } from "./health";
import s from "./pages.module.css";

const STATUS_TEXT: Record<CheckStatus, { label: string; tone: BadgeTone }> = {
  ok: { label: "OK", tone: "success" },
  warn: { label: "Warning", tone: "warning" },
  fail: { label: "Problem", tone: "danger" },
  info: { label: "Note", tone: "info" },
};

function StatusMark({ status }: { status: CheckStatus }) {
  if (status === "ok") return <CheckIcon width={18} height={18} />;
  if (status === "info") return <InfoIcon width={18} height={18} />;
  return <AlertIcon width={18} height={18} />;
}

/** Renders `backtick` spans as <code>. Plain text nodes only: nothing here is ever parsed as HTML. */
function Advice({ text }: { text: string }) {
  return (
    <>
      {splitInlineCode(text).map((part, index) => (part.code ? <code key={index}>{part.text}</code> : <span key={index}>{part.text}</span>))}
    </>
  );
}

export function HealthBanner({ summary }: { summary: HealthSummary }) {
  return (
    <div className={s.banner}>
      <Badge tone={summary.tone} dot>
        {summary.headline}
      </Badge>
      <span className={ui.muted}>Read-only. Nothing on this page can be changed here, and no secret is shown.</span>
    </div>
  );
}

/**
 * The Settings checklist: one hairline row per check with a status mark, a mono caption, the finding in
 * display type and a line of advice. Colour is never the only signal: every row also states OK, Warning,
 * Problem or Note in words.
 */
export function HealthChecklist({ checks }: { checks: readonly HealthCheck[] }) {
  return (
    <ul className={s.health} role="list" aria-label="Health checks">
      {checks.map((check, index) => {
        const status = STATUS_TEXT[check.status];
        return (
          <li key={check.id} className={s.healthRow} data-status={check.status} style={{ "--i": Math.min(index, 14) } as CSSProperties}>
            <span className={s.healthMark} aria-hidden="true">
              <StatusMark status={check.status} />
            </span>
            <div className={s.healthBody}>
              <div className={s.healthHead}>
                <span className={s.healthLabel}>{check.label}</span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className={s.healthSummary}>{check.summary}</p>
              {check.detail ? (
                <p className={s.healthDetail}>
                  <Advice text={check.detail} />
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
