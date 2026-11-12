/**
 * Geometry for the dashboard sparkline. Pure: counts in, SVG path strings out, so the drawing code in
 * Sparkline.tsx is only markup.
 */

export interface SparkGeometry {
  width: number;
  height: number;
  /** Where each day's marker sits. */
  points: { x: number; y: number }[];
  /** The polyline through the points. */
  line: string;
  /** The same line closed along the baseline, for the soft fill under it. */
  area: string;
  /** Y of the baseline. */
  baseline: number;
  /** Horizontal distance between neighbouring days (a hover target's width). */
  step: number;
}

export interface SparkBox {
  width: number;
  height: number;
  /** Left and right padding, so the end marker is not clipped. */
  padX: number;
  padTop: number;
  padBottom: number;
}

export const DEFAULT_SPARK_BOX: SparkBox = { width: 320, height: 84, padX: 8, padTop: 12, padBottom: 8 };

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Lays counts out left to right, oldest first. The tallest count touches the top padding; an all-zero
 * series is a flat line on the baseline rather than a division by zero.
 */
export function sparkGeometry(counts: readonly number[], box: SparkBox = DEFAULT_SPARK_BOX): SparkGeometry {
  const safe = counts.map((count) => (Number.isFinite(count) && count > 0 ? count : 0));
  const max = Math.max(1, ...safe);
  const baseline = box.height - box.padBottom;
  const span = baseline - box.padTop;
  const innerWidth = box.width - box.padX * 2;
  const step = safe.length > 1 ? innerWidth / (safe.length - 1) : innerWidth;

  const points = safe.map((count, index) => ({
    x: round(safe.length > 1 ? box.padX + index * step : box.width / 2),
    y: round(baseline - (count / max) * span),
  }));

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = first && last ? `${line} L${last.x} ${baseline} L${first.x} ${baseline} Z` : "";
  return { width: box.width, height: box.height, points, line, area, baseline, step: round(step) };
}
