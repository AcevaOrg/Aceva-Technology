import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";

export const metadata: Metadata = pageMetadata({
  title: "Technology — ACEVA Technology",
  description: "The real stack we build with by default, and what we switch to when a project needs it.",
});

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
    chips: ["Node.js", "REST & typed APIs", "PostgreSQL", "Prisma"],
    body: "Relational data by default, because most business problems are relational. Prisma keeps the schema typed end-to-end, so the database and the application code cannot quietly drift apart. Authentication and payments use managed providers rather than hand-rolled code.",
  },
  {
    kicker: "MOBILE",
    chips: ["Expo / React Native by default", "Flutter or native when justified"],
    body: "We do not promise separate native iOS and Android builds when a cross-platform product is what the budget and the plan support. Expo covers most projects; we move to Flutter or fully native code only when a specific requirement — hardware access, performance, a platform-only API — actually needs it.",
  },
  {
    kicker: "INTELLIGENCE & AUTOMATION",
    chips: ["LLM APIs", "Retrieval over your documents", "Workflow automation", "Human approval & logging"],
    body: "Every automation is designed to stop at the decision. We do not call a chatbot an agent, and we do not ship full autonomy.",
  },
  {
    kicker: "CLOUD, DEVOPS & SECURITY",
    chips: ["Vercel (frontend)", "AWS / Railway (backend & data)", "CI on every change", "Staging + rollback", "Secrets management", "Monitoring & backups"],
    body: "Nobody deploys production from a laptop. Accounts are company-controlled and handed to you — never owned personally by a developer. Vercel serves the frontend by default; backend and data services run on AWS or Railway, chosen per project rather than forced into one box.",
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
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
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
            A logo grid proves nothing. Here is what we build with by default, and what we switch to when a project
            genuinely needs it.
          </p>
        </div>
      </section>

      {/* Stack categories */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,72px) clamp(20px,4vw,48px)" }}>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
            {CATEGORIES.map((cat) => (
              <Reveal key={cat.kicker}>
                <Card
                  variant="plain"
                  style={{ padding: 26 }}
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
