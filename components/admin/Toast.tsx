"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import s from "./admin.module.css";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";
import { IconButton } from "./IconButton";

type ToastTone = "success" | "error" | "info";

export interface ToastOptions {
  /** A second, quieter line under the message. */
  description?: string;
  /** Milliseconds before it dismisses itself. 0 keeps it until closed. Defaults: 4.5s, 5s, and 9s for errors. */
  durationMs?: number;
}

export interface ToastApi {
  /** Each returns the toast's id, which `dismiss` accepts. */
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

interface ToastRecord {
  id: string;
  tone: ToastTone;
  message: string;
  description?: string;
  durationMs: number;
  leaving: boolean;
}

const DEFAULT_DURATION: Record<ToastTone, number> = { success: 4500, info: 5000, error: 9000 };
const MAX_VISIBLE = 4;
const LEAVE_MS = 220;

const ToastContext = createContext<ToastApi | null>(null);

/** Toast access for any client component under AdminShell. Throws outside a ToastProvider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast() must be used inside <ToastProvider>. AdminShell mounts one for the whole console.");
  return api;
}

const ICONS = { success: CheckIcon, error: AlertIcon, info: InfoIcon } as const;

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.durationMs);
  const Icon = ICONS[toast.tone];

  // The countdown pauses while the toast is hovered or focused, so there is time to read it.
  useEffect(() => {
    if (paused || toast.leaving || toast.durationMs <= 0) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt));
    };
  }, [paused, toast.leaving, toast.durationMs, toast.id, onDismiss]);

  return (
    <div
      className={s.toast}
      data-tone={toast.tone}
      data-leaving={toast.leaving ? "" : undefined}
      role={toast.tone === "error" ? "alert" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={s.toastIcon} aria-hidden="true">
        <Icon width={18} height={18} />
      </span>
      <div className={s.toastText}>
        <p className={s.toastTitle}>{toast.message}</p>
        {toast.description ? <p className={s.toastBody}>{toast.description}</p> : null}
      </div>
      <IconButton label="Dismiss notification" bare onClick={() => onDismiss(toast.id)}>
        <CloseIcon width={16} height={16} />
      </IconButton>
    </div>
  );
}

/**
 * Mounts the toast stack. The container is an always-present polite live region (so assistive tech has
 * it registered before the first message); error toasts additionally carry role="alert".
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: string) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((list) => list.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
      window.setTimeout(() => remove(id), LEAVE_MS);
    },
    [remove],
  );

  const push = useCallback((tone: ToastTone, message: string, options?: ToastOptions) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    const record: ToastRecord = {
      id,
      tone,
      message,
      description: options?.description,
      durationMs: options?.durationMs ?? DEFAULT_DURATION[tone],
      leaving: false,
    };
    setToasts((list) => [...list, record].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={s.toasts} role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
