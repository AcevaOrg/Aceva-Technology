import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";

export const metadata: Metadata = pageMetadata({
  title: "Careers — ACEVA Technology",
  description: "Five senior professionals and five juniors. Every junior has a named mentor and named senior review.",
});

const LANE_CARDS = [
  {
    title: "One clear lane each",
    body: "Ten people are enough only if every person has one clear responsibility. You will know exactly what you own.",
  },
  {
    title: "Review as teaching",
    body: "Code review is where juniors learn fastest, so it is scheduled work for seniors — not something squeezed in at midnight.",
  },
  {
    title: "Honest about capacity",
    body: "Part-time seniors are not full-time seniors. Weekly availability is written down, for everyone.",
  },
];

const ROLE_SLOTS = [
  { label: "ROLE SLOT 01", body: "Add a role here with its lane, its reviewer and its weekly availability." },
  { label: "ROLE SLOT 02", body: "Junior openings state the mentor by name before they are published." },
  { label: "ROLE SLOT 03", body: "No unpaid trials, no take-homes longer than an evening." },
];

export default function CareersPage() {
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
            CAREERS
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
            Learn under people who review your work.
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
            Five senior professionals and five juniors. Every junior has a named mentor, and no junior change reaches
            production without a named senior review. That is the whole culture.
          </p>
        </div>
      </section>

      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div
          className="ac-card-grid"
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 14,
          }}
        >
          {LANE_CARDS.map((card) => (
            <Reveal key={card.title}>
              <Card
                variant="flagship"
                style={{
                  borderRadius: 14,
                  padding: 26,
                  height: "100%",
                }}
              >
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, margin: 0 }}>{card.title}</p>
                <p style={{ fontSize: 14.5, lineHeight: 1.62, color: "var(--muted)", margin: "10px 0 0" }}>{card.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)" }}>
          <Reveal as="p" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 22px" }}>
            OPEN ROLES
          </Reveal>
          <Reveal>
            <Card
              variant="flagship"
              style={{
                borderRadius: 16,
                padding: "clamp(28px,4vw,44px)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-space-grotesk)",
                    fontSize: "clamp(20px,2.4vw,26px)",
                    fontWeight: 500,
                    lineHeight: 1.28,
                    letterSpacing: "-.015em",
                    margin: 0,
                  }}
                >
                  No open roles right now.
                </p>
                <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0", maxWidth: "44ch" }}>
                  Send your work anyway — we read everything and keep it on file for when a lane opens. Tell us what you
                  want to be reviewed on.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <a
                  href="mailto:acevatech.official@gmail.com"
                  className="ac-btn-primary"
                  style={{ padding: "15px 24px", borderRadius: 11, minHeight: 50 }}
                >
                  Send your work
                </a>
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".1em", color: "#4b4f5b", margin: 0 }}>
                  APPLICATIONS ARE CURRENTLY RECEIVED THROUGH OUR GENERAL INBOX
                </p>
              </div>
            </Card>
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginTop: 14 }}>
            {ROLE_SLOTS.map((slot) => (
              <Reveal key={slot.label}>
                <Card variant="flagship" style={{ borderRadius: 14, padding: 22, height: "100%" }}>
                  <Tag variant="dashed" style={{ marginBottom: 10 }}>
                    {slot.label}
                  </Tag>
                  <p style={{ fontSize: 14.5, color: "var(--muted)", margin: 0 }}>{slot.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
