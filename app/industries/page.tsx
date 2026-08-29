import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";

export const metadata: Metadata = pageMetadata({
  title: "Industries We Serve",
  description:
    "We sell by problem, not by industry. The three problems we start from, and how we map them to your sector before writing a line of code.",
  path: ROUTES.industries,
});

interface Path {
  label: string;
  title: string;
  body: string;
}

const PATHS: Path[] = [
  {
    label: "PATH A",
    title: "Something new has to exist",
    body: "Founders and product teams who need scope, a working prototype, and a production build they can defend.",
  },
  {
    label: "PATH B",
    title: "The operation is slower than the business",
    body: "Operations, service, and finance teams repeating manual work that software should be handling automatically.",
  },
  {
    label: "PATH C",
    title: "Money is spent and the product is stuck",
    body: "Businesses holding unfinished, unstable, or inherited software that needs an honest technical audit.",
  },
];

interface Slot {
  label: string;
  text: string;
}

const SLOTS: Slot[] = [
  { label: "SLOT 01", text: "Add an industry page once a real client engagement supports it." },
  { label: "SLOT 02", text: "Each slot becomes a dedicated page: problem, capability, proof." },
  { label: "SLOT 03", text: "Until then this page stays honest, concise, and grounded." },
];

export default function IndustriesPage() {
  return (
    <div>
      {/* Hero */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
            INDUSTRIES
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
            We sell by problem, not by industry.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: "24px 0 0", maxWidth: "58ch" }}>
            Claiming deep expertise across multiple industries without published case studies would not be honest.
            What we offer is an engineering approach that works across most businesses — naming industries here as active engagements make them real.
          </p>
        </div>
      </section>

      {/* Three problems */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(44px,6vw,80px) clamp(20px,4vw,48px)" }}>
          <Reveal as="p" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 26px" }}>
            THE THREE PROBLEMS WE START FROM
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 14 }}>
            {PATHS.map((p) => (
              <Reveal key={p.label}>
                <Card
                  href={ROUTES.contact}
                  style={{
                    textAlign: "left",
                    background: "rgba(20,20,24,.55)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    padding: 28,
                    minHeight: 190,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "var(--electric)" }}>
                    {p.label}
                  </span>
                  <h2 className="ac-heading-sm" style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 500, lineHeight: 1.28 }}>{p.title}</h2>
                  <span style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)" }}>{p.body}</span>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Additional sectors */}
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px) clamp(44px,6vw,80px)" }}>
          <Reveal as="p" style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 20px" }}>
            INDUSTRY ENGAGEMENT POLICY
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {SLOTS.map((s) => (
              <Reveal key={s.label}>
                <Card variant="ghost" style={{ padding: 24, minHeight: 120, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10.5, letterSpacing: ".14em", color: "#4b4f5b" }}>{s.label}</span>
                  <span style={{ fontSize: 14.5, color: "var(--muted)" }}>{s.text}</span>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
