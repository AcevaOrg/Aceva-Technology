import { Suspense } from "react";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import KeyValueRow from "@/components/ui/KeyValueRow";
import ContactForm from "@/components/features/ContactForm";

export const metadata: Metadata = pageMetadata({
  title: "Contact ACEVA — Start a Project",
  description:
    "Tell us what is costing you the most time, money or customer trust. A senior reads every message and replies with a next step or an honest no.",
  path: ROUTES.contact,
  absoluteTitle: true,
});

export default function ContactPage() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", top: "-30%", left: "-10%", width: "60vw", height: "60vw", maxWidth: 760, maxHeight: 760, background: "radial-gradient(circle at 50% 50%, rgba(59,124,255,.13), transparent 66%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(56px,8vw,104px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "clamp(30px,5vw,72px)", alignItems: "start" }}>
        <Reveal>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>START A PROJECT</p>
          <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(32px,4.6vw,54px)", lineHeight: 1.05, letterSpacing: "-.03em", margin: 0, maxWidth: "18ch" }}>
            What is costing you the most time, money or customer trust?
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "22px 0 0", maxWidth: "46ch" }}>
            Answer that in a few lines. A senior reads it — not a form-filling assistant — and replies with either a next step or an honest no.
          </p>
          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", borderTop: "1px solid var(--hairline)" }}>
            <KeyValueRow first label="Email" value={<a href="mailto:acevatech.official@gmail.com">acevatech.official@gmail.com</a>} />
            <KeyValueRow label="Reply" value={<span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, color: "var(--muted)" }}>A HUMAN RESPONSE, NOT AN AUTOMATED SEQUENCE</span>} />
          </div>
        </Reveal>

        <div className="ac-card-flagship" style={{ borderRadius: 16, overflow: "hidden" }}>
          <Suspense fallback={<div style={{ padding: "clamp(24px,3.5vw,36px)", minHeight: 420 }} />}>
            <ContactForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
