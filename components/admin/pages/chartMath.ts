/**
 * Small arithmetic behind the dashboard's bars, kept apart from the components that draw them so it can
 * be tested without rendering anything.
 */

/** Each category's share of the busiest one, as a percentage of the track (0 when nothing exists). */
export function barShare(total: number, max: number): number {
  if (max <= 0 || total <= 0) return 0;
  return Math.round((total / max) * 1000) / 10;
}

/** Share of a daily column a bar may use; the rest is headroom for the count printed above it. */
export const BAR_SCALE = 82;

/** Height of a daily bar as a percentage of its column. A day with lookups is never rounded down to nothing. */
export function barHeight(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.max(3, Math.round((count / max) * BAR_SCALE * 10) / 10);
}
