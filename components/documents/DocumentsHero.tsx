import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import { DOCS_HERO } from "./content";
import styles from "./documents.module.css";

interface Word {
  text: string;
  accent: boolean;
}

/** Splits the headline into words so each rises through its own mask; "check" is the accent. */
function headlineWords(): Word[] {
  const words = (text: string, accent: boolean) =>
    text
      .split(" ")
      .filter(Boolean)
      .map((word) => ({ text: word, accent }));
  return [...words(DOCS_HERO.lead, false), ...words(DOCS_HERO.emphasis, true), ...words(DOCS_HERO.tail, false)];
}

export default function DocumentsHero() {
  const words = headlineWords();
  return (
    <section className={`${ui.ink} ${styles.hero}`} aria-labelledby="documents-h1">
      <span className={styles.heroGlow} aria-hidden="true" />
      <Scrub start={0} end={0} className={styles.wrap}>
        <span className={styles.bigslash} aria-hidden="true">
          <span className={styles.sweep} />
        </span>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>
            <i className={styles.slash} />
            <b>{DOCS_HERO.eyebrow}</b>
          </p>
          <h1 id="documents-h1" className={styles.title}>
            {words.map((word, i) => (
              <Fragment key={i}>
                <span className={styles.word} style={{ "--i": i } as CSSProperties}>
                  <span className={word.accent ? `${styles.wordIn} ${styles.accentWord}` : styles.wordIn}>{word.text}</span>
                </span>{" "}
              </Fragment>
            ))}
          </h1>
          <p className={styles.lede}>{DOCS_HERO.lede}</p>
          <div className={styles.cta}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={ROUTES.verify}>
              Verify a document
            </Link>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href={ROUTES.contact}>
              Contact
            </Link>
          </div>
        </div>
      </Scrub>
    </section>
  );
}
