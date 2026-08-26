import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";

export const metadata: Metadata = pageMetadata({
  title: "Insights — ACEVA Technology",
  description: "Writing starts after the first engagements, not before. Here is what is planned.",
  noIndex: true,
});

const PLANNED = [
  { label: "PLANNED · 01", title: "How to review AI-generated code before it reaches production" },
  { label: "PLANNED · 02", title: "What a rescue audit finds first, in nine cases out of ten" },
  { label: "PLANNED · 03", title: "Why a Proof Sprint costs less than a bad estimate" },
  { label: "PLANNED · 04", title: "Handover checklist: what you should own on day one" },
];

export default function InsightsPage() {
  return (
    <div>
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
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
            INSIGHTS
          </p>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(32px,5.2vw,60px)",
              lineHeight: 1.05,
              letterSpacing: "-.03em",
              margin: 0,
              maxWidth: "22ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 60ms both",
            }}
          >
            Writing starts after the first engagements, not before.
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
            We would rather publish four pieces we learned the hard way than forty written for search engines. Here is
            what is planned — each slot is a real question we expect to answer with evidence.
          </p>
        </div>
      </section>

      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)" }}>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {PLANNED.map((item) => (
              <Reveal key={item.label}>
                <Card variant="ghost" style={{ padding: 26, minHeight: 190, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <Tag variant="dashed">{item.label}</Tag>
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-space-grotesk)",
                        fontSize: 19,
                        fontWeight: 500,
                        lineHeight: 1.3,
                      }}
                    >
                      {item.title}
                    </span>
                    <Tag variant="dashed" style={{ marginTop: 10 }}>
                      Draft — coming soon
                    </Tag>
                  </span>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
