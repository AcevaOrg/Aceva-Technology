"use client";

import type { ReactNode } from "react";
import { usePulse } from "@/components/pulse/PulseContext";

/** Opens the on-site assistant from the footer's contact channels. */
export default function FooterPulseButton({ className, children }: { className?: string; children: ReactNode }) {
  const { openPulse } = usePulse();

  return (
    <button type="button" className={className} onClick={openPulse}>
      {children}
    </button>
  );
}
