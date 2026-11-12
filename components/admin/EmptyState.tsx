import type { ReactNode } from "react";
import s from "./admin.module.css";

interface EmptyStateProps {
  title: string;
  body: string;
  /** Usually a ButtonLink or Button: the one thing the person should do next. */
  action?: ReactNode;
}

/** A dashed frame with a breathing slash: nothing here yet, and here is what to do about it. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className={s.empty}>
      <span className={s.emptyMark} aria-hidden="true" />
      <h3 className={s.emptyTitle}>{title}</h3>
      <p className={s.emptyBody}>{body}</p>
      {action ? <div className={s.emptyAction}>{action}</div> : null}
    </div>
  );
}
