import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { FAQS } from "@/lib/data/faqs";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import FaqAccordion from "@/components/features/FaqAccordion";
import Reveal from "@/components/ui/Reveal";

export const metadata: Metadata = pageMetadata({
  title: "FAQ — ACEVA Technology",
  description: "Questions buyers actually ask about working with Aceva.",
});

export default function FaqPage() {
  return (
    <div>
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(36px,5vw,56px)" }}>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11.5,
              letterSpacing: ".2em",
              color: "var(--ice)",
              margin: "0 0 20px",
              animation: "acFadeUp 700ms cubic-bezier(.16,1,.3,1) both",
            }}
          >
            FAQ
          </p>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(32px,5.2vw,60px)",
              lineHeight: 1.05,
              letterSpacing: "-.03em",
              margin: 0,
              maxWidth: "20ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 60ms both",
            }}
          >
            Questions buyers actually ask.
          </h1>
        </div>
      </section>
      <section>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "clamp(24px,4vw,48px) clamp(20px,4vw,48px) clamp(56px,8vw,104px)" }}>
          <FaqAccordion items={FAQS} />
          <Reveal style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 40 }}>
            <Link
              href={ROUTES.contact}
              className="ac-btn-primary"
              style={{ padding: "15px 24px", borderRadius: 11, minHeight: 50 }}
            >
              Ask us directly
              <ArrowRightIcon />
            </Link>
            <p style={{ fontSize: 14.5, color: "var(--muted)", margin: 0 }}>
              Anything not answered here gets a written answer, not a sales call.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
