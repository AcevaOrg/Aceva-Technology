import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";

export const metadata: Metadata = pageMetadata({
  title: "About ACEVA Technology — Team & Structure",
  description:
    "Aceva is the software division of Aceva Holdings. Five senior engineers, named mentorship for every junior, and the month-one launch plan behind this site.",
  path: ROUTES.company,
  absoluteTitle: true,
});

interface Senior {
  role: string;
  title: string;
  body: string;
}

const SENIORS: Senior[] = [
  { role: "SENIOR 1", title: "Technical Lead", body: "Architecture, engineering standards, technical decisions, and code review." },
  { role: "SENIOR 2", title: "Backend & AI", body: "APIs, database management, authentication, integrations, and automation." },
  { role: "SENIOR 3", title: "Frontend & Product", body: "Website experience, interactive elements, dashboards, and mobile web quality." },
  { role: "SENIOR 4", title: "DevOps & Security", body: "Hosting infrastructure, deployment pipelines, secrets management, monitoring, backups, and security checks." },
  { role: "SENIOR 5", title: "Product & QA Lead", body: "Requirements scoping, acceptance criteria, testing coverage, documentation, and delivery schedules." },
];

interface Week {
  label: string;
  title: string;
  body: string;
}

const WEEKS: Week[] = [
  {
    label: "WEEK 1",
    title: "Decisions and design",
    body: "Positioning, sitemap, five capability pages, visual direction, role assignments, account ownership, and wireframes.",
  },
  {
    label: "WEEK 2",
    title: "The selling website",
    body: "Home, Capabilities, How We Work, Why Aceva, and Start a Project — with forms and booking connected.",
  },
  {
    label: "WEEK 3",
    title: "Proof",
    body: "One real interactive demo, one polished dashboard prototype, and the sample Rescue Report.",
  },
  {
    label: "WEEK 4",
    title: "Test and launch",
    body: "Mobile QA, browser QA, security basics, content review, analytics, deployment, and launch.",
  },
];

export default function CompanyPage() {
  return (
    <div>
      {/* Hero */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
            ABOUT US
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
            A software division built to be accountable.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "58ch" }}>
            Aceva is the software division of Aceva Holdings. We established it to deliver custom software engineering with discipline:
            honest scoping, senior code review, weekly working proof, and clean ownership handover.
          </p>
        </div>
      </section>

      {/* Team structure */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)" }}>
          <Reveal as="p" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 26px" }}>
            HOW THE TEAM IS STRUCTURED
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
            {SENIORS.map((s) => (
              <Reveal key={s.role}>
                <Card
                  variant="plain"
                  style={{ padding: 24 }}
                >
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>
                    {s.role}
                  </p>
                  <h3 className="ac-heading-sm" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 500, lineHeight: "normal", margin: 0 }}>{s.title}</h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "8px 0 0" }}>{s.body}</p>
                  <Tag variant="dashed" style={{ marginTop: 16 }}>
                    SENIOR-LED DELIVERY
                  </Tag>
                </Card>
              </Reveal>
            ))}
            <Reveal>
              <Card variant="ghost" style={{ padding: 24 }}>
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 12px" }}>
                  FIVE JUNIORS
                </p>
                <h3 className="ac-heading-sm" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 500, lineHeight: "normal", margin: 0 }}>Growing under named mentors</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "8px 0 0" }}>
                  Research, UI components, feature modules, tests, and documentation — every change reviewed by a named senior engineer before production.
                </p>
              </Card>
            </Reveal>
          </div>
          <Reveal as="p" style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "62ch" }}>
            Team photographs and individual biographies will be published as real profiles are confirmed.
          </Reveal>
        </div>
      </section>

      {/* Month one, in public */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px) clamp(48px,7vw,88px)" }}>
          <Reveal
            as="h2"
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(26px,3.4vw,38px)",
              lineHeight: 1.1,
              letterSpacing: "-.025em",
              margin: 0,
            }}
          >
            Month one, in public.
          </Reveal>
          <Reveal as="p" style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", maxWidth: "54ch" }}>
            The launch schedule we work against. We publish it because operational discipline is a commitment, not a marketing claim.
          </Reveal>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 0,
              marginTop: 34,
              borderTop: "1px solid var(--hairline)",
            }}
          >
            {WEEKS.map((w, i) => (
              <Reveal
                key={w.label}
                style={{
                  padding: i === 0 ? "24px 22px 24px 0" : i === WEEKS.length - 1 ? "24px 0 24px 22px" : "24px 22px",
                  borderRight: i < WEEKS.length - 1 ? "1px solid var(--hairline)" : "none",
                }}
              >
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>
                  {w.label}
                </p>
                <h3 className="ac-heading-sm" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 500, lineHeight: "normal", margin: 0 }}>{w.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "8px 0 0" }}>{w.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
