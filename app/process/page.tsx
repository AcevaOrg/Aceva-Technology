import type { Metadata } from "next";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "How We Work — ACEVA Technology",
  description:
    "Five phases with weekly demos and clear ownership — understand, design, build, launch, improve.",
};

interface Phase {
  n: string;
  title: string;
  lead: string;
  receive: string[];
}

const PHASES: Phase[] = [
  {
    n: "01",
    title: "Understand",
    lead: "We write down the business problem, the constraints and what success means — before anyone estimates anything.",
    receive: [
      "A written problem statement and success criteria",
      "Scope boundaries — including what we are not doing yet",
      "A feasibility read from a senior engineer, not a salesperson",
    ],
  },
  {
    n: "02",
    title: "Design",
    lead: "Interface and architecture are designed together, so the thing that looks right is also the thing that can be built and maintained.",
    receive: [
      "Screens and flows for the real journeys, mobile included",
      "An architecture plan with the decisions written down",
      "Acceptance criteria we will be measured against",
    ],
  },
  {
    n: "03",
    title: "Build",
    lead: "AI-accelerated, senior-reviewed. No junior change reaches production without a named senior review.",
    receive: [
      "A working demo every week — not a status email",
      "The week's decisions, risks and open questions in writing",
      "Commit access to your own repository from day one",
    ],
  },
  {
    n: "04",
    title: "Launch",
    lead: "Mobile QA, browser QA, security basics, content review, analytics, deployment — under accounts you control.",
    receive: [
      "A launch checklist that had to pass before going live",
      "Ownership of domain, hosting, repository and analytics",
      "Named people responsible for bugs after launch",
    ],
  },
  {
    n: "05",
    title: "Improve",
    lead: "Monitoring, iteration and a modernization roadmap you can act on with us or without us.",
    receive: [
      "Monitoring and alerts that reach a human",
      "A prioritized improvement list after real usage",
      "Documentation good enough for another team to pick up",
    ],
  },
];

export default function ProcessPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
            HOW WE WORK
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
            Understand. Design. Build. Launch. Improve.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "56ch" }}>
            Five phases with weekly demos and clear ownership. You see working progress, decisions, risks and tests
            every week instead of waiting until the deadline.
          </p>
        </div>
      </section>

      {/* Phases */}
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          {PHASES.map((phase, i) => (
            <Reveal
              key={phase.n}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: "clamp(20px,4vw,64px)",
                padding: "clamp(32px,4vw,52px) 0",
                borderBottom: i < PHASES.length - 1 ? "1px solid var(--hairline)" : "none",
              }}
            >
              <div style={{ display: "flex", gap: 20 }}>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    letterSpacing: ".14em",
                    color: "var(--electric)",
                    paddingTop: 9,
                  }}
                >
                  PHASE {phase.n}
                </span>
                <div>
                  <h2
                    style={{
                      fontFamily: "var(--font-space-grotesk)",
                      fontSize: "clamp(23px,2.6vw,30px)",
                      fontWeight: 500,
                      letterSpacing: "-.02em",
                      margin: 0,
                    }}
                  >
                    {phase.title}
                  </h2>
                  <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0", maxWidth: "36ch" }}>
                    {phase.lead}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, paddingTop: 6 }}>
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 3px" }}>
                  YOU RECEIVE
                </p>
                {phase.receive.map((item, j) => (
                  <p
                    key={item}
                    style={{
                      fontSize: 15,
                      lineHeight: 1.5,
                      margin: 0,
                      paddingBottom: j < phase.receive.length - 1 ? 11 : 0,
                      borderBottom: j < phase.receive.length - 1 ? "1px solid var(--hairline)" : "none",
                    }}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Two rules that do not bend */}
      <section style={{ background: "rgba(15,15,19,.72)", borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)" }}>
          <Reveal
            as="h2"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(26px,3.4vw,38px)",
              lineHeight: 1.1,
              letterSpacing: "-.025em",
              margin: 0,
              maxWidth: "24ch",
            }}
          >
            Two rules that do not bend.
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 32 }}>
            <Reveal>
              <Card
                variant="plain"
                style={{ padding: 28, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
              >
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 500, margin: 0 }}>Senior review, always</p>
                <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0" }}>
                  AI is used for speed. A senior engineer remains responsible for architecture, security and quality.
                  AI-accelerated, senior-reviewed, production-ready.
                </p>
              </Card>
            </Reveal>
            <Reveal>
              <Card
                variant="plain"
                style={{ padding: 28, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
              >
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 500, margin: 0 }}>You own everything</p>
                <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0" }}>
                  Your code. Your accounts. Your data. No developer personally owns the domain, the repository or the
                  hosting for your business.
                </p>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
