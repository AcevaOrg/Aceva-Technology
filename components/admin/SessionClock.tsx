"use client";

import Link from "next/link";
import { ADMIN_ROUTES } from "@/lib/nav";
import s from "./admin.module.css";
import { useClockBucket } from "./hooks";
import { LockIcon } from "./icons";
import { formatDuration, toEpochMs } from "./utils";

interface SessionClockProps {
  /** When the session ends, as an epoch timestamp (milliseconds; seconds are detected and converted). */
  expiresAt: number;
}

const WARN_BELOW_MS = 10 * 60_000;

function formatEnd(end: number, now: number): string {
  const sameDay = new Date(end).toDateString() === new Date(now).toDateString();
  return new Date(end).toLocaleString(undefined, {
    ...(sameDay ? {} : { weekday: "short" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Ends 6:42 PM · 3h 12m left" in the viewer's own time zone. The server cannot know that zone, so the
 * time is filled in after hydration (until then the chip is a neutral "Session"), and it turns amber for
 * the last ten minutes.
 */
export function SessionClock({ expiresAt }: SessionClockProps) {
  const end = toEpochMs(expiresAt);
  const now = useClockBucket(30_000);

  if (now === 0) {
    return (
      <span className={s.sessionChip}>
        <LockIcon width={14} height={14} />
        <span>Session</span>
      </span>
    );
  }

  const remaining = end - now;
  if (remaining <= 0) {
    return (
      <Link href={ADMIN_ROUTES.login} className={s.sessionChip} data-state="warn">
        <LockIcon width={14} height={14} />
        <span>Session ended. Sign in</span>
      </Link>
    );
  }

  return (
    <span className={s.sessionChip} data-state={remaining < WARN_BELOW_MS ? "warn" : undefined}>
      <LockIcon width={14} height={14} />
      <span>
        Ends <b>{formatEnd(end, now)}</b>
      </span>
      <span className={s.sessionLong}>· {formatDuration(remaining)} left</span>
    </span>
  );
}
