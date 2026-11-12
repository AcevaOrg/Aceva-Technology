import ui from "@/components/admin/admin.module.css";
import { ButtonLink } from "@/components/admin/Button";
import { AlertIcon, CheckIcon, EditIcon, InfoIcon } from "@/components/admin/icons";
import { Panel } from "@/components/admin/Panel";
import s from "./card.module.css";
import type { Readiness, ReadinessItem } from "./cardData";

/**
 * The "is this fit to print?" UI: a banner when something blocks printing or deserves a warning, and the
 * full checklist for the side column. Server-renderable (no hooks).
 */

function stateOf(item: ReadinessItem): "ok" | "blocker" | "warning" | "info" {
  return item.ok ? "ok" : item.severity;
}

/** Renders nothing when there is nothing to say. */
export function ReadinessBanner({ readiness, editorHref }: { readiness: Readiness; editorHref: string }) {
  const blocked = readiness.blockers.length > 0;
  const notes = blocked ? readiness.blockers : readiness.warnings;
  if (notes.length === 0) return null;

  return (
    <div className={s.banner} data-tone={blocked ? "danger" : "warning"} role="status">
      <span className={s.bannerIcon} aria-hidden="true">
        <AlertIcon width={22} height={22} />
      </span>
      <div className={s.bannerBody}>
        <p className={s.bannerTitle}>
          {blocked
            ? `Not ready to print: ${notes.length} ${notes.length === 1 ? "thing needs" : "things need"} fixing`
            : "Ready to print, with notes"}
        </p>
        <ul className={s.bannerList}>
          {notes.map((item) => (
            <li key={item.id}>
              <b>{item.label}.</b> {item.detail}
            </li>
          ))}
        </ul>
        <div className={s.bannerActions}>
          <ButtonLink href={editorHref} variant={blocked ? "primary" : "ghost"} size="sm" iconLeading={<EditIcon width={16} height={16} />}>
            Open in the editor
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

export function ReadinessChecklist({ readiness }: { readiness: Readiness }) {
  return (
    <Panel eyebrow="Before you print" title="Checklist">
      <ul className={s.checks}>
        {readiness.items.map((item) => {
          const state = stateOf(item);
          return (
            <li key={item.id} className={s.check} data-state={state}>
              <span className={s.checkIcon} aria-hidden="true">
                {state === "ok" ? (
                  <CheckIcon width={18} height={18} />
                ) : state === "info" ? (
                  <InfoIcon width={18} height={18} />
                ) : (
                  <AlertIcon width={18} height={18} />
                )}
              </span>
              <p className={s.checkLabel}>
                <span className={ui.srOnly}>{state === "ok" ? "Done: " : state === "info" ? "Optional: " : "Needs attention: "}</span>
                {item.label}
                {item.severity === "info" && !item.ok ? <span className={s.checkTag}>Optional</span> : null}
              </p>
              <p className={s.checkDetail}>{item.detail}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
