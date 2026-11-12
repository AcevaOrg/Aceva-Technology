import Link from "next/link";
import { adminStyles as ui, Button, ButtonLink, ArrowRightIcon } from "@/components/admin";
import { formatCount, plural } from "./format";
import { pageItems, type Pagination as PaginationState } from "./listQuery";
import s from "./pages.module.css";

interface PaginationProps {
  pagination: PaginationState;
  /** The URL for a page number. */
  hrefFor: (page: number) => string;
  /** What the rows are, singular: "document", "lookup", "event". */
  noun: string;
}

/**
 * The line under a ledger: "Showing 26 to 50 of 112 documents" and previous / numbers / next. All
 * plain links, so paging works without JavaScript and every page has its own URL. Page numbers are
 * hidden on phones, where "Page 2 of 5" and the two buttons are enough.
 */
export function Pagination({ pagination, hrefFor, noun }: PaginationProps) {
  const { page, pages, total, from, to } = pagination;
  if (total === 0) return null;

  return (
    <div className={ui.ledgerFoot}>
      <p>
        Showing {formatCount(from)} to {formatCount(to)} of {formatCount(total)} {plural(total, noun)}
      </p>
      {pages > 1 ? (
        <nav className={s.pager} aria-label="Pagination">
          {pagination.hasPrev ? (
            <ButtonLink href={hrefFor(page - 1)} variant="ghost" size="sm" shine={false} rel="prev">
              Previous
            </ButtonLink>
          ) : (
            <Button variant="ghost" size="sm" shine={false} disabled>
              Previous
            </Button>
          )}
          <span className={s.pagerStatus}>
            Page {page} of {pages}
          </span>
          <span className={s.pagerNums}>
            {pageItems(page, pages).map((item, index) =>
              item === "gap" ? (
                <span key={`gap-${index}`} className={s.pageGap} aria-hidden="true">
                  &hellip;
                </span>
              ) : (
                <Link
                  key={item}
                  href={hrefFor(item)}
                  prefetch={false}
                  className={`${ui.chip} ${s.pageLink}`}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                >
                  {item}
                </Link>
              ),
            )}
          </span>
          {pagination.hasNext ? (
            <ButtonLink href={hrefFor(page + 1)} variant="ghost" size="sm" shine={false} rel="next" iconTrailing={<ArrowRightIcon width={16} height={16} />}>
              Next
            </ButtonLink>
          ) : (
            <Button variant="ghost" size="sm" shine={false} disabled iconTrailing={<ArrowRightIcon width={16} height={16} />}>
              Next
            </Button>
          )}
        </nav>
      ) : null}
    </div>
  );
}
