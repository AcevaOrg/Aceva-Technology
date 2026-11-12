import Link from "next/link";
import { adminStyles as ui, Badge, CheckIcon } from "@/components/admin";
import { cx } from "@/components/admin/utils";
import type { AttentionGroup } from "./attention";
import { formatCount } from "./format";
import s from "./pages.module.css";

interface AttentionListProps {
  groups: readonly AttentionGroup[];
  /** Some rules could not run (a query failed), so an empty result must not be reported as "all clear". */
  incomplete?: boolean;
}

/**
 * "Needs attention": what a person should look at before anything else. Each group is one rule from
 * attention.ts. An empty result is a positive statement, never a blank panel, but only when the rules
 * actually ran: if they could not, the panel says that instead of reporting a false "all clear".
 */
export function AttentionList({ groups, incomplete }: AttentionListProps) {
  if (groups.length === 0 && incomplete) {
    return <p className={s.panelNote}>Some checks could not run just now. Refresh the page to try again.</p>;
  }

  if (groups.length === 0) {
    return (
      <div className={s.allClear}>
        <span className={s.allClearMark} aria-hidden="true">
          <CheckIcon width={20} height={20} />
        </span>
        <div>
          <p className={s.allClearTitle}>All clear</p>
          <p className={s.allClearBody}>
            Nothing is about to expire, no draft is waiting on a missing file, and nothing that has expired is still live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.attn}>
      {groups.map((group) => (
        <section key={group.kind} aria-label={group.title}>
          <h3 className={s.attnHead}>
            <span>{group.title}</span>
            <Badge tone={group.kind === "expired_published" ? "danger" : "warning"}>
              {formatCount(group.total)}
              {group.partial ? "+" : ""}
            </Badge>
          </h3>
          <ul role="list">
            {group.items.map((item) => (
              <li key={item.id} className={s.attnItem} data-tone={item.tone}>
                <Link href={item.href} prefetch={false} className={cx(ui.rowLink, s.attnTitle)}>
                  {item.title}
                </Link>
                <span className={s.attnDetail}>
                  {item.category} &middot; {item.detail}
                </span>
              </li>
            ))}
          </ul>
          {group.total > group.items.length ? (
            <Link href={group.moreHref} className={cx(ui.link, s.attnMore)}>
              View all {formatCount(group.total)}
            </Link>
          ) : null}
        </section>
      ))}
      {incomplete ? <p className={s.panelNote}>Some checks could not run just now, so this list may be incomplete.</p> : null}
    </div>
  );
}
