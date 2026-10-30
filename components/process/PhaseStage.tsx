import type { CSSProperties } from "react";
import { DELIVERABLES, PROCESS_PHASES } from "@/lib/data/process";
import { PILE, STAMPS } from "./stamps";
import styles from "./phases.module.css";

const TOTAL = DELIVERABLES.length;

/**
 * The dossier: a sticky folder beside the phase articles. As each phase's top crosses the middle
 * of the screen (PhaseSpy writes --n), its three sheets are dealt onto the pile, the last one
 * stamped. All of it is CSS keyed off --n, --ap and --landed; the fallbacks are the finished kit.
 * Decorative and hidden from assistive tech: the articles beside it carry the same text.
 */
export default function PhaseStage() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.folder}>
        <div className={styles.folderHead}>
          <span className={styles.folderTab}>Your handover kit</span>
          <span className={styles.now}>
            <span data-ph="0">Starts at Understand</span>
            {PROCESS_PHASES.map((phase, k) => (
              <span key={phase.key} data-ph={k + 1}>
                Phase {phase.n} · {phase.title}
              </span>
            ))}
            <span data-ph="all">All five phases</span>
          </span>
        </div>

        <div className={styles.pile}>
          {DELIVERABLES.map((sheet, g) => {
            const ph = PROCESS_PHASES.findIndex((p) => p.key === sheet.phase) + 1;
            return (
              <div
                key={sheet.text}
                className={styles.paper}
                style={
                  {
                    "--g": g,
                    "--ph": ph,
                    "--j": sheet.index,
                    "--dx": `${PILE[g].dx}px`,
                    "--rot": `${PILE[g].rot}deg`,
                  } as CSSProperties
                }
              >
                <span className={styles.paperHead}>
                  <span>
                    {sheet.n} · {PROCESS_PHASES[ph - 1].title}
                  </span>
                  <span>
                    {String(g + 1).padStart(2, "0")}/{TOTAL}
                  </span>
                </span>
                <span className={styles.paperTitle}>{sheet.text}</span>
                <span className={styles.paperLines}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {sheet.index === 2 && (
                  <span className={styles.paperStamp}>
                    <i />
                    {STAMPS[sheet.phase]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className={styles.folderFoot}>
          <span className={styles.count}>
            <b />
            <span>of {TOTAL} in your hands</span>
            <em>Complete</em>
          </span>
          <span className={styles.ticks}>
            {PROCESS_PHASES.map((phase, k) => (
              <span key={phase.key} className={styles.tick} style={{ "--k": k + 1 } as CSSProperties}>
                <span>{phase.n}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
