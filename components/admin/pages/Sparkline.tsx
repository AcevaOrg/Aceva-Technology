import { formatCount, plural } from "./format";
import s from "./pages.module.css";
import { sparkGeometry } from "./sparkGeometry";
import { summariseDaily, type DailyPoint } from "./verificationView";

interface SparklineProps {
  points: readonly DailyPoint[];
  /** What is being counted, singular: "lookup". */
  noun: string;
  /** Lookups were read from a capped window, so the figures are lower bounds. */
  truncated?: boolean;
}

/**
 * A small pure-SVG line of one count per day. One series, so there is no legend: the panel title names
 * it. The line is 2px, the last day carries a marker with a surface ring, and the figures that matter
 * (total, busiest day) are plain text beside it rather than numbers stacked on the chart. The SVG has a
 * text alternative, each day has a native tooltip, and the line draws itself once (not under reduced motion).
 */
export function Sparkline({ points, noun, truncated }: SparklineProps) {
  const geometry = sparkGeometry(points.map((point) => point.count));
  const summary = summariseDaily(points);
  const last = geometry.points[geometry.points.length - 1];
  const first = points[0];
  const days = points.length;

  const label =
    summary.total === 0
      ? `No ${plural(0, noun)} in the last ${days} days.`
      : `${formatCount(summary.total)} ${plural(summary.total, noun)} in the last ${days} days, busiest on ${summary.peakDay?.label} with ${formatCount(summary.peak)}.`;

  return (
    <div className={s.spark}>
      <svg className={s.sparkSvg} viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={label}>
        <line className={s.sparkBase} x1={0} x2={geometry.width} y1={geometry.baseline} y2={geometry.baseline} />
        {geometry.area ? <path className={s.sparkArea} d={geometry.area} /> : null}
        {geometry.line ? <path className={s.sparkLine} d={geometry.line} pathLength={1} /> : null}
        {last ? <circle className={s.sparkDot} cx={last.x} cy={last.y} r={4.5} /> : null}
        {geometry.points.map((point, index) => (
          <rect
            key={points[index]?.date ?? index}
            className={s.sparkHit}
            x={point.x - geometry.step / 2}
            y={0}
            width={geometry.step}
            height={geometry.height}
          >
            <title>{`${points[index]?.label}: ${points[index]?.count} ${plural(points[index]?.count ?? 0, noun)}`}</title>
          </rect>
        ))}
      </svg>
      <div className={s.sparkAxis} aria-hidden="true">
        <span>{first?.label}</span>
        <span>Today</span>
      </div>
      <p className={s.sparkFacts}>
        <span>
          <b>{formatCount(summary.total)}</b>
          {truncated ? "+" : ""} {plural(summary.total, noun)} in {days} {plural(days, "day")}
        </span>
        {summary.peakDay ? (
          <span>
            Busiest <b>{summary.peakDay.label}</b> ({formatCount(summary.peak)})
          </span>
        ) : (
          <span>Nothing scanned yet</span>
        )}
      </p>
    </div>
  );
}
