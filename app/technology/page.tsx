import type { Metadata } from "next";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import Callout from "@/components/ui/Callout";

export const metadata: Metadata = {
  title: "Technology — ACEVA Technology",
  description: "The stack we build with by default, what we choose it for, and where the decision is still open.",
};

interface TechCategory {
  kicker: string;
  chips: string[];
  dashedChips?: string[];
  body: string;
}

const CATEGORIES: TechCategory[] = [
  {
    kicker: "FRONTEND & PRODUCT",
    chips: ["Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui", "Framer Motion", "Lucide"],
    body: "Server rendering for speed and SEO, a typed codebase another team can inherit, and motion that is measured in milliseconds rather than decoration.",
  },
  {
    kicker: "BACKEND & DATA",
    chips: ["Node.js", "REST & typed APIs", "PostgreSQL"],
    dashedChips: ["ORM — PENDING APPROVAL"],
    body: "Relational data by default, because most business problems are relational. Authentication and payments use managed providers rather than hand-rolled code.",
  },
  {
    kicker: "MOBILE",
    chips: ["Cross-platform first", "Native when justified"],
    dashedChips: ["FRAMEWORK — PENDING APPROVAL"],
    body: "We do not promise separate native iOS and Android builds when a cross-platform product is what the budget and the plan support.",
  },
  {
    kicker: "INTELLIGENCE & AUTOMATION",
    chips: ["LLM APIs", "Retrieval over your documents", "Workflow automation", "Human approval & logging"],
    body: "Every automation is designed to stop at the decision. We do not call a chatbot an agent, and we do not ship full autonomy.",
  },
  {
    kicker: "CLOUD, DEVOPS & SECURITY",
    chips: ["CI on every change", "Staging + rollback", "Secrets management", "Monitoring & backups"],
    dashedChips: ["HOST — PENDING APPROVAL"],
    body: "Nobody deploys production from a laptop. Accounts are company-controlled and handed to you — never owned personally by a developer.",
  },
  {
    kicker: "QUALITY & DESIGN",
    chips: ["Acceptance criteria", "Automated tests", "Senior code review", "WCAG AA target", "Design system per client"],
    body: "Quality is a process, not a promise. Testing, documentation and review are scheduled work with named owners.",
  },
];

export default function TechnologyPage() {
  return (
    <div>
      {/* Hero */}
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
            TECHNOLOGY
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
            The stack, and why we chose it.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "58ch" }}>
            A logo grid proves nothing. Here is what we build with by default, what we choose it for, and where the
            decision is still open.
          </p>
          <Callout
            variant="info"
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              fontSize: 14.5,
              lineHeight: 1.6,
              color: "var(--ink)",
              margin: "26px 0 0",
              maxWidth: "58ch",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ice)"
              strokeWidth="1.8"
              style={{ marginTop: 2, flex: "none" }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v5h1" />
            </svg>
            <span>
              Items marked PENDING APPROVAL are decisions the senior team has not signed off yet. We would rather
              show the gap than pretend it is closed.
            </span>
          </Callout>
        </div>
      </section>

      {/* Stack categories */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(20px,4vw,48px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
            {CATEGORIES.map((cat) => (
              <Reveal key={cat.kicker}>
                <Card
                  variant="plain"
                  style={{ padding: 26, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
                >
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".16em", color: "var(--electric)", margin: "0 0 16px" }}>
                    {cat.kicker}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cat.chips.map((chip) => (
                      <Tag key={chip} variant="chip">
                        {chip}
                      </Tag>
                    ))}
                    {cat.dashedChips?.map((chip) => (
                      <Tag key={chip} variant="dashed">
                        {chip}
                      </Tag>
                    ))}
                  </div>
                  <p style={{ fontSize: 14.5, lineHeight: 1.62, color: "var(--muted)", margin: "18px 0 0" }}>{cat.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
