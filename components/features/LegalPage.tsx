import type { LegalDoc } from "@/lib/data/legal";
import { CONTACT_EMAIL } from "@/lib/social";
import Eyebrow from "@/components/ui/Eyebrow";
import Callout from "@/components/ui/Callout";
import Reveal from "@/components/ui/Reveal";

interface LegalPageProps {
  doc: LegalDoc;
}

export default function LegalPage({ doc }: LegalPageProps) {
  return (
    <section>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px)" }}>
        <Eyebrow style={{ margin: "0 0 20px" }}>LEGAL</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(30px,4.4vw,48px)",
            lineHeight: 1.06,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          {doc.title}
        </h1>
        <Callout
          variant="warning"
          style={{ display: "flex", gap: 12, alignItems: "flex-start", fontSize: "14.5px", margin: "26px 0 0" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--warning)"
            strokeWidth={2}
            style={{ marginTop: 2, flex: "none" }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          Placeholder document. This scaffold must be replaced with text reviewed by a lawyer in your operating
          jurisdiction before launch.
        </Callout>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column" }}>
          {doc.sections.map((s, i) => (
            <Reveal key={s.h} delay={Math.min(i, 6) * 50} style={{ padding: "26px 0", borderTop: "1px solid var(--hairline)" }}>
              <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, margin: 0 }}>{s.h}</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.7, color: "var(--muted)", margin: "10px 0 0" }}>{s.p}</p>
            </Reveal>
          ))}
        </div>
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            fontSize: 11,
            letterSpacing: ".12em",
            color: "#4b4f5b",
            margin: "30px 0 0",
            paddingTop: 22,
            borderTop: "1px solid var(--hairline)",
          }}
        >
          LAST UPDATED — PLACEHOLDER · CONTACT {CONTACT_EMAIL.toUpperCase()}
        </p>
      </div>
    </section>
  );
}
