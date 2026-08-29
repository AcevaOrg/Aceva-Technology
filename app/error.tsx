"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import { ROUTES } from "@/lib/nav";

/**
 * Route-level error boundary. Without this, an uncaught render error in a client
 * component (the contact form, the Pulse overlay, the experiments tabs) replaces the
 * whole page with the default Next.js error screen, losing header, footer and branding.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          ERROR
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
          Something went wrong.
        </h1>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px auto 0", maxWidth: "42ch" }}>
          This page failed to load. Trying again usually works — if it does not, tell us what you
          were doing and we will fix it.
        </p>
        {error.digest && (
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".1em", color: "#4b4f5b", margin: "22px 0 0" }}>
            REFERENCE — {error.digest}
          </p>
        )}
        <div style={{ marginTop: 34, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Button type="button" onClick={reset} variant="primary" icon={false}>
            Try again
          </Button>
          <Button href={ROUTES.home} variant="ghost">
            Back to homepage
          </Button>
        </div>
      </div>
    </section>
  );
}
