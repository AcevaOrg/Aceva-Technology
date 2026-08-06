"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  EMPTY_CONTACT_FORM,
  validateContact,
  errorSummary,
  type ContactFormValues,
  type ContactFieldErrors,
} from "@/lib/validateContact";
import { isPathKey } from "@/lib/data/paths";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");

  useEffect(() => {
    const situation = searchParams.get("situation");
    if (isPathKey(situation)) {
      // Syncing initial form state to the ?situation= URL param, not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, situation }));
    }
  }, [searchParams]);

  function onField<K extends keyof ContactFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setErrors((er) => ({ ...er, [key]: false }));
    };
  }

  async function handleSubmit() {
    const nextErrors = validateContact(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setStatus("loading");
    setServerMessage("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus("error");
        setErrors(data.errors || {});
        setServerMessage(data.message || "Something went wrong. Please try again.");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setServerMessage("We could not send that just now. Email us directly at acevatechnology@gmail.com.");
    }
  }

  function handleReset() {
    setForm(EMPTY_CONTACT_FORM);
    setErrors({});
    setStatus("idle");
    setServerMessage("");
  }

  const fieldBorder = (key: keyof ContactFieldErrors) => (errors[key] ? "var(--error)" : "var(--hairline)");
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
          We reply from acevatechnology@gmail.com with either a proposed next step or an honest reason we are not the right team. No drip sequence, no sales calls you did not ask for.
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

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div style={{ padding: "clamp(24px,3.5vw,36px)" }}>
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
          <input value={form.name} onChange={onField("name")} type="text" autoComplete="name" placeholder="Jordan Ellis" style={{ ...inputStyle, border: `1px solid ${fieldBorder("name")}` }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Work email</span>
          <input value={form.email} onChange={onField("email")} type="email" autoComplete="email" placeholder="you@company.com" style={{ ...inputStyle, border: `1px solid ${fieldBorder("email")}` }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            Company <span style={{ color: "#4b4f5b" }}>(optional)</span>
          </span>
          <input value={form.company} onChange={onField("company")} type="text" autoComplete="organization" placeholder="Company name" style={{ ...inputStyle, border: "1px solid var(--hairline)" }} />
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
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            Budget range <span style={{ color: "#4b4f5b" }}>(optional)</span>
          </span>
          <select value={form.budget} onChange={onField("budget")} style={{ ...inputStyle, border: "1px solid var(--hairline)" }}>
            <option value="">Prefer not to say</option>
            <option value="sprint">A sprint first, then decide</option>
            <option value="small">Small — a defined scope</option>
            <option value="mid">Mid — a full product build</option>
            <option value="ongoing">Ongoing — a dedicated team</option>
          </select>
        </label>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>What is the problem, in your own words</span>
        <textarea
          value={form.details}
          onChange={onField("details")}
          rows={5}
          placeholder="What is broken, slow or missing — and what would change for the business if it were fixed?"
          style={{ ...inputStyle, border: `1px solid ${fieldBorder("details")}`, lineHeight: 1.55, resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 22 }}>
        <button
          type="button"
          onClick={handleSubmit}
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
    </div>
  );
}
