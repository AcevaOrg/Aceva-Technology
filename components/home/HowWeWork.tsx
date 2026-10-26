import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import Scrub from "./Scrub";
import { CAPABILITIES, COMMITMENTS, PRINCIPLE, PROCESS_STEPS, SIGNATURES } from "./content";
import ui from "./home.module.css";
import styles from "./how.module.css";

const WORDS = PRINCIPLE.split(" ");
/** "proving more." carries the accent once lit. */
const ACCENT_FROM = WORDS.length - 2;

export default function HowWeWork() {
  return (
    <section id="how-we-work" className={`${ui.paper} ${ui.section} ${styles.how}`} aria-labelledby="how-title">
      <div className={ui.wrap}>
        <p className={ui.eyebrow} data-reveal="up">
          <span className={ui.slash} aria-hidden="true" />
          <b>04</b> How we work
        </p>

        <Scrub start={0.95} end={0.68} className={styles.quoteWrap}>
          <h2 id="how-title" className={styles.quote} style={{ "--n": WORDS.length } as CSSProperties}>
            <span className={ui.srOnly}>{PRINCIPLE}</span>
            <span aria-hidden="true">
              {WORDS.map((word, n) => (
                <span key={`${word}-${n}`} className={n >= ACCENT_FROM ? `${styles.word} ${styles.accent}` : styles.word} style={{ "--i": n } as CSSProperties}>
                  {word}{" "}
                </span>
              ))}
            </span>
          </h2>
        </Scrub>

        <div className={styles.process}>
          <div className={styles.processHead} data-reveal="up">
            <p className={styles.subhead}>The delivery loop</p>
            <Link href={ROUTES.process} className={ui.textLink}>
              Full process
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
          </div>
          <Scrub start={0.88} end={0.55} className={styles.timeline}>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.trackFill} />
            </span>
            <ol className={styles.steps}>
              {PROCESS_STEPS.map((step, n) => (
                <li key={step.n} className={styles.step} style={{ "--i": n } as CSSProperties}>
                  <span className={styles.node} aria-hidden="true">
                    <span className={styles.nodeFill} />
                  </span>
                  <span className={styles.stepNum}>Step {step.n}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepBody}>{step.body}</p>
                </li>
              ))}
            </ol>
          </Scrub>
        </div>

        <div className={styles.split}>
          <div data-reveal="up">
            <p className={styles.subhead}>What you can hold us to</p>
            <ul className={styles.commitments}>
              {COMMITMENTS.map((item) => (
                <li key={item.title}>
                  <h3 className={styles.commitTitle}>{item.title}</h3>
                  <p className={styles.commitBody}>{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal="up" style={{ "--d": "90ms" } as CSSProperties}>
            <p className={styles.subhead}>What we will not promise</p>
            <ul className={styles.limits}>
              {CAPABILITIES.map((cap) => (
                <li key={cap.key}>
                  <span className={styles.limitNum}>{cap.num}</span>
                  <span>
                    <span className={styles.limitCap}>{cap.name}</span>
                    {cap.limit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className={styles.signatures} data-reveal="up">
          {SIGNATURES.map((line) => (
            <li key={line}>
              <span className={ui.slash} aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
