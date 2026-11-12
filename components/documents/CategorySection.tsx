import type { ReactNode } from "react";
import Link from "next/link";
import type { CategorySpec } from "@/lib/documents/types";
import { ROUTES } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import { EMPTY_BODY, EMPTY_TITLE, UNAVAILABLE_BODY, UNAVAILABLE_TITLE, type ListedCategory } from "./content";
import styles from "./documents.module.css";

const SURFACES = { paper: ui.paper, paper2: ui.paper2, ink: ui.ink } as const;

/** The words a section frame needs. A `CategorySpec` has them; so does the combined certifications section. */
export type SectionCopy = Pick<CategorySpec, "slug" | "eyebrow" | "plural" | "blurb">;

interface CategorySectionProps {
  category: SectionCopy;
  /** Zero-based position, shown as "01", "02", … and matching the sticky index. */
  index: number;
  surface: keyof typeof SURFACES;
  /** A short mono tag beside the intro, such as "3 published" or "Never listed". */
  badge?: string;
  children: ReactNode;
}

/** The shared frame for one public section: anchor id, eyebrow, heading, blurb and badge, then its content. */
export default function CategorySection({ category, index, surface, badge, children }: CategorySectionProps) {
  const headingId = `${category.slug}-heading`;
  return (
    <section id={category.slug} className={`${SURFACES[surface]} ${styles.section}`} aria-labelledby={headingId}>
      <div className={styles.wrap}>
        <header className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>
              <i className={styles.slash} />
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span>{category.eyebrow}</span>
            </p>
            <h2 id={headingId} className={styles.h2} data-reveal="up">
              {category.plural}
            </h2>
          </div>
          <div className={styles.headAside}>
            <p className={styles.lede} data-reveal="up">
              {category.blurb}
            </p>
            {badge ? <p className={styles.badge}>{badge}</p> : null}
          </div>
        </header>
        {children}
      </div>
    </section>
  );
}

/** A dignified empty state. `unavailable` is used when we could not ask, which is not the same as "none". */
export function EmptyState({ category, unavailable }: { category: ListedCategory; unavailable?: boolean }) {
  return (
    <div className={styles.empty} role={unavailable ? "status" : undefined} data-reveal="up">
      <span className={styles.emptyMark} aria-hidden="true" />
      <div>
        <h3>{unavailable ? UNAVAILABLE_TITLE : EMPTY_TITLE}</h3>
        <p>{unavailable ? UNAVAILABLE_BODY : EMPTY_BODY[category]}</p>
        {unavailable ? null : (
          <Link className={styles.textLink} href={ROUTES.contact}>
            Ask us about this
          </Link>
        )}
      </div>
    </div>
  );
}
