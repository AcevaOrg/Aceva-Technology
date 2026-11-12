import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { adminStyles as ui, Button, SearchIcon } from "@/components/admin";
import { CATEGORIES } from "@/lib/documents/categories";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_VISIBILITIES,
  STATUS_LABELS,
  VISIBILITY_LABELS,
  type DocumentCategory,
} from "@/lib/documents/types";
import { ADMIN_ROUTES } from "@/lib/nav";
import { CategoryTabs } from "./CategoryTabs";
import { NavSelect } from "./NavSelect";
import {
  DEFAULT_SORT,
  SORT_OPTIONS,
  activeFilterCount,
  clearedQuery,
  listHref,
  type ListQuery,
} from "./listQuery";
import s from "./pages.module.css";

interface FilterBarProps {
  query: ListQuery;
  categoryCounts: Record<DocumentCategory, number> | null;
  totalCount: number | null;
  /** The "expiring soon" window in days, shown on its chip. */
  expiringDays: number;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className={ui.chip} data-active={active ? "" : undefined} aria-current={active ? "true" : undefined}>
      {children}
    </Link>
  );
}

/**
 * Search, category tabs, status / visibility chips, the expiring toggle and the sort menu.
 *
 * Everything is a link or a plain GET form, so the filter state lives in the URL and the page works
 * without client JavaScript. Choosing a chip that is already active clears it; any change returns to
 * page 1 (listHref does that).
 */
export function FilterBar({ query, categoryCounts, totalCount, expiringDays }: FilterBarProps) {
  const filtered = activeFilterCount(query);

  return (
    <div className={s.filters}>
      <div className={s.searchRow}>
        {/* next/form: a GET form that navigates on the client. The hidden fields keep the other filters. */}
        <Form action={ADMIN_ROUTES.documents} className={s.searchForm} role="search" prefetch={false}>
          {query.category ? <input type="hidden" name="category" value={CATEGORIES[query.category].slug} /> : null}
          {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
          {query.visibility ? <input type="hidden" name="visibility" value={query.visibility} /> : null}
          {query.expiring ? <input type="hidden" name="expiring" value="1" /> : null}
          {query.sort !== DEFAULT_SORT ? <input type="hidden" name="sort" value={query.sort} /> : null}
          <div className={`${ui.search} ${s.searchBox}`}>
            <label htmlFor="document-search" className={ui.srOnly}>
              Search documents
            </label>
            <SearchIcon className={ui.searchIcon} width={18} height={18} />
            <input
              key={query.q}
              id="document-search"
              type="search"
              name="q"
              defaultValue={query.q}
              placeholder="Search title, holder, reference or code"
              className={ui.input}
              autoComplete="off"
              maxLength={100}
            />
          </div>
          <Button type="submit" variant="ghost" size="sm" shine={false}>
            Search
          </Button>
        </Form>

        <NavSelect
          id="document-sort"
          label="Sort by"
          value={query.sort}
          options={SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label, href: listHref(query, { sort: option.value }) }))}
        />
      </div>

      <CategoryTabs query={query} counts={categoryCounts} total={totalCount} />

      <div className={s.filterGroups}>
        <div className={s.filterGroup} role="group" aria-label="Filter by status">
          <span className={s.fieldCaption}>Status</span>
          <div className={ui.chips}>
            <Chip href={listHref(query, { status: null })} active={query.status === null}>
              Any
            </Chip>
            {DOCUMENT_STATUSES.map((status) => (
              <Chip key={status} href={listHref(query, { status: query.status === status ? null : status })} active={query.status === status}>
                {STATUS_LABELS[status]}
              </Chip>
            ))}
          </div>
        </div>

        <div className={s.filterGroup} role="group" aria-label="Filter by visibility">
          <span className={s.fieldCaption}>Visibility</span>
          <div className={ui.chips}>
            <Chip href={listHref(query, { visibility: null })} active={query.visibility === null}>
              Any
            </Chip>
            {DOCUMENT_VISIBILITIES.map((visibility) => (
              <Chip
                key={visibility}
                href={listHref(query, { visibility: query.visibility === visibility ? null : visibility })}
                active={query.visibility === visibility}
              >
                {VISIBILITY_LABELS[visibility].label}
              </Chip>
            ))}
          </div>
        </div>

        <div className={s.filterGroup} role="group" aria-label="Filter by expiry">
          <span className={s.fieldCaption}>Expiry</span>
          <div className={ui.chips}>
            <Chip href={listHref(query, { expiring: !query.expiring })} active={query.expiring}>
              Expiring in {expiringDays} days
            </Chip>
          </div>
        </div>
      </div>

      {filtered > 0 ? (
        <p className={s.activeBar}>
          <span>
            {filtered} {filtered === 1 ? "filter" : "filters"} applied
          </span>
          <Link href={listHref(clearedQuery(query))} prefetch={false} className={ui.link}>
            Clear all
          </Link>
        </p>
      ) : null}
    </div>
  );
}
