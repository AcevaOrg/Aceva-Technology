import type { CSSProperties } from "react";
import Link from "next/link";
import { ABOUT_BUILT } from "@/lib/data/about";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import styles from "./about.module.css";
import Arrow from "./Arrow";

export default function AboutBuilt() {
  return (
    <section className={`${ui.paper2} ${styles.built}`} aria-labelledby="about-built">
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>
          <i className={styles.slash} />
          {ABOUT_BUILT.eyebrow}
        </p>
        <h2 id="about-built" className={`${styles.h2} ${styles.builtTitle}`} data-reveal="up">
          {ABOUT_BUILT.title}
        </h2>
        <Scrub start={0.95} end={0.4} className={styles.cols} style={{ "--n": ABOUT_BUILT.columns.length } as CSSProperties}>
          {ABOUT_BUILT.columns.map((col, i) => (
            <div key={col.kicker} className={styles.col} style={{ "--i": i } as CSSProperties}>
              <span className={styles.k}>{col.kicker}</span>
              <h3>{col.title}</h3>
              <p>{col.body}</p>
            </div>
          ))}
        </Scrub>
        <Link className={styles.more} href={ABOUT_BUILT.href} data-reveal="up">
          {ABOUT_BUILT.linkLabel} <Arrow size={15} />
        </Link>
      </div>
    </section>
  );
}
