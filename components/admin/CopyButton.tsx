"use client";

import { useEffect, useRef, useState } from "react";
import s from "./admin.module.css";
import { Button } from "./Button";
import { CheckIcon, CopyIcon } from "./icons";

interface CopyButtonProps {
  /** The text placed on the clipboard (a verification code, a URL). Never logged. */
  value: string;
  /** Visible button text. Defaults to "Copy". */
  label?: string;
}

/** Clipboard API first; a hidden textarea and execCommand where it is unavailable (plain http, old Safari). */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or insecure context: fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}

/** A small ghost button that copies `value` and confirms it ("Copied") for two seconds. */
export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const copied = await writeToClipboard(value);
    setState(copied ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        shine={false}
        className={s.copyBtn}
        data-state={state === "idle" ? undefined : state}
        iconLeading={state === "copied" ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
        onClick={copy}
      >
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
      </Button>
      <span role="status" className={s.srOnly}>
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Could not copy to clipboard" : ""}
      </span>
    </>
  );
}
