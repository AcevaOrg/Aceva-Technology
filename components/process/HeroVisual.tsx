import type { CSSProperties } from "react";
import Scrub from "@/components/home/Scrub";
import { DELIVERABLES, PROCESS_PHASES } from "@/lib/data/process";
import styles from "./hero-visual.module.css";

const TITLES = Object.fromEntries(PROCESS_PHASES.map((p) => [p.key, p.title]));

/**
 * "The Paper Trail" hero: the fifteen written deliverables, dealt out along the logo's slash.
 * The first one, the problem statement, sits in front on paper. Scrolling the hero away squeezes
 * the fan into a stack, which is what the phases section then deals out again, one phase at a time.
 * Decorative: the same text is real content further down the page.
 */
export default function HeroVisual() {
  return (
    <Scrub start={0} end={0} className={styles.visual}>
      <div className={styles.fan} aria-hidden="true">
        <span className={styles.beam}>
          <span className={styles.glow} />
          <span className={styles.core} />
        </span>
        {DELIVERABLES.map((sheet, i) => (
          <div key={sheet.text} className={styles.sheet} style={{ "--i": i } as CSSProperties} data-front={i === 0 || undefined}>
            <div className={styles.sheetIn}>
              <span className={styles.sheetHead}>
                {sheet.n} · {TITLES[sheet.phase]}
                <i />
              </span>
              <span className={styles.sheetTitle}>{sheet.text}</span>
              <span className={styles.lines}>
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        ))}
      </div>
    </Scrub>
  );
}
