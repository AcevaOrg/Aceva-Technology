import Link from "next/link";
import Image from "next/image";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { LogoMark } from "@/components/ui/icons";
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
];

function LinkColumn({ title, links, card = false }: { title: string; links: { href: string; label: string }[]; card?: boolean }) {
  return (
    <div className={card ? styles.navCard : undefined}>
      <p className={styles.navTitle}>{title}</p>
      <div className={styles.linkList}>
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
    <footer className="ac-hairline" style={{ borderTop: "1px solid var(--hairline)", position: "relative", zIndex: 1, overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <Image src="/images/used/aceva-footer-background-8k-4x1.png" alt="" fill sizes="100vw" className="ac-section-image ac-section-image--footer bg-pan-slow" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,12,.72) 0%, rgba(10,10,12,.40) 30%, rgba(10,10,12,.40) 70%, rgba(10,10,12,.72) 100%)" }} />
      </div>
      <div className="image-backed-content" style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,6vw,72px) clamp(20px,4vw,48px)" }}>
        <div className={styles.footerGrid}>
          <div className={styles.brandBlock}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <LogoMark id="acevaStrokeFoot" width={36} height={22} />
              <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: 16, letterSpacing: ".16em" }}>ACEVA</span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px 0 0", maxWidth: "34ch" }}>
              Aceva builds new products, improves existing operations and rescues software that needs a stronger path forward.
            </p>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".16em", color: "#4b4f5b", margin: "20px 0 0" }}>
              ACEVA HOLDINGS / SOFTWARE DIVISION
            </p>
          </div>

          <LinkColumn title="CAPABILITIES" links={CAPABILITY_LINKS} card />
          <LinkColumn title="COMPANY" links={COMPANY_LINKS} card />
          <LinkColumn title="RESOURCES" links={RESOURCE_LINKS} card />

          <div className={styles.contactBlock}>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>CONTACT</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, alignItems: "flex-start" }}>
              <a href="mailto:acevatechnology@gmail.com" style={{ fontSize: 14, color: "var(--ink)" }}>
                acevatechnology@gmail.com
              </a>
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
          </div>
        </div>
      </div>
    </footer>
  );
}
