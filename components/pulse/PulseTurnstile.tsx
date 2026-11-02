"use client";

import React, { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile for the Pulse forms.
 *
 * Mirrors the loader in components/features/ContactForm.tsx, which is left
 * unchanged, but takes its action as a prop so the server can bind each token
 * to the route it was issued for ("pulse_save", "pulse_email"). The widget API
 * is reached through a local type rather than redeclaring `window.turnstile`,
 * which ContactForm already declares with a narrower action type.
 *
 * Renders nothing when no site key is configured; the server decides whether a
 * token is required, so that only ever means "not required here".
 *
 * To reset after a Turnstile-family error, remount it with a new `key`.
 */

interface TurnstileWidgetApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove?: (widgetId: string) => void;
}

function turnstileApi(): TurnstileWidgetApi | undefined {
  return (window as unknown as { turnstile?: TurnstileWidgetApi }).turnstile;
}

export const PULSE_TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function PulseTurnstile({
  action,
  onToken,
}: {
  action: "pulse_save" | "pulse_email";
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!PULSE_TURNSTILE_SITE_KEY) return;
    const markLoaded = () => setLoaded(true);
    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');

    if (turnstileApi()) {
      queueMicrotask(markLoaded);
    } else if (existing) {
      existing.addEventListener("load", markLoaded);
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", markLoaded);
      document.head.appendChild(script);
    }
    return () => existing?.removeEventListener("load", markLoaded);
  }, []);

  useEffect(() => {
    const api = turnstileApi();
    if (!loaded || !api || !container.current || container.current.hasChildNodes()) return;
    const widgetId = api.render(container.current, {
      sitekey: PULSE_TURNSTILE_SITE_KEY,
      theme: "dark",
      action,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
      "error-callback": () => onToken(""),
    });
    return () => api.remove?.(widgetId);
    // onToken is a state setter from the parent; re-rendering the widget for it would reset the challenge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, action]);

  if (!PULSE_TURNSTILE_SITE_KEY) return null;
  return <div ref={container} style={{ margin: "0.8rem 0" }} />;
}
