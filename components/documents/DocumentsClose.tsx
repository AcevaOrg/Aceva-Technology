import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import Scrub from "@/components/home/Scrub";
import ui from "@/components/home/home.module.css";
import { DOCS_CLOSE } from "./content";
import styles from "./documents.module.css";

export default function DocumentsClose() {
  return (
    <section className={`${ui.ink} ${styles.close}`} aria-label="Verify a document">
      <Scrub start={1} end={0}>
        <span className={styles.closeSlash} aria-hidden="true" />
        <div className={styles.wrap}>
          <blockquote>
            {DOCS_CLOSE.lines.map((line, i) => (
              <span key={line} className={styles.qline} data-reveal="wipe" style={{ "--d": `${i * 160}ms` } as CSSProperties}>
                {line}{" "}
              </span>
            ))}
          </blockquote>
          <div className={styles.cta} data-reveal="up" style={{ "--d": "520ms" } as CSSProperties}>
            <Link className={`${styles.btn} ${styles.btnPrimary}`} href={ROUTES.verify}>
              Verify a document
            </Link>
            <Link className={`${styles.btn} ${styles.btnGhost}`} href={ROUTES.contact}>
              Talk to us
            </Link>
          </div>
        </div>
      </Scrub>
    </section>
  );
}
