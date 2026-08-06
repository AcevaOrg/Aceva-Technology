import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { MailIcon } from "@/components/ui/icons";

export default function MobileCtaBar() {
  return (
    <div
      data-mobile-cta
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 70,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        background: "rgba(10,10,12,.86)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid var(--hairline)",
        gap: 10,
      }}
    >
      <a
        href="mailto:acevatechnology@gmail.com"
        aria-label="Email Aceva"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 52, minHeight: 52, border: "1px solid var(--hairline)", borderRadius: 11, color: "var(--ink)" }}
      >
        <MailIcon />
      </a>
      <Link href={ROUTES.contact} style={{ flex: 1, background: "var(--royal)", color: "#fff", fontSize: 16, fontWeight: 600, borderRadius: 11, minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
        Start a Project
      </Link>
    </div>
  );
}
