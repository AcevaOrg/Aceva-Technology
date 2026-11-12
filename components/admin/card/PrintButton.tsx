"use client";

import { Button } from "@/components/admin/Button";
import { PrintIcon } from "@/components/admin/icons";

interface PrintButtonProps {
  /** True while the readiness checklist still has a blocker: printing now would waste a sheet of labels. */
  disabled?: boolean;
  label?: string;
  block?: boolean;
}

/** The longest a click waits for the QR images to arrive before printing anyway. */
const IMAGE_WAIT_MS = 4000;

/**
 * Resolves once every image on the print sheet has loaded. They normally have long before anyone clicks,
 * so the common path resolves at once; only a click made immediately after the page opens waits. A broken
 * image never blocks printing: the checklist, not this function, is what guards a missing QR.
 */
async function imagesReady(): Promise<void> {
  const pending = Array.from(document.querySelectorAll<HTMLImageElement>("[data-print-sheets] img")).filter((image) => !image.complete);
  if (pending.length === 0) return;
  const settled = Promise.all(pending.map((image) => image.decode().catch(() => undefined)));
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_WAIT_MS));
  await Promise.race([settled, timeout]);
}

function print() {
  void imagesReady().then(() => window.print());
}

/**
 * Opens the browser's print dialog. What prints is decided entirely by CSS (card.module.css): while a
 * PrintSheets host is mounted, @media print shows that and nothing else, so this button needs no state.
 */
export function PrintButton({ disabled = false, label = "Print", block }: PrintButtonProps) {
  return (
    <Button
      iconLeading={<PrintIcon />}
      block={block}
      disabled={disabled}
      title={disabled ? "Fix the items in the checklist first" : undefined}
      onClick={print}
    >
      {label}
    </Button>
  );
}
