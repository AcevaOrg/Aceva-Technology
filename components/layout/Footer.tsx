import Link from "next/link";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { LogoMark } from "@/components/ui/icons";
import BackToTopButton from "./BackToTopButton";
import styles from "./Footer.module.css";

const CAPABILITY_LINKS = [
  { href: capabilityRoute("digital"), label: "Digital Experiences" },
  { href: capabilityRoute("software"), label: "Custom Software" },
  { href: capabilityRoute("mobile"), label: "Mobile Products" },
  { href: capabilityRoute("intelligence"), label: "Intelligence & Automation" },
  { href: capabilityRoute("rescue"), label: "Product Rescue" },
];

const COMPANY_LINKS = [
  { href: ROUTES.company, label: "About Us" },
  { href: ROUTES.about, label: "Why Aceva" },
  { href: ROUTES.process, label: "How We Work" },
  { href: ROUTES.industries, label: "Industries" },
  { href: ROUTES.careers, label: "Careers" },
];

const RESOURCE_LINKS = [
  { href: ROUTES.work, label: "Experiments" },
  { href: ROUTES.technology, label: "Technology Stack" },
  { href: ROUTES.insights, label: "Insights" },
  { href: ROUTES.faq, label: "FAQs" },
  { href: ROUTES.mobile, label: "Mobile Layouts" },
];

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "flex-start" }}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={styles.link}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="ac-hairline" style={{ borderTop: "1px solid var(--hairline)", background: "#0f0f13", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,6vw,72px) clamp(20px,4vw,48px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "36px 28px" }}>
          <div style={{ gridColumn: "span 2", minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <LogoMark id="acevaStrokeFoot" width={26} height={26} />
              <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: 16, letterSpacing: ".16em" }}>ACEVA</span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px 0 0", maxWidth: "34ch" }}>
              Aceva builds new products, improves existing operations and rescues software that needs a stronger path forward.
            </p>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".16em", color: "#4b4f5b", margin: "20px 0 0" }}>
              ACEVA HOLDINGS / SOFTWARE DIVISION
            </p>
          </div>

          <LinkColumn title="CAPABILITIES" links={CAPABILITY_LINKS} />
          <LinkColumn title="COMPANY" links={COMPANY_LINKS} />
          <LinkColumn title="RESOURCES" links={RESOURCE_LINKS} />

          <div>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>CONTACT</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "flex-start" }}>
              <a href="mailto:acevatechnology@gmail.com" style={{ fontSize: 14, color: "var(--ink)" }}>
                acevatechnology@gmail.com
              </a>
              <span style={{ color: "#4b4f5b", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>PHONE — PLACEHOLDER</span>
              <span style={{ color: "#4b4f5b", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>NEW YORK ADDRESS — PLACEHOLDER</span>
              <span style={{ color: "#4b4f5b", fontFamily: "var(--font-jetbrains-mono)", fontSize: 12 }}>LINKEDIN / GITHUB — PLACEHOLDER</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 26px", alignItems: "center", justifyContent: "space-between", marginTop: "clamp(36px,5vw,56px)", paddingTop: 24, borderTop: "1px solid var(--hairline)" }}>
          <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, color: "#4b4f5b", margin: 0 }}>© 2026 ACEVA TECHNOLOGY. ALL RIGHTS RESERVED.</p>
          <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
            <Link href={ROUTES.privacy} className={styles.bottomLink}>
              Privacy Policy
            </Link>
            <Link href={ROUTES.terms} className={styles.bottomLink}>
              Terms of Service
            </Link>
            <BackToTopButton />
          </div>
        </div>
      </div>
    </footer>
  );
}
