"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { verifyRoute, ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MAX_CODE_INPUT, charactersRemaining, formatCodeInput, normalizeCodeInput } from "./codeInput";
import styles from "./verifyForm.module.css";

interface VerifyFormProps {
  /** "hero" = the large field on /verify; "panel" = the compact one inside a category section. */
  variant?: "hero" | "panel";
  label?: string;
  buttonLabel?: string;
  /** A server-supplied starting value (for example, the code from a `?code=` link that did not parse). */
  initialValue?: string;
  /** A server-supplied message shown before the visitor types anything. */
  initialError?: string;
}

const INCOMPLETE = "That is not a full verification code yet. It starts with ACV and has 12 more letters and numbers.";

/**
 * The code box. It works without JavaScript too: the form is a plain GET to /verify?code=…, which
 * the page redirects to the canonical /verify/<code>. With JavaScript it formats as you type
 * (ACV-XXXX-XXXX-XXXX, any case, hyphens optional) and goes straight there.
 */
export default function VerifyForm({
  variant = "hero",
  label = "Verification code",
  buttonLabel = "Verify",
  initialValue = "",
  initialError = "",
}: VerifyFormProps) {
  const router = useRouter();
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(() => formatCodeInput(initialValue));
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);

  const remaining = charactersRemaining(value);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeCodeInput(value);
    if (!code) {
      setError(INCOMPLETE);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setBusy(true);
    router.push(verifyRoute(code));
  }

  return (
    <form className={`${styles.form} ${variant === "panel" ? styles.panel : styles.hero}`} action={ROUTES.verify} method="get" onSubmit={onSubmit} noValidate>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.row}>
        <input
          ref={inputRef}
          id={inputId}
          name="code"
          className={styles.input}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_CODE_INPUT}
          placeholder="ACV-XXXX-XXXX-XXXX"
          value={value}
          onChange={(event) => {
            setValue(formatCodeInput(event.target.value));
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        <button className={styles.button} type="submit" disabled={busy}>
          {busy ? "Checking…" : buttonLabel}
          {busy ? null : <ArrowRightIcon width={16} height={16} aria-hidden="true" />}
        </button>
      </div>
      <p id={hintId} className={styles.hint}>
        {remaining === 0
          ? "Looks complete. Press Verify."
          : "Capital letters, hyphens and spaces don't matter. We add them for you."}
      </p>
      <p id={errorId} className={styles.error} role="alert">
        {error}
      </p>
    </form>
  );
}
