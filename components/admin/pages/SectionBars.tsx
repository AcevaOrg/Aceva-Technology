import Link from "next/link";
import type { CSSProperties } from "react";
import { ButtonLink, CATEGORY_ICONS, PlusIcon } from "@/components/admin";
import { CATEGORY_LIST } from "@/lib/documents/categories";
import type { CategoryCounts } from "@/lib/documents/store";
import type { DocumentCategory } from "@/lib/documents/types";
import { ADMIN_ROUTES } from "@/lib/nav";
import { barShare } from "./chartMath";
import { formatCount } from "./format";
import s from "./pages.module.css";

interface SectionBarsProps {
  byCategory: Record<DocumentCategory, CategoryCounts>;
}

/**
 * "By section": the five categories as hairline rows. Each links to its filtered list, shows how many
 * records are live, draft and archived, draws a thin bar (the track is the busiest category, the fill
 * is this one, split into published / draft / archived), and offers "Add" for that category.
 * The bar is decoration for sighted users; the same numbers are in the text beside it and in its label.
 */
export function SectionBars({ byCategory }: SectionBarsProps) {
  const max = Math.max(0, ...CATEGORY_LIST.map((spec) => byCategory[spec.key].total));

  return (
    <div>
      <ul className={s.secList} role="list">
        {CATEGORY_LIST.map((spec, index) => {
          const counts = byCategory[spec.key];
          const Icon = CATEGORY_ICONS[spec.key];
          const segments = [
            { key: "live", count: counts.published, className: s.segLive },
            { key: "draft", count: counts.draft, className: s.segDraft },
            { key: "archived", count: counts.archived, className: s.segArch },
          ].filter((segment) => segment.count > 0);

          return (
            <li key={spec.key} className={s.secRow}>
              <div className={s.secName}>
                <Icon className={s.secIcon} width={20} height={20} />
                <div className={s.secText}>
                  <Link href={`${ADMIN_ROUTES.documents}?category=${spec.slug}`} className={s.secLink}>
                    {spec.plural}
                  </Link>
                  <span className={s.secNums}>
                    {formatCount(counts.total)} total &middot; {formatCount(counts.published)} published &middot; {formatCount(counts.draft)} draft
                  </span>
                </div>
              </div>
              <div className={s.secBarCell}>
                <div
                  className={s.bar}
                  role="img"
                  aria-label={`${spec.plural}: ${counts.published} published, ${counts.draft} draft, ${counts.archived} archived`}
                >
                  <div className={s.barFill} style={{ "--p": barShare(counts.total, max), "--i": index } as CSSProperties}>
                    {segments.map((segment) => (
                      <span key={segment.key} className={`${s.barSeg} ${segment.className}`} style={{ "--n": segment.count } as CSSProperties} />
                    ))}
                  </div>
                </div>
              </div>
              <ButtonLink
                className={s.secAdd}
                href={`${ADMIN_ROUTES.newDocument}?category=${spec.slug}`}
                variant="ghost"
                size="sm"
                shine={false}
                iconLeading={<PlusIcon width={16} height={16} />}
                aria-label={`Add ${spec.label.toLowerCase()}`}
              >
                Add
              </ButtonLink>
            </li>
          );
        })}
      </ul>
      <div className={s.legend} aria-hidden="true">
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.segLive}`} />
          Published
        </span>
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.segDraft}`} />
          Draft
        </span>
        <span className={s.legendItem}>
          <i className={`${s.swatch} ${s.segArch}`} />
          Archived
        </span>
      </div>
    </div>
  );
}
