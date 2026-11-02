import type { CSSProperties } from "react";
import Link from "next/link";
import { ABOUT_PROOF, PROOF_POINTS } from "@/lib/data/about";
import ui from "@/components/home/home.module.css";
import styles from "./about.module.css";
import Arrow from "./Arrow";

export default function AboutProof() {
  return (
    <section id="proof" className={`${ui.ink} ${styles.proof}`} aria-labelledby="about-proof">
      <div className={styles.wrap}>
        <header className={styles.proofHead}>
          <div>
            <p className={styles.eyebrow}>
              <i className={styles.slash} />
              {ABOUT_PROOF.eyebrow}
            </p>
            <h2 id="about-proof" className={styles.h2} data-reveal="up">
              {ABOUT_PROOF.title}
            </h2>
          </div>
          <p className={styles.lede} data-reveal="up">
            {ABOUT_PROOF.lede}
          </p>
        </header>
        <div className={styles.rows}>
          {PROOF_POINTS.map((p, i) => (
            <Link key={p.num} className={styles.row} href={p.href} data-reveal="wipe" style={{ "--d": `${i * 70}ms` } as CSSProperties}>
              <span className={styles.n}>{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.claim}</p>
              <span className={styles.go}>
                {p.linkLabel} <Arrow />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
