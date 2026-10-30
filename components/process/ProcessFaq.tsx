import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { PROCESS_FAQS } from "@/lib/data/process";
import { ArrowRightIcon } from "@/components/ui/icons";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";

/**
 * Process questions, quoted word for word from the FAQ page. Native <details>, so every answer
 * is in the HTML and works without JavaScript. No FAQPage schema here: /faq already carries it.
 */
export default function ProcessFaq() {
  return (
    <section id="process-faq" className={`${ui.paper2} ${ui.section}`} aria-labelledby="process-faq-title">
      <div className={`${ui.wrap} ${styles.faqGrid}`}>
        <div className={styles.faqHead}>
          <p className={ui.eyebrow} data-reveal="up">
            <span className={ui.slash} aria-hidden="true" />
            <b>05</b> Questions
          </p>
          <h2 id="process-faq-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
            Before you ask.
          </h2>
          <Link className={ui.textLink} href={ROUTES.faq}>
            All questions
            <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
          </Link>
        </div>
        <div className={styles.faqList} data-reveal="up">
          {PROCESS_FAQS.map((faq) => (
            <details key={faq.q} className={styles.faq}>
              <summary>
                {faq.q}
                <span className={styles.plus} aria-hidden="true" />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
