"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { capabilityRoute } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { HomeCapability } from "./content";
import ui from "./home.module.css";
import styles from "./capabilities.module.css";

const SHORT_LABEL: Record<string, string> = {
  digital: "Digital",
  software: "Software",
  mobile: "Mobile",
  intelligence: "Intelligence",
  rescue: "Rescue",
};

/**
 * Sticky storytelling for the five capabilities. On wide screens the drawing stage
 * sticks while the text panels scroll past it naturally (no scroll hijacking); the
 * panel crossing the middle of the viewport becomes active. Small screens stack.
 */
export default function CapabilityStory({ items, visuals }: { items: HomeCapability[]; visuals: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const panelsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const panels = panelsRef.current.filter((el): el is HTMLElement => Boolean(el));
    if (!panels.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = panels.indexOf(entry.target as HTMLElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    panels.forEach((panel) => io.observe(panel));
    return () => io.disconnect();
  }, []);

  return (
    <div className={styles.story}>
      <div className={styles.stage}>
        <nav className={styles.tabs} aria-label="Capability index">
          <ol className={styles.tabList}>
            {items.map((item, index) => (
              <li key={item.key}>
                <a href={`#cap-${item.key}`} className={styles.tab} aria-current={index === active ? "true" : undefined}>
                  <span className={styles.tabNum}>{item.num}</span>
                  {SHORT_LABEL[item.key]}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className={styles.frames} aria-hidden="true">
          {visuals.map((visual, index) => (
            <div key={items[index].key} className={styles.frame} data-active={index === active || undefined}>
              {visual}
            </div>
          ))}
        </div>
        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressBar} style={{ transform: `scaleX(${(active + 1) / items.length})` }} />
        </div>
      </div>

      <div className={styles.side}>
        <div className={styles.panels}>
          {items.map((item, index) => (
            <article
              key={item.key}
              id={`cap-${item.key}`}
              ref={(el) => {
                panelsRef.current[index] = el;
              }}
              className={styles.panel}
              data-active={index === active || undefined}
              aria-labelledby={`cap-${item.key}-title`}
            >
              <div className={styles.panelVisual} aria-hidden="true">
                {visuals[index]}
              </div>
              <p className={styles.panelNum}>
                <span className={styles.panelIndex}>{item.num}</span>
                <span className={styles.panelOf}>/ 05</span>
                {item.flagship && <span className={styles.flag}>Flagship</span>}
              </p>
              <h3 id={`cap-${item.key}-title`} className={styles.panelTitle}>
                {item.name}
              </h3>
              <p className={styles.panelShort}>{item.short}</p>
              <ul className={styles.includes}>
                {item.includes.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
              <Link href={capabilityRoute(item.key)} className={ui.textLink}>
                Explore {item.name}
                <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
