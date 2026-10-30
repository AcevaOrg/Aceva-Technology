import type { CSSProperties } from "react";
import { OWNERSHIP_ROWS, PROCESS_COMMITMENTS } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";

/** "Your code. Your accounts. Your data." — the first three sentences of the ownership commitment. */
const OWNERSHIP_LEDE = PROCESS_COMMITMENTS[1].body.split(". ").slice(0, 3).join(". ") + ".";

/** "You — we are measured against them" → a badge ("You") and the qualifier. */
function splitHolder(held: string) {
  const [who, ...rest] = held.split(" — ");
  return { who, rest: rest.join(" — "), you: who === "You" };
}

/**
 * A real table. On phones each row reflows into a card; the explicit roles keep the table
 * semantics in Safari, which drops them once a table's display is changed.
 */
export default function OwnershipLedger() {
  return (
    <section id="ownership" className={`${ui.paper} ${ui.section}`} aria-labelledby="ownership-title">
      <div className={ui.wrap}>
        <div className={styles.headRow}>
          <div>
            <p className={ui.eyebrow} data-reveal="up">
              <span className={ui.slash} aria-hidden="true" />
              <b>03</b> Who owns what
            </p>
            <h2 id="ownership-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
              You own it. We answer for it.
            </h2>
          </div>
          <p className={ui.lede} data-reveal="up">
            {OWNERSHIP_LEDE} Here is exactly what that covers, and what we stay answerable for.
          </p>
        </div>

        <div className={styles.ledgerWrap} data-reveal="up">
          <table className={styles.ledger} role="table">
            <caption>Who holds what, and where this page says so</caption>
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  What
                </th>
                <th scope="col" role="columnheader">
                  Held by
                </th>
                <th scope="col" role="columnheader">
                  Stated in
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {OWNERSHIP_ROWS.map((row, r) => {
                const holder = splitHolder(row.held);
                return (
                  <tr key={row.item} role="row" style={{ "--r": r } as CSSProperties}>
                    <th scope="row" role="rowheader">
                      {row.item}
                    </th>
                    <td role="cell" data-label="Held by">
                      <span className={styles.owner} data-owner={holder.you ? "you" : "aceva"}>
                        <b>{holder.who}</b>
                        {holder.rest}
                      </span>
                    </td>
                    <td role="cell" data-label="Stated in">
                      {row.statedIn}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
