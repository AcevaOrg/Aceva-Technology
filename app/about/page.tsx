import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Callout from "@/components/ui/Callout";
import Button from "@/components/ui/Button";

export const metadata: Metadata = pageMetadata({
  title: "Why ACEVA — How We Position, Sell and Deliver",
  description:
    "We will not compete by saying more — we compete by proving more. How Aceva is positioned, how we sell, and how we deliver software that survives handover.",
  path: ROUTES.about,
  absoluteTitle: true,
});

interface Fact {
  kicker: string;
  title: string;
  body: string;
}

const FACTS: Fact[] = [
  {
    kicker: "MARKET",
    title: "Sell from New York, compete globally.",
    body: "Proximity to buyers and to the problems they actually describe out loud.",
  },
  {
    kicker: "ENGINEERING",
    title: "Delivery capacity with mentorship built in.",
    body: "Senior engineers review every line of work from juniors who are growing under named mentors.",
  },
  {
    kicker: "CONSTRAINT",
    title: "We started from zero, on purpose.",
    body: "No operating budget and a one-month launch window. A smaller finished version beats a huge unfinished promise.",
  },
  {
    kicker: "GOAL",
    title: "A buying experience ahead of the market.",
    body: "A full-service software house whose website feels like a product, not a brochure.",
  },
];

const COMPETE_ON = [
  "Clarity — a buyer can tell what we do in one screen",
  "Proof — a narrow paid sprint before a large commitment",
  "Product Rescue — the offer most agencies avoid",
  "Ownership — your code, your accounts, your data",
  "Transparency — weekly working proof, risks included",
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-40%",
            right: "-8%",
            width: "60vw",
            height: "60vw",
            maxWidth: 780,
            maxHeight: 780,
            background: "radial-gradient(circle at 50% 50%, rgba(59,124,255,.14), transparent 66%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
            WHY ACEVA
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
            }}
          >
            We will not compete by saying more. We will compete by proving more.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "58ch" }}>
            Aceva is a normal software house. The difference is how it presents, sells and delivers. New York market
            access gives us proximity to real business problems; our engineering operation gives us delivery capacity
            and a talent-development engine.
          </p>
        </div>
      </section>

      {/* Four facts */}
      <section>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 0,
          }}
        >
          {FACTS.map((f, i) => (
            <Reveal
              key={f.kicker}
              style={{
                padding: i === 0 ? "0 26px 26px 0" : i === FACTS.length - 1 ? "0 0 26px 26px" : "0 26px 26px",
                borderRight: i < FACTS.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".16em", color: "var(--electric)", margin: "0 0 14px" }}>
                {f.kicker}
              </p>
              <h2 className="ac-heading-sm" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, lineHeight: 1.32, margin: 0 }}>{f.title}</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "10px 0 0" }}>{f.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What we are not claiming */}
      <section>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: "clamp(28px,5vw,64px)",
          }}
        >
          <div>
            <Reveal
              as="h2"
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 600,
                fontSize: "clamp(26px,3.4vw,38px)",
                lineHeight: 1.1,
                letterSpacing: "-.025em",
                margin: 0,
                maxWidth: "22ch",
              }}
            >
              What we are not claiming.
            </Reveal>
            <Reveal as="p" style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "20px 0 0", maxWidth: "48ch" }}>
              We are not claiming that our five services are unique. Global consultancies already sell custom
              software, AI, product engineering, cloud and modernization. AI-assisted coding is becoming normal — the
              advantage is the review process, the architecture, the security and the customer experience around it.
            </Reveal>
            <Reveal as="p" style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px 0 0", maxWidth: "48ch" }}>
              The opportunity is not to invent a category. It is to package familiar capabilities in a clearer,
              faster and more trustworthy way.
            </Reveal>
          </div>
          <Reveal style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".16em", color: "var(--muted)", margin: "0 0 14px" }}>
              SO WE COMPETE ON
            </p>
            {COMPETE_ON.map((line, i) => (
              <p
                key={line}
                style={{
                  fontSize: 16,
                  padding: "16px 0",
                  borderTop: "1px solid var(--hairline)",
                  borderBottom: i === COMPETE_ON.length - 1 ? "1px solid var(--hairline)" : "none",
                  margin: 0,
                }}
              >
                {line}
              </p>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Closing */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)" }}>
          <Reveal>
            <Callout
              variant="quote"
              style={{ fontSize: "clamp(22px,3vw,34px)", lineHeight: 1.28, letterSpacing: "-.02em", maxWidth: "30ch", padding: "0 0 0 24px" }}
            >
              Build new products. Improve existing businesses. Rescue software that other teams could not finish.
            </Callout>
          </Reveal>
          <Reveal style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34 }}>
            <Button variant="primary" icon={false} href={ROUTES.contact} style={{ minHeight: 50, padding: "15px 24px", borderRadius: 11 }}>
              Start a Project
            </Button>
            <Button variant="ghost" icon={false} href={ROUTES.company} style={{ minHeight: 50, padding: "15px 24px", borderRadius: 11 }}>
              About the company
            </Button>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
