"use client";

import { useState } from "react";
import Link from "next/link";
import { capabilityRoute, contactRoute } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { HOME_PATHS } from "./content";
import ui from "./home.module.css";
import styles from "./paths.module.css";

type HomePath = (typeof HOME_PATHS)[number];

export default function PathRows({ paths }: { paths: HomePath[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ul className={styles.rows}>
      {paths.map((path) => {
        const isOpen = open === path.key;
        const toggleId = `path-${path.key}-toggle`;
        const panelId = `path-${path.key}-panel`;

        return (
          <li key={path.key} className={styles.row} data-open={isOpen || undefined}>
            <div className={styles.rowHead}>
              <button
                type="button"
                id={toggleId}
                className={styles.toggle}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : path.key)}
              >
                <span className={styles.letter} aria-hidden="true">
                  {path.letter}
                </span>
                <span className={styles.sentence}>{path.sentence}</span>
                <span className={styles.icon} aria-hidden="true" />
              </button>
              <Link href={contactRoute(path.key)} className={styles.quick} tabIndex={isOpen ? -1 : undefined}>
                {path.cta}
                <ArrowRightIcon width={14} height={14} strokeWidth={2.2} />
              </Link>
            </div>

            <div id={panelId} role="region" aria-labelledby={toggleId} className={styles.panel}>
              <div className={styles.panelClip}>
                <div className={styles.panelBody}>
                  <div>
                    <h3 className={styles.headline}>{path.headline}</h3>
                    <p className={styles.body}>{path.body}</p>
                  </div>
                  <div className={styles.side}>
                    <p className={styles.sideLabel}>First engagement</p>
                    <p className={styles.sprint}>
                      <strong>{path.sprintName}</strong> — {path.sprintBody}
                    </p>
                    <Link href={contactRoute(path.key)} className={`${ui.btn} ${ui.btnPrimary} ${styles.cta}`}>
                      {path.cta}
                      <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
                    </Link>
                    <p className={styles.sideLabel}>Usually involves</p>
                    <ul className={styles.caps}>
                      {path.caps.map((cap) => (
                        <li key={cap.key}>
                          <Link href={capabilityRoute(cap.key)} className={styles.capLink}>
                            <span className={styles.capNum}>{cap.num}</span>
                            <span>
                              <span className={styles.capName}>{cap.name}</span>
                              <span className={styles.capWhy}>{cap.why}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
