import type { Metadata } from "next";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "relative",
          maxWidth: 720,
          margin: "0 auto",
          padding: "clamp(96px,14vw,160px) clamp(20px,4vw,48px) clamp(96px,14vw,160px)",
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 20px" }}>
          404
        </p>
        <h1
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(28px,4vw,42px)",
            lineHeight: 1.1,
            letterSpacing: "-.03em",
            margin: 0,
          }}
        >
          That page doesn&apos;t exist.
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px auto 0", maxWidth: "42ch" }}>
          The link may be out of date, or the page may have moved. Try the homepage, or start a project.
        </p>
        <div style={{ marginTop: 34, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Button href={ROUTES.home} variant="primary">
            Back to homepage
          </Button>
          <Button href={ROUTES.contact} variant="ghost">
            Start a project
          </Button>
        </div>
      </div>
    </section>
  );
}
