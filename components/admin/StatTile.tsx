import type { ReactNode } from "react";
import s from "./admin.module.css";
import { CountUp } from "./CountUp";

export type StatTone = "default" | "success" | "warning" | "danger";

interface StatTileProps {
  /** Mono-caps caption: "Published documents". */
  label: string;
  /** Numbers count up when scrolled into view; strings render as given ("94%", "3 min ago"). */
  value: number | string;
  /** One quiet line under the value. */
  hint?: ReactNode;
  /** Colour of the accent bar on the left edge. */
  tone?: StatTone;
}

/** A headline number with an accent bar that grows on hover. Lay tiles out inside `.stats`. */
export function StatTile({ label, value, hint, tone = "default" }: StatTileProps) {
  return (
    <div className={s.stat} data-tone={tone === "default" ? undefined : tone}>
      <p className={s.statLabel}>{label}</p>
      <p className={s.statValue}>
        {typeof value === "number" ? <CountUp value={value} decimals={Number.isInteger(value) ? 0 : 1} /> : value}
      </p>
      {hint ? <p className={s.statHint}>{hint}</p> : null}
    </div>
  );
}
