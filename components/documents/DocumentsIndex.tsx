"use client";

import { useEffect, useRef, useState } from "react";
import ui from "@/components/home/home.module.css";
import styles from "./documents.module.css";

export interface IndexItem {
  slug: string;
  label: string;
}

/**
 * The sticky section index. The links are plain in-page anchors and work without JavaScript; with
 * it, the link for the section currently under the reader's eye is marked `aria-current` and, on a
 * narrow screen where the row scrolls sideways, brought into view.
 */
export default function DocumentsIndex({ items }: { items: IndexItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const sections = items
      .map((item) => document.getElementById(item.slug))
      .filter((element): element is HTMLElement => element !== null);

    // A section counts as "current" while it crosses a thin band a little above the viewport's middle.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-35% 0px -60% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !active) return;
    const link = list.querySelector<HTMLElement>(`a[href="#${CSS.escape(active)}"]`);
    if (!link || list.scrollWidth <= list.clientWidth) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }, [active]);

  return (
    <nav className={styles.index} aria-label="Document categories">
      <ol ref={listRef} className={`${ui.ink} ${styles.indexList}`}>
        {items.map((item, i) => (
          <li key={item.slug}>
            <a className={styles.indexLink} href={`#${item.slug}`} aria-current={active === item.slug ? "location" : undefined}>
              <span className={styles.indexN} aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
