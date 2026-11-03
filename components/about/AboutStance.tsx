import type { CSSProperties } from "react";
import { ABOUT_STANCE, PROOF_POINTS } from "@/lib/data/about";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import styles from "./about.module.css";

/** Renders **bold** spans from the data file without dangerouslySetInnerHTML. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
    </>
  );
}

export default function AboutStance() {
  return (
    <section className={`${ui.paper} ${styles.stance}`} aria-labelledby="about-stance">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>
          <i className={styles.slash} />
          {ABOUT_STANCE.eyebrow}
        </p>
        <div className={styles.stanceGrid}>
          <div className={styles.copy}>
            <h2 id="about-stance" className={styles.h2} data-reveal="up">
              {ABOUT_STANCE.title}
            </h2>
            {ABOUT_STANCE.paragraphs.map((p) => (
              <p key={p} data-reveal="up">
                <Rich text={p} />
              </p>
            ))}
          </div>
          <Scrub start={0.92} end={0.35} className={styles.competeWrap} style={{ "--n": PROOF_POINTS.length } as CSSProperties}>
            <ol className={styles.compete} aria-label="What we compete on">
              {PROOF_POINTS.map((p, i) => (
                <li key={p.num} style={{ "--i": i } as CSSProperties}>
                  <div>
                    {p.title}
                    <small>{p.gist}</small>
                  </div>
                </li>
              ))}
            </ol>
          </Scrub>
        </div>
      </div>
    </section>
  );
}
