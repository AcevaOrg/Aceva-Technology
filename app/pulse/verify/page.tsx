import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PULSE_FEATURES } from "@/lib/pulse/features";
import VerifyBlueprint from "./VerifyBlueprint";

/**
 * Landing page for the single-use link in the blueprint confirmation email.
 *
 * Exists only while blueprint email is enabled; until then it is a 404. The
 * token travels in the URL fragment, which the browser never sends to the
 * server, and the visitor confirms with a button: opening the link alone does
 * nothing, so a mail scanner that prefetches links cannot spend the token.
 */
export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  if (!PULSE_FEATURES.blueprintEmail) notFound();

  return (
    <section style={{ maxWidth: 640, margin: "0 auto", padding: "calc(var(--nav-offset) + 48px) 20px 96px" }}>
      <h1 style={{ fontSize: "clamp(28px,4vw,40px)", margin: 0 }}>Confirm your email</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>
        Confirm below and we&apos;ll email your project blueprint to the address it was saved with.
      </p>
      <VerifyBlueprint />
    </section>
  );
}
