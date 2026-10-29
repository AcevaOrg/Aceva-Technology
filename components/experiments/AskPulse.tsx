"use client";

import { usePulse } from "@/components/pulse/PulseContext";
import { c } from "./cx";

/** Opens the real on-site assistant, which is available on every page. */
export default function AskPulse() {
  const { openPulse } = usePulse();
  return (
    <button type="button" className={c("btn", "btn-primary")} onClick={openPulse}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
      Ask Aceva Pulse
    </button>
  );
}
