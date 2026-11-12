import { useId, type ReactNode } from "react";
import s from "./admin.module.css";
import { cx } from "./utils";

interface PanelProps {
  /** Becomes the panel's <h2> and its accessible name. */
  title?: string;
  /** Small mono-caps line above the title. */
  eyebrow?: string;
  /** Buttons or links aligned to the right of the title row. */
  actions?: ReactNode;
  /**
   * "default" is the dark raised surface. "paper" is the light #f4f2ee surface and exists ONLY for
   * things that represent a printed document (a letter preview), never for general chrome.
   */
  tone?: "default" | "paper";
  className?: string;
  children: ReactNode;
}

/** A 14px-radius card with an optional title row. */
export function Panel({ title, eyebrow, actions, tone = "default", className, children }: PanelProps) {
  const titleId = useId();
  const hasHead = Boolean(title || eyebrow || actions);
  return (
    <section className={cx(s.panel, tone === "paper" && s.panelPaper, className)} aria-labelledby={title ? titleId : undefined}>
      {hasHead ? (
        <div className={s.panelHead}>
          <div className={s.panelHeadMain}>
            {eyebrow ? <p className={s.panelEyebrow}>{eyebrow}</p> : null}
            {/* ac-heading-sm opts out of the global <=767px h2 display scale in globals.css */}
            {title ? (
              <h2 id={titleId} className={cx("ac-heading-sm", s.panelTitle)}>
                {title}
              </h2>
            ) : null}
          </div>
          {actions ? <div className={s.panelActions}>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
