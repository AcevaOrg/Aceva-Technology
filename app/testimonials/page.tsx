import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";

export const metadata: Metadata = {
  title: "Client Feedback — ACEVA Technology",
  description: "Aceva has no testimonials yet, and will not write its own. Here is what we will publish, and when.",
};

export default function TestimonialsPage() {
  return (
    <div>
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
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
            CLIENT FEEDBACK
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
            We have no testimonials yet, and we will not write our own.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: "var(--muted)",
              margin: "24px 0 0",
              maxWidth: "58ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 140ms both",
            }}
          >
            Aceva is new. Inventing quotes would be the fastest way to lose the trust we are asking you for. This page
            fills in as real engagements close — attributed, with the client&apos;s permission.
          </p>
        </div>
      </section>

      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)" }}>
          <Reveal as="p" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 22px" }}>
            WHAT WE WILL PUBLISH — AND WHEN
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
            <Reveal>
              <Card variant="ghost" style={{ padding: 26, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <Tag variant="dashed">QUOTE SLOT 01</Tag>
                <span>
                  <span style={{ display: "block", fontSize: 15, lineHeight: 1.6, color: "var(--muted)" }}>
                    A named person, their role, their company, and one sentence about what changed for their business.
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", border: "1px dashed var(--hairline)" }} />
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".12em", color: "#4b4f5b" }}>
                      NAME · ROLE · COMPANY
                    </span>
                  </span>
                </span>
              </Card>
            </Reveal>
            <Reveal>
              <Card variant="ghost" style={{ padding: 26, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <Tag variant="dashed">QUOTE SLOT 02</Tag>
                <span>
                  <span style={{ display: "block", fontSize: 15, lineHeight: 1.6, color: "var(--muted)" }}>
                    Approved in writing before publication. No paraphrasing, no composites, no anonymous quotes.
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
                    <span style={{ width: 32, height: 32, borderRadius: "50%", border: "1px dashed var(--hairline)" }} />
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".12em", color: "#4b4f5b" }}>
                      NAME · ROLE · COMPANY
                    </span>
                  </span>
                </span>
              </Card>
            </Reveal>
            <Reveal>
              <Card variant="ghost" style={{ padding: 26, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <Tag variant="dashed">METRIC SLOT</Tag>
                <span>
                  <span style={{ display: "block", fontSize: 15, lineHeight: 1.6, color: "var(--muted)" }}>
                    Numbers appear only when the client&apos;s own reporting supports them. If we cannot show the source, we
                    omit the metric.
                  </span>
                  <span style={{ display: "block", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".12em", color: "#4b4f5b", marginTop: 18 }}>
                    SOURCE REQUIRED
                  </span>
                </span>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      <section>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: "clamp(24px,4vw,56px)",
          }}
        >
          <div>
            <Reveal as="h2" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(24px,3vw,34px)", lineHeight: 1.12, letterSpacing: "-.02em", margin: 0, maxWidth: "22ch" }}>
              In the meantime, judge us on the work.
            </Reveal>
            <Reveal as="p" style={{ fontSize: 16, lineHeight: 1.65, color: "var(--muted)", margin: "18px 0 0", maxWidth: "46ch" }}>
              Every claim we make on this site is demonstrable today: the site itself, an operations dashboard, a mobile
              journey, an automation with a human in the loop, and a sample Rescue Report.
            </Reveal>
            <Reveal style={{ marginTop: 26 }}>
              <Link href={ROUTES.work} className="ac-btn-primary" style={{ padding: "15px 24px", borderRadius: 11, minHeight: 50 }}>
                Open Experiments
                <ArrowRightIcon />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
