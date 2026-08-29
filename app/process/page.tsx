import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";

export const metadata: Metadata = pageMetadata({
  title: "Our Development Process",
  description:
    "Five phases with weekly demos and clear ownership: understand, design, build, launch, improve. Written milestones and acceptance criteria on every engagement.",
  path: ROUTES.process,
});

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
    lead: "We document the business problem, constraints, and success criteria before anyone estimates anything. Technical feasibility is evaluated by a senior engineer, not a salesperson.",
    receive: [
      "A written problem statement and success criteria",
      "Scope boundaries detailing what is included and what is deferred",
      "A feasibility evaluation from a senior engineer",
    ],
  },
  {
    n: "02",
    title: "Design",
    lead: "Interface and system architecture are designed together, so the user experience is matched by clean, maintainable engineering.",
    receive: [
      "Screens and interaction flows for primary user journeys, including mobile",
      "An architecture plan with key decisions written down",
      "Acceptance criteria we will be measured against",
    ],
  },
  {
    n: "03",
    title: "Build",
    lead: "AI-accelerated development with mandatory senior code review. No junior change reaches production without a named senior review.",
    receive: [
      "A working demo every week — not just a status email",
      "The week's decisions, risks, and open questions in writing",
      "Commit access to your own repository from day one",
    ],
  },
  {
    n: "04",
    title: "Launch",
    lead: "Mobile QA, browser QA, security basics, content review, analytics, and deployment — under accounts you control.",
    receive: [
      "A launch checklist that had to pass before going live",
      "Ownership of domain, hosting, repository, and analytics",
      "Named people responsible for resolving post-launch issues",
    ],
  },
  {
    n: "05",
    title: "Improve",
    lead: "Monitoring, iteration, and a modernization roadmap you can act on with us or independently.",
    receive: [
      "Monitoring and alerts configured to reach a human",
      "A prioritized improvement list based on real usage",
      "Documentation structured for another team to pick up",
    ],
  },
];

export default function ProcessPage() {
  return (
    <div>
      {/* Hero */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
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
            Five distinct phases with weekly demos and clear ownership. You see working progress, decisions, risks, and tests
            every week instead of waiting for a deadline.
          </p>
        </div>
      </section>

      {/* Phases */}
      <section>
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
      <section>
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
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14, marginTop: 32 }}>
            <Reveal>
              <Card variant="plain" style={{ padding: 28 }}>
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 500, margin: 0 }}>Senior review, always</p>
                <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0" }}>
                  AI is used for speed. A senior engineer remains responsible for architecture, security, and quality.
                  AI-accelerated, senior-reviewed, production-ready.
                </p>
              </Card>
            </Reveal>
            <Reveal>
              <Card variant="plain" style={{ padding: 28 }}>
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 500, margin: 0 }}>You own everything</p>
                <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0" }}>
                  Your code. Your accounts. Your data. No developer personally owns the domain, repository, or
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
