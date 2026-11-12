import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import VerifyForm from "./VerifyForm";
import { VERDICTS, VERIFY_HERO, VERIFY_HINTS, VERIFY_STATES_SECTION, type VerifyKind } from "./content";
import { reportProblemHref } from "./format";
import Seal from "./Seal";
import styles from "./verify.module.css";

const PREVIEW: readonly VerifyKind[] = ["valid", "expired", "revoked", "not_found"];

interface VerifyLandingProps {
  /** A code that arrived as `?code=` but could not be read; shown back to the visitor to correct. */
  initialCode?: string;
  initialError?: string;
}

/**
 * /verify: one big field, a camera hint, and a plain preview of the four answers the next page can
 * give. It deliberately asks for nothing else: no sign-in, no email, no personal details.
 */
export default function VerifyLanding({ initialCode = "", initialError = "" }: VerifyLandingProps) {
  return (
    <div data-verify-root className={`${ui.root} ${styles.page}`}>
      <section className={`${ui.ink} ${styles.stage} ${styles.landing}`} aria-labelledby="verify-h1">
        <span className={styles.stageGlow} aria-hidden="true" />
        <span className={styles.bigslash} aria-hidden="true">
          <span className={styles.sweep} />
        </span>
        <div className={styles.wrap}>
          <div className={styles.landingInner}>
            <p className={styles.eyebrow}>
              <i className={styles.slash} />
              <b>{VERIFY_HERO.eyebrow}</b>
            </p>
            <h1 id="verify-h1" className={styles.title}>
              {VERIFY_HERO.title}
            </h1>
            <p className={styles.lede}>{VERIFY_HERO.lede}</p>
            <div className={styles.entry}>
              <VerifyForm variant="hero" initialValue={initialCode} initialError={initialError} />
            </div>
            <ul className={styles.hints}>
              {VERIFY_HINTS.map((hint, i) => (
                <li key={hint.title}>
                  <span className={styles.hintN} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className={`ac-heading-sm ${styles.hintTitle}`}>{hint.title}</h2>
                    <p>{hint.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`${ui.paper} ${styles.states}`} aria-labelledby="verify-states">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>
            <i className={styles.slash} />
            {VERIFY_STATES_SECTION.eyebrow}
          </p>
          <h2 id="verify-states" className={styles.h2} data-reveal="up">
            {VERIFY_STATES_SECTION.title}
          </h2>
          <p className={`${styles.lede} ${styles.statesLede}`} data-reveal="up">
            {VERIFY_STATES_SECTION.lede}
          </p>
          <ul className={styles.stateList}>
            {PREVIEW.map((kind, i) => (
              <li key={kind} className={styles.stateItem} data-reveal="up" style={{ "--d": `${i * 80}ms` } as CSSProperties}>
                <Seal kind={kind} size={72} tone="paper" />
                <div>
                  <h3>{VERDICTS[kind].badge}</h3>
                  <p>{VERDICTS[kind].body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${ui.ink} ${styles.help}`} aria-label="Need help">
        <div className={styles.wrap}>
          <p className={styles.helpText} data-reveal="up">
            Something looks wrong, or the code will not verify? Tell us and a person will look.
          </p>
          <div className={styles.cta} data-reveal="up">
            <a className={`${styles.btn} ${styles.btnPrimary}`} href={reportProblemHref(null)}>
              Report a problem
            </a>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href={ROUTES.documents}>
              Browse published documents
            </Link>
          </div>
        </div>
      </section>
      <HomeMotion root="[data-verify-root]" />
    </div>
  );
}
