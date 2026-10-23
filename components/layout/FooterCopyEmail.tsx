"use client";

import { useEffect, useRef, useState } from "react";

const LABELS = { idle: "Copy", copied: "Copied", failed: "Copy failed" } as const;
const ANNOUNCEMENTS = { idle: "", copied: "Email address copied", failed: "Could not copy. Select the address instead." } as const;

/** One-click copy for visitors who do not use a desktop mail client. */
export default function FooterCopyEmail({
  email,
  className,
  statusClassName,
}: {
  email: string;
  className?: string;
  statusClassName?: string;
}) {
  const [state, setState] = useState<keyof typeof LABELS>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2400);
  };

  return (
    <>
      <button type="button" className={className} onClick={copy} data-state={state} aria-label="Copy email address">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {state === "copied" ? (
            <path d="M20 6 9 17l-5-5" />
          ) : (
            <>
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
            </>
          )}
        </svg>
        <span aria-hidden="true">{LABELS[state]}</span>
      </button>
      <span role="status" className={statusClassName}>
        {ANNOUNCEMENTS[state]}
      </span>
    </>
  );
}
