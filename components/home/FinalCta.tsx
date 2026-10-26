import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { CONTACT_EMAIL } from "@/lib/social";
import { ArrowRightIcon } from "@/components/ui/icons";
import { FAQ_TEASERS } from "./content";
import ui from "./home.module.css";
import styles from "./cta.module.css";

export default function FinalCta() {
  return (
    <section id="start" className={`${ui.ink} ${styles.cta}`} aria-labelledby="start-title">
      <div className={styles.beam} aria-hidden="true">
        <span className={styles.beamLines} />
        <span className={styles.beamCore} />
      </div>
      <div className={ui.wrap}>
        <div className={styles.grid}>
          <div>
            <p className={ui.eyebrow} data-reveal="up">
              <span className={ui.slash} aria-hidden="true" />
              <b>07</b> Start a project
            </p>
            <h2 id="start-title" className={`${ui.h2} ${styles.title}`} data-reveal="up">
              Tell us what is costing you the most time, money or customer trust.
            </h2>
            <p className={`${ui.lede} ${styles.lede}`} data-reveal="up" style={{ "--d": "80ms" } as CSSProperties}>
              A short qualification form, then a meeting. We reply from {CONTACT_EMAIL}.
            </p>
            <div className={`${ui.actions} ${styles.actions}`} data-reveal="up" style={{ "--d": "140ms" } as CSSProperties}>
              <Link href={ROUTES.contact} className={`${ui.btn} ${ui.btnPrimary}`}>
                Start a project
                <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
              </Link>
              <a href={`mailto:${CONTACT_EMAIL}`} className={`${ui.btn} ${ui.btnGhost}`}>
                Email us directly
              </a>
            </div>
          </div>

          <nav className={styles.faq} aria-labelledby="start-faq" data-reveal="up" style={{ "--d": "200ms" } as CSSProperties}>
            <p id="start-faq" className={styles.faqLabel}>
              Common questions
            </p>
            <ul className={styles.faqList}>
              {FAQ_TEASERS.map((question) => (
                <li key={question}>
                  <Link href={ROUTES.faq} className={styles.faqLink}>
                    {question}
                    <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </section>
  );
}
