"use client";

import { useClockBucket } from "@/components/admin/hooks";
import { formatRelative, formatUtcStamp } from "./format";
import s from "./pages.module.css";

interface LocalTimeProps {
  /** ISO 8601 timestamp. */
  iso: string;
  /** The server's clock when the page rendered, so the first client render matches the server HTML. */
  nowMs: number;
}

const LOCAL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

/**
 * "3 hours ago" over "12 Mar 2026, 19:05 GMT+5". The server and the hydration pass render the UTC
 * time against the server's clock (identical markup, so no hydration mismatch); once mounted, the
 * browser swaps in its own time zone and clock, which is what the person actually wants to read.
 */
export function LocalTime({ iso, nowMs }: LocalTimeProps) {
  // 0 on the server and during hydration, the browser's clock (floored to a minute) afterwards.
  const clock = useClockBucket(60_000);
  const mounted = clock !== 0;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return <span className={s.quiet}>{iso}</span>;

  const relative = formatRelative(time, mounted ? clock : nowMs);
  const absolute = mounted ? LOCAL_FORMAT.format(time) : formatUtcStamp(iso);
  return (
    <span className={s.timeStack}>
      <time dateTime={iso}>{relative}</time>
      <span className={s.timeAbs}>{absolute}</span>
    </span>
  );
}
