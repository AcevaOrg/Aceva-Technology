import styles from "./ReviewCard.module.css";

export type Review = {
  name: string;
  business: string;
  service: string;
  rating: number;
  description: string;
};

export default function ReviewCard({ review }: { review: Review }) {
  const rating = Math.max(0, Math.min(5, Math.round(review.rating)));

  return (
    <article className={styles.card}>
      <div className={styles.topline}>
        <p className={styles.service}>{review.service}</p>
        <span className={styles.stars} aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} className={index >= rating ? styles.emptyStar : undefined} aria-hidden="true">★</span>
          ))}
        </span>
      </div>
      <blockquote className={styles.quote}>&ldquo;{review.description}&rdquo;</blockquote>
      <footer className={styles.author}>
        <p className={styles.name}>{review.name}</p>
        <p className={styles.business}>{review.business}</p>
      </footer>
    </article>
  );
}
