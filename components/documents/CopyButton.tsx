"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./verify.module.css";

type CopyState = "idle" | "copied" | "failed";

/** Copies a value to the clipboard and says so in a live region, for the SHA-256 fingerprint. */
export default function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let next: CopyState = "copied";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard access can be refused (permissions, insecure context); the text stays selectable.
      next = "failed";
    }
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2400);
  }

  return (
    <>
      <button type="button" className={styles.copy} onClick={copy} data-state={state}>
        {state === "copied" ? "Copied" : label}
      </button>
      <span className={styles.srOnly} role="status">
        {state === "copied" ? "Fingerprint copied to the clipboard" : state === "failed" ? "Could not copy. Select the text and copy it instead." : ""}
      </span>
    </>
  );
}
