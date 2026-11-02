import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ABOUT_HERO } from "@/lib/data/about";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import styles from "./about.module.css";

interface Word {
  text: string;
  accent: boolean;
}

/** Splits the headline into words so each can rise through its own mask; "proving" is the accent. */
function headlineWords(): Word[] {
  const words = (s: string, accent: boolean) =>
    s
      .split(" ")
      .filter(Boolean)
      .map((text) => ({ text, accent }));
  return [...words(ABOUT_HERO.lead, false), ...words(ABOUT_HERO.emphasis, true), ...words(ABOUT_HERO.tail, false)];
}

export default function AboutHero() {
  const words = headlineWords();
  return (
    <section className={`${ui.ink} ${styles.hero}`} aria-labelledby="about-h1">
      <span className={styles.heroGlow} aria-hidden="true" />
      <Scrub start={0} end={0} className={styles.wrap}>
        <span className={styles.bigslash} aria-hidden="true">
          <span className={styles.sweep} />
        </span>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>
            <i className={styles.slash} />
            <b>{ABOUT_HERO.eyebrow}</b>
          </p>
          <h1 id="about-h1" className={styles.title}>
            {words.map((w, i) => (
              <Fragment key={i}>
                <span className={styles.word} style={{ "--i": i } as CSSProperties}>
                  <span className={w.accent ? `${styles.wordIn} ${styles.proving}` : styles.wordIn}>{w.text}</span>
                </span>{" "}
              </Fragment>
            ))}
          </h1>
          <p className={styles.lede}>{ABOUT_HERO.lede}</p>
          <div className={styles.cta}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={ROUTES.contact}>
              Start a Project
            </Link>
            <a className={`${styles.btn} ${styles.btnGhost}`} href="#proof">
              See the proof
            </a>
          </div>
        </div>
      </Scrub>
    </section>
  );
}
