import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import { DEMO_REVIEWS } from "./content";
import ui from "./home.module.css";
import styles from "./reviews.module.css";

/**
 * The existing demo reviews from data/reviews.json, kept at the client's request and
 * labelled as demo content so they are never mistaken for verified client feedback.
 * Homepage-only markup; components/features/ReviewCard (used by /testimonials) is untouched.
 */
export default function DemoReviews() {
  return (
    <section id="feedback" className={`${ui.paper} ${ui.section} ${styles.reviews}`} aria-labelledby="feedback-title">
      <div className={ui.wrap}>
        <header className={ui.head}>
          <div data-reveal="up">
            <p className={ui.eyebrow}>
              <span className={ui.slash} aria-hidden="true" />
              <b>06</b> Feedback
            </p>
            <h2 id="feedback-title" className={ui.h2}>
              Perspectives from across our services.
            </h2>
          </div>
          <div className={ui.headAside} data-reveal="up" style={{ "--d": "90ms" } as CSSProperties}>
            <p className={styles.notice}>
              Illustrating how client feedback will appear on this site.
            </p>
            <Link href={ROUTES.testimonials} className={ui.textLink}>
              View all
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <div className={styles.grid}>
          {DEMO_REVIEWS.map((review, n) => {
            const rating = Math.max(0, Math.min(5, Math.round(review.rating)));
            return (
              <figure
                key={`${review.name}-${review.business}`}
                className={styles.card}
                data-reveal="up"
                style={{ "--d": `${n * 90}ms` } as CSSProperties}
              >
                <div className={styles.top}>
                  <span className={styles.service}>{review.service}</span>
                  <span className={styles.stars} role="img" aria-label={`${rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, k) => (
                      <span key={k} className={k < rating ? styles.starOn : undefined} aria-hidden="true">
                        ★
                      </span>
                    ))}
                  </span>
                </div>
                <blockquote className={styles.quote}>
                  <p>&ldquo;{review.description}&rdquo;</p>
                </blockquote>
                <figcaption className={styles.author}>
                  <span className={styles.name}>{review.name}</span>
                  <span className={styles.business}>{review.business}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
