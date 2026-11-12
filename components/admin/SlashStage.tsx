import type { ReactNode } from "react";
import s from "./admin.module.css";
import { cx } from "./utils";

interface SlashStageProps {
  /** "full" fills the viewport (login). "inline" is a framed block inside the console (error, not found). */
  size?: "full" | "inline";
  /** Optional row above the body (a brand lockup on the login page). */
  top?: ReactNode;
  /** Optional line below the body. */
  foot?: ReactNode;
  children: ReactNode;
}

/**
 * The About page's hero vocabulary on the ink surface: a large slash that draws itself, a band of light
 * climbing it on a loop, and a breathing glow. Decorative layers are aria-hidden and sit behind the content.
 */
export function SlashStage({ size = "full", top, foot, children }: SlashStageProps) {
  return (
    <div className={cx(s.stage, size === "inline" && s.stageInline)}>
      <span className={s.stageGlow} aria-hidden="true" />
      <span className={s.stageSlash} aria-hidden="true">
        <span className={s.sweep} />
      </span>
      {top ? <div className={s.stageTop}>{top}</div> : null}
      <div className={s.stageBody}>{children}</div>
      {foot ? <p className={s.stageNote}>{foot}</p> : null}
    </div>
  );
}
