"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  EMPTY_CONTACT_FORM,
  CONTACT_LIMITS,
  FIELD_MESSAGES,
  FIELD_ORDER,
  validateContact,
  errorSummary,
  type ContactFormValues,
  type ContactFieldErrors,
} from "@/lib/validateContact";

import { isPathKey } from "@/lib/data/paths";
import { ContactFormSkeleton } from "@/components/ui/FormSkeleton";

/** Field-level error text, linked to its input with aria-describedby. */
function FieldError({ id, show, field }: { id: string; show?: boolean; field: keyof ContactFieldErrors }) {
  if (!show) return null;
  return (
    <span id={id} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13, lineHeight: 1.45, color: "var(--error)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" style={{ flex: "none", marginTop: 2 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      {FIELD_MESSAGES[field]}
    </span>
  );
}

type Status = "idle" | "loading" | "success" | "error";

interface TurnstileApi {
  render: (container: HTMLElement, options: {
    sitekey: string;
    theme: "dark";
    action: "contact";
    callback: (token: string) => void;
    "expired-callback": () => void;
    "error-callback": () => void;
  }) => string;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function ContactForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({});
  const turnstileWidgetId = useRef<string | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileLoaded, setTurnstileLoaded] = useState(false);

  // Load Turnstile script
  useEffect(() => {
    if (typeof window === "undefined") return;
    const markLoaded = () => setTurnstileLoaded(true);
    const existingScript = document.querySelector<HTMLScriptElement>('script[src*="turnstile"]');

    if (window.turnstile) {
      queueMicrotask(markLoaded);
    } else if (existingScript) {
      existingScript.addEventListener("load", markLoaded);
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", markLoaded);
      document.head.appendChild(script);
    }

    return () => {
      existingScript?.removeEventListener("load", markLoaded);
    };
  }, []);

  // Render Turnstile widget
  useEffect(() => {
    if (!turnstileLoaded || !turnstileRef.current || !window.turnstile) return;
    if (turnstileRef.current.hasChildNodes()) return;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) return; // Turnstile not configured

    turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: siteKey,
      theme: "dark",
      action: "contact",
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken(""),
    });
  }, [turnstileLoaded]);

  useEffect(() => {
    const situation = searchParams.get("situation");
    if (isPathKey(situation)) {
      // Syncing initial form state to the ?situation= URL param, not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, situation }));
    }
  }, [searchParams]);

  // Show skeleton while Turnstile is loading
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileLoaded) {
    return <ContactFormSkeleton />;
  }

  function onField<K extends keyof ContactFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value as ContactFormValues[K] }));
      setErrors((er) => ({ ...er, [key]: false }));
      setServerMessage("");
      if (status === "error") setStatus("idle");
    };
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setSubmitted(true);
    const nextErrors = validateContact(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Move the caret to the first problem, so a failed submit on a long form is not
      // silent for someone whose invalid field is off-screen.
      const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
      if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    // Check Turnstile if configured
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (siteKey && !turnstileToken) {
      setStatus("error");
      setServerMessage("Please complete the verification.");
      return;
    }

    // Get honeypot value
    const honeypotInput = document.querySelector('input[name="_gotcha"]') as HTMLInputElement;
    const honeypotValue = honeypotInput?.value || "";

    setErrors({});
    setStatus("loading");
    setServerMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, "cf-turnstile-response": turnstileToken, _gotcha: honeypotValue }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrors(data.errors || {});
        setServerMessage(data.message || "Something went wrong. Please try again.");
        // Reset Turnstile on error so user can retry
        if (siteKey && window.turnstile) {
          window.turnstile.reset(turnstileWidgetId.current);
          setTurnstileToken("");
        }
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setServerMessage("We could not send that just now. Email us directly at acevatech.official@gmail.com.");
    }
  }

  function handleReset() {
    setForm(EMPTY_CONTACT_FORM);
    setErrors({});
    setStatus("idle");
    setServerMessage("");
    setTurnstileToken("");
    setSubmitted(false);
    if (window.turnstile && turnstileWidgetId.current !== undefined) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
  }

  const fieldBorder = (key: keyof ContactFieldErrors) => (submitted && errors[key] ? "var(--error)" : "var(--hairline)");
  const summary = serverMessage || errorSummary(errors);
  const inputStyle: React.CSSProperties = {
    background: "#0F0F13",
    borderRadius: 10,
    padding: "13px 14px",
    color: "var(--ink)",
    fontSize: 15,
    minHeight: 48,
    width: "100%",
  };

  if (status === "success") {
    return (
      <div style={{ padding: "clamp(28px,4vw,44px)", animation: "acFadeUp 420ms cubic-bezier(.16,1,.3,1) both" }}>
        <span style={{ width: 46, height: 46, borderRadius: "50%", border: "1px solid rgba(47,190,122,.4)", background: "rgba(47,190,122,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#2FBE7A" strokeWidth="2.4" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 24, fontWeight: 600, letterSpacing: "-.02em", margin: "20px 0 0" }}>Received. A senior will read this.</p>
        <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--muted)", margin: "12px 0 0" }}>
          We reply from acevatech.official@gmail.com with either a proposed next step or an honest reason we are not the right team. No drip sequence, no sales calls you did not ask for.
        </p>
        <div style={{ marginTop: 24, padding: 18, border: "1px solid var(--hairline)", borderRadius: 12 }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 12px" }}>WHAT HAPPENS NEXT</p>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 8px" }}>1 — A senior reads your description and checks feasibility.</p>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 8px" }}>2 — We propose either a Proof Sprint, a Rescue Sprint or a full engagement.</p>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>3 — Nothing is quoted before a senior has reviewed it.</p>
        </div>
        <button type="button" onClick={handleReset} style={{ marginTop: 22, background: "none", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 14.5, fontWeight: 500, padding: "13px 20px", borderRadius: 10, minHeight: 46 }}>
          Send another
        </button>
      </div>
    );
  }

  const hasErrors = submitted && (Object.keys(errors).length > 0 || Boolean(serverMessage));

  return (
    <form onSubmit={handleSubmit} noValidate style={{ padding: "clamp(24px,3.5vw,36px)" }}>
      {/* Honeypot - hidden field that bots fill but humans don't see */}
      <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" style={{ display: "none" }} aria-hidden="true" />
      <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 22px" }}>QUALIFICATION — 6 FIELDS</p>

      {hasErrors && (
        <p role="alert" style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: 14.5, lineHeight: 1.55, color: "var(--ink)", margin: "0 0 22px", padding: "14px 16px", border: "1px solid rgba(224,80,59,.4)", borderRadius: 10, background: "rgba(224,80,59,.08)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E0503B" strokeWidth="2" style={{ marginTop: 2, flex: "none" }} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {summary}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Your name</span>
          <input ref={(el) => { fieldRefs.current.name = el; }} value={form.name} onChange={onField("name")} type="text" autoComplete="name" required maxLength={CONTACT_LIMITS.name} aria-invalid={Boolean(submitted && errors.name)} aria-describedby={submitted && errors.name ? "contact-name-error" : undefined} placeholder="Jordan Ellis" style={{ ...inputStyle, border: `1px solid ${fieldBorder("name")}` }} />
          <FieldError id="contact-name-error" show={submitted && errors.name} field="name" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Work email</span>
          <input ref={(el) => { fieldRefs.current.email = el; }} value={form.email} onChange={onField("email")} type="email" autoComplete="email" required maxLength={CONTACT_LIMITS.email} aria-invalid={Boolean(submitted && errors.email)} aria-describedby={submitted && errors.email ? "contact-email-error" : undefined} placeholder="you@company.com" style={{ ...inputStyle, border: `1px solid ${fieldBorder("email")}` }} />
          <FieldError id="contact-email-error" show={submitted && errors.email} field="email" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Company</span>
          <input ref={(el) => { fieldRefs.current.company = el; }} value={form.company} onChange={onField("company")} type="text" autoComplete="organization" required maxLength={CONTACT_LIMITS.company} aria-invalid={Boolean(submitted && errors.company)} aria-describedby={submitted && errors.company ? "contact-company-error" : undefined} placeholder="Company name" style={{ ...inputStyle, border: `1px solid ${fieldBorder("company")}` }} />
          <FieldError id="contact-company-error" show={submitted && errors.company} field="company" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Where you are right now</span>
          <select value={form.situation} onChange={onField("situation")} style={{ ...inputStyle, border: "1px solid var(--hairline)" }}>
            <option value="new">Starting something new</option>
            <option value="improve">Improving my business</option>
            <option value="help">Already built something, needs help</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Capability of interest</span>
          <select value={form.service} onChange={onField("service")} style={{ ...inputStyle, border: "1px solid var(--hairline)" }}>
            <option value="unsure">Not sure yet — help me choose</option>
            <option value="digital">Digital Experiences</option>
            <option value="software">Custom Software</option>
            <option value="mobile">Mobile Products</option>
            <option value="intelligence">Intelligence &amp; Automation</option>
            <option value="rescue">Product Rescue &amp; Reliability</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Budget range</span>
          <select
            ref={(el) => { fieldRefs.current.budget = el; }}
            value={form.budget}
            onChange={onField("budget")}
            aria-invalid={Boolean(submitted && errors.budget)}
            aria-describedby={submitted && errors.budget ? "contact-budget-error" : undefined}
            style={{ ...inputStyle, border: `1px solid ${fieldBorder("budget")}` }}
          >
            <option value="">Select a budget range</option>
            <option value="sprint">A sprint first, then decide</option>
            <option value="small">Small — a defined scope</option>
            <option value="mid">Mid — a full product build</option>
            <option value="ongoing">Ongoing — a dedicated team</option>
          </select>
          <FieldError id="contact-budget-error" show={submitted && errors.budget} field="budget" />
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>What is the problem, in your own words</span>
        <textarea
          ref={(el) => { fieldRefs.current.details = el; }}
          value={form.details}
          onChange={onField("details")}
          rows={5}
          required
          minLength={CONTACT_LIMITS.detailsMin}
          maxLength={CONTACT_LIMITS.detailsMax}
          aria-invalid={Boolean(submitted && errors.details)}
          aria-describedby={submitted && errors.details ? "contact-details-error" : undefined}
          placeholder="What is broken, slow or missing — and what would change for the business if it were fixed?"
          style={{ ...inputStyle, border: `1px solid ${fieldBorder("details")}`, lineHeight: 1.55, resize: "vertical" }}
        />
        <FieldError id="contact-details-error" show={submitted && errors.details} field="details" />
      </label>

      {/* Cloudflare Turnstile - invisible CAPTCHA */}
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && turnstileLoaded && (
        <div ref={turnstileRef} style={{ marginTop: 16 }} />
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 22 }}>
        <button
          type="submit"
          disabled={status === "loading"}
          className="ac-btn-primary"
          style={{ padding: "16px 26px", minHeight: 52, gap: 12, opacity: status === "loading" ? 0.7 : 1 }}
        >
          {status === "loading" ? "Sending" : "Send to a senior"}
          {status === "loading" && (
            <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", display: "block", animation: "acSpin 700ms linear infinite" }} />
          )}
        </button>
        <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0, maxWidth: "30ch" }}>No newsletter. No CRM sequence. One human reply.</p>
      </div>
    </form>
  );
}
