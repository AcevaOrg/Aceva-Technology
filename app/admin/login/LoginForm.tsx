"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import s from "@/components/admin/admin.module.css";
import { Button } from "@/components/admin/Button";
import { AlertIcon, ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon } from "@/components/admin/icons";
import { IconButton } from "@/components/admin/IconButton";
import { formatCountdown, safeAdminPath } from "@/components/admin/utils";
import { describeApiError, isApiErrorBody, resolveRetryAfterSeconds } from "@/lib/api/errorCodes";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type Phase = "idle" | "submitting" | "success";
type Tone = "error" | "warn" | "neutral";

const WRONG_KEY = "That pass key did not work.";
const UNAVAILABLE = "The console is not available right now.";
const UNREACHABLE = "Could not reach the server. Check your connection and try again.";
const TROUBLE = "Something went wrong. Please try again.";
/** Used when a 429 arrives without a usable Retry-After. */
const FALLBACK_LOCKOUT_SECONDS = 60;

/** The `retryAfter` of a 429 body, else its Retry-After header, else a safe default. */
function lockoutSeconds(body: unknown, response: Response): number {
  const fromBody = resolveRetryAfterSeconds(body);
  if (fromBody !== undefined && fromBody > 0) return fromBody;
  const fromHeader = Number(response.headers.get("Retry-After"));
  return Number.isFinite(fromHeader) && fromHeader > 0 ? Math.ceil(fromHeader) : FALLBACK_LOCKOUT_SECONDS;
}

interface LoginFormProps {
  /** Where to go after unlocking. Already sanitised on the server; checked again before navigating. */
  next: string;
}

/**
 * The pass key form. One field, no username. Failure states are kept deliberately plain: a wrong key
 * never says why, a 404 reads as "not available" and nothing from the server's reply is shown verbatim
 * except the generic copy in lib/api/errorCodes.ts. The key itself is never stored or logged.
 */
export default function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const fieldId = useId();
  const messageId = `${fieldId}-message`;
  const inputRef = useRef<HTMLInputElement>(null);
  const redirectTimer = useRef<number | undefined>(undefined);

  const [passkey, setPasskey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  // 0 = still, 1/2 = shaking. Two animation names alternate so a second failure restarts the shake
  // without remounting the field (which would drop focus).
  const [shake, setShake] = useState<0 | 1 | 2>(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  // The form is inert until React has attached its submit handler. Before that, the browser would submit the
  // form itself, and a native GET puts the field in the address bar, so the pass key would end up in browser
  // history, server logs and referrers. A disabled default button also blocks submitting with Enter.
  const [ready, setReady] = useState(false);

  const secondsLeft = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
  const locked = secondsLeft > 0;

  // While locked out, tick every 250ms so the countdown never lags a visible second. The interval stops
  // itself the moment the lockout ends.
  useEffect(() => {
    if (retryAt === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryAt) {
        window.clearInterval(timer);
        // The lockout notice is only true while the lockout lasts.
        setMessage((existing) => (existing?.tone === "warn" ? null : existing));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  // Flips once after mount; there is nothing to derive during render, because the server cannot know hydration happened.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setReady(true), []);

  // The lockout disables the field; when it lifts, hand the keyboard back so typing can resume at once.
  useEffect(() => {
    if (retryAt !== null && !locked) inputRef.current?.focus();
  }, [retryAt, locked]);

  function fail(text: string, tone: Tone = "error") {
    setMessage({ text, tone });
    setPhase("idle");
    setShake((current) => (tone === "error" ? (current === 1 ? 2 : 1) : 0));
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== "idle" || locked) return;
    if (passkey.length === 0) {
      fail("Enter the pass key.");
      return;
    }

    setPhase("submitting");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passkey, next }),
        credentials: "same-origin",
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok && body !== null && typeof body === "object" && (body as { ok?: unknown }).ok === true) {
        const destination = safeAdminPath((body as { next?: unknown }).next, safeAdminPath(next));
        setPhase("success");
        // A beat for the check to draw, then go; nobody should wait on decoration under reduced motion.
        redirectTimer.current = window.setTimeout(() => router.replace(destination), reduceMotion ? 120 : 760);
        return;
      }

      const code = isApiErrorBody(body) ? body.code : undefined;

      if (response.status === 429 || code === "RATE_LIMITED") {
        const seconds = lockoutSeconds(body, response);
        const startedAt = Date.now();
        setNow(startedAt);
        setRetryAt(startedAt + seconds * 1000);
        fail("Too many attempts.", "warn");
        return;
      }
      if (response.status === 401 || code === "UNAUTHENTICATED") {
        fail(WRONG_KEY);
        return;
      }
      if (response.status === 404 || code === "NOT_FOUND") {
        fail(UNAVAILABLE, "neutral");
        return;
      }
      if (code === "VALIDATION_FAILED") {
        fail("Enter the pass key.");
        return;
      }
      // Anything else: the shared copy for a client error, a plain line for a server fault.
      fail(response.status >= 500 ? TROUBLE : describeApiError(body, TROUBLE), "neutral");
    } catch {
      fail(UNREACHABLE, "neutral");
    }
  }

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  const busy = phase === "submitting";
  const done = phase === "success";
  const invalid = message?.tone === "error";

  // method="post" is a second line of defence: even if a submit slipped through before hydration, the pass key
  // would travel in the request body, never in the URL.
  return (
    <form className={s.loginForm} method="post" onSubmit={submit} noValidate aria-describedby={messageId}>
      <div className={s.loginField} data-shake={shake === 0 ? undefined : shake === 1 ? "a" : "b"}>
        <label htmlFor={fieldId} className={s.fieldLabel}>
          Pass key
        </label>
        <div className={s.loginInputWrap}>
          <input
            ref={inputRef}
            id={fieldId}
            name="passkey"
            type={revealed ? "text" : "password"}
            className={s.input}
            value={passkey}
            onChange={(event) => setPasskey(event.target.value)}
            onKeyDown={updateCapsLock}
            onKeyUp={updateCapsLock}
            onBlur={() => setCapsLock(false)}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            aria-required="true"
            aria-invalid={invalid || undefined}
            aria-describedby={messageId}
            // readOnly, not disabled, while a request is in flight: a disabled field cannot keep (or be
            // given back) keyboard focus, and the failure path needs to refocus it. A lockout does disable it.
            readOnly={busy || done}
            disabled={locked}
          />
          <IconButton
            className={s.loginToggle}
            label={revealed ? "Hide pass key" : "Show pass key"}
            pressed={revealed}
            bare
            disabled={busy || done || locked}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </IconButton>
        </div>
      </div>

      <div id={messageId} className={s.loginMessage} data-tone={message ? (message.tone === "neutral" ? undefined : message.tone) : capsLock ? "warn" : undefined} role="alert">
        {message ? (
          <>
            <AlertIcon width={16} height={16} />
            <span>
              {message.text}
              {locked ? (
                <>
                  {" "}
                  {/* The visible countdown ticks every second; announcing each tick would drown the page. */}
                  <span className={s.srOnly}>Try again in {secondsLeft} seconds.</span>
                  <span aria-hidden="true">
                    Try again in <span className={s.countdown}>{formatCountdown(secondsLeft)}</span>
                  </span>
                </>
              ) : null}
            </span>
          </>
        ) : null}
        {!message && capsLock ? (
          <>
            <AlertIcon width={16} height={16} />
            <span>Caps Lock is on.</span>
          </>
        ) : null}
      </div>

      <div>
        <Button
          type="submit"
          block
          loading={busy}
          disabled={!ready || done || locked}
          iconTrailing={done ? undefined : locked ? undefined : <ArrowRightIcon />}
          iconLeading={done ? <CheckIcon className={s.checkDraw} width={18} height={18} /> : undefined}
        >
          {done ? "Unlocked" : busy ? "Unlocking…" : locked ? `Try again in ${formatCountdown(secondsLeft)}` : "Unlock console"}
        </Button>
      </div>
    </form>
  );
}
