import Link from "next/link";
import { adminStyles as ui, CATEGORY_ICONS } from "@/components/admin";
import { CATEGORY_LIST } from "@/lib/documents/categories";
import type { DocumentCategory } from "@/lib/documents/types";
import { formatCount } from "./format";
import { listHref, type ListQuery } from "./listQuery";
import s from "./pages.module.css";

interface CategoryTabsProps {
  query: ListQuery;
  /** Records per category, or null when the counts could not be loaded (the tabs still work). */
  counts: Record<DocumentCategory, number> | null;
  total: number | null;
}

/**
 * "All" plus one tab per category. They are links, not a client-side tab widget: each tab is its own
 * URL, so the back button, bookmarks and a shared link all land on the same category. The current
 * tab is `aria-current="page"` and styled as the active chip.
 */
export function CategoryTabs({ query, counts, total }: CategoryTabsProps) {
  const allActive = query.category === null;
  return (
    <nav aria-label="Document categories">
      <div className={s.tabs}>
        <Link
          href={listHref(query, { category: null })}
          prefetch={false}
          className={ui.chip}
          data-active={allActive ? "" : undefined}
          aria-current={allActive ? "page" : undefined}
        >
          All
          {total !== null ? <span className={ui.chipCount}>{formatCount(total)}</span> : null}
        </Link>
        {CATEGORY_LIST.map((spec) => {
          const Icon = CATEGORY_ICONS[spec.key];
          const active = query.category === spec.key;
          return (
            <Link
              key={spec.key}
              href={listHref(query, { category: spec.key })}
              prefetch={false}
              className={ui.chip}
              data-active={active ? "" : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={s.tabIcon} width={16} height={16} />
              {spec.plural}
              {counts ? <span className={ui.chipCount}>{formatCount(counts[spec.key])}</span> : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
