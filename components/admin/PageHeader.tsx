import type { ReactNode } from "react";
import s from "./admin.module.css";
import { RisingWords } from "./RisingWords";

interface PageHeaderProps {
  /** Mono-caps line next to the slash glyph: "Documents", "Overview". */
  eyebrow: string;
  /** The page's <h1>. Its words rise one by one through their masks. */
  title: string;
  /** One or two sentences under the title. */
  lede?: ReactNode;
  /** Primary and secondary buttons, right-aligned on wide screens. */
  actions?: ReactNode;
}

/** The top of every console page: eyebrow, word-rise headline, lede and actions over a self-drawing rule. */
export function PageHeader({ eyebrow, title, lede, actions }: PageHeaderProps) {
  return (
    <header className={s.pageHead}>
      <div className={s.pageHeadMain}>
        <p className={s.eyebrow}>
          <i className={s.slash} aria-hidden="true" />
          <b>{eyebrow}</b>
        </p>
        <h1 className={s.title}>
          <RisingWords text={title} />
        </h1>
        {lede ? <p className={s.lede}>{lede}</p> : null}
      </div>
      {actions ? <div className={s.pageActions}>{actions}</div> : null}
    </header>
  );
}
