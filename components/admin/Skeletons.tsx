import type { CSSProperties } from "react";
import s from "./admin.module.css";

/*
 * CSS-only loading skeletons: server components with no JavaScript, tinted from the surface tokens so
 * they sit correctly on ink or paper. Each announces itself once as a polite status; pass
 * `announce={false}` when several are composed into one loading page that announces itself.
 */

interface SkeletonProps {
  /** Screen-reader text. Defaults to "Loading". */
  label?: string;
  /** Set false when a parent already announces loading. */
  announce?: boolean;
}

function Status({ label = "Loading", announce = true }: SkeletonProps) {
  return announce ? (
    <span role="status" className={s.srOnly}>
      {label}
    </span>
  ) : null;
}

/** A ledger-shaped placeholder: `rows` hairline-ruled rows with a title block and a trailing chip. */
export function AdminTableSkeleton({ rows = 6, label, announce }: SkeletonProps & { rows?: number }) {
  return (
    <div>
      <Status label={label} announce={announce} />
      <div className={s.ledger} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={s.skelRow}>
            <div className={s.skelGrow}>
              <span className={`${s.skel} ${s.skelLine}`} style={{ width: `${46 + ((index * 17) % 30)}%` } as CSSProperties} />
              <span className={`${s.skel} ${s.skelLine}`} style={{ width: `${24 + ((index * 11) % 22)}%`, height: 11 } as CSSProperties} />
            </div>
            <span className={`${s.skel} ${s.skelLine}`} style={{ width: 84 } as CSSProperties} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A row of `count` stat-tile placeholders. */
export function AdminStatSkeleton({ count = 4, label, announce }: SkeletonProps & { count?: number }) {
  return (
    <div>
      <Status label={label} announce={announce} />
      <div className={s.stats} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className={`${s.skel} ${s.skelStat}`} />
        ))}
      </div>
    </div>
  );
}

/** A stack of label-plus-input placeholders for an editor form. */
export function AdminFormSkeleton({ fields = 6, label, announce }: SkeletonProps & { fields?: number }) {
  return (
    <div>
      <Status label={label} announce={announce} />
      <div className={s.fieldGrid} aria-hidden="true">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className={s.field}>
            <span className={`${s.skel} ${s.skelLine}`} style={{ width: 96, height: 11 } as CSSProperties} />
            <span className={`${s.skel} ${s.skelBlock}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
