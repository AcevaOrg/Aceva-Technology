import type { CSSProperties, ReactNode } from "react";
import type { PublicState } from "@/lib/documents/public";
import { VERDICTS } from "./content";
import styles from "./documents.module.css";

/** Reveal delay for the nth item of a group, capped so a long list never waits several seconds. */
export function stagger(index: number, step = 70): CSSProperties {
  return { "--d": `${Math.min(index, 6) * step}ms` } as CSSProperties;
}

/** Valid / Expired / Revoked as a small labelled chip. The text carries the meaning; colour only echoes it. */
export function StateChip({ state }: { state: PublicState }) {
  return (
    <span className={styles.chip} data-tone={state === "valid" ? "good" : state === "expired" ? "warn" : "bad"}>
      {VERDICTS[state].badge}
    </span>
  );
}

export function TagList({ tags, label }: { tags: string[]; label: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={styles.tags} aria-label={label}>
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}

/** One label/value pair inside a <dl>; renders nothing when there is no value to show. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
