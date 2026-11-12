import type { CSSProperties } from "react";
import { adminStyles as ui } from "@/components/admin";
import { barHeight } from "./chartMath";
import { formatCount } from "./format";
import s from "./pages.module.css";
import type { DailyPoint } from "./verificationView";

interface DailyBarsProps {
  points: readonly DailyPoint[];
}

/**
 * Daily totals as columns: one per day, oldest to newest, the newest labelled in the accent colour.
 * It is a list, so a screen reader hears "21 Oct: 4 lookups" for each day; the printed counts and day
 * numbers are hidden from it to avoid saying everything twice.
 */
export function DailyBars({ points }: DailyBarsProps) {
  const max = Math.max(0, ...points.map((point) => point.count));
  return (
    <div>
      <ol className={s.daily} aria-label="Lookups per day">
        {points.map((point, index) => (
          <li key={point.date} className={s.dailyCol} title={`${point.label}: ${point.count}`}>
            <span className={ui.srOnly}>
              {point.label}: {point.count} {point.count === 1 ? "lookup" : "lookups"}
            </span>
            <span className={s.dailyValue} aria-hidden="true">
              {point.count > 0 ? formatCount(point.count) : ""}
            </span>
            <span
              className={s.dailyBar}
              data-zero={point.count === 0 ? "" : undefined}
              style={{ "--h": barHeight(point.count, max), "--i": index } as CSSProperties}
              aria-hidden="true"
            />
          </li>
        ))}
      </ol>
      <ol className={s.dailyAxis} aria-hidden="true">
        {points.map((point, index) => (
          <li key={point.date} className={s.dailyTick} data-today={index === points.length - 1 ? "" : undefined}>
            {point.date.slice(8)}
          </li>
        ))}
      </ol>
    </div>
  );
}
