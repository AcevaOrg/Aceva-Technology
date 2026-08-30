import Link from "next/link";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/social";
import { LogoMark } from "@/components/ui/icons";
import SocialLinks from "@/components/ui/SocialLinks";
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
      <div aria-hidden="true" className={styles.animatedBackdrop}>
        <div className={styles.ambientGlow} />
        <div className={styles.wordmarkTrack}>
          <svg className={styles.backgroundWord} viewBox="0 0 1000 170" role="presentation">
            <defs>
              <linearGradient id="footerWordmarkFill" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#315baf" />
                <stop offset="0.48" stopColor="#dce9ff" />
                <stop offset="1" stopColor="#3b7cff" />
              </linearGradient>
            </defs>
            <g fill="url(#footerWordmarkFill)">
              <path d="M20 150 100 20l80 130h-32l-48-79-48 79Z" />
              <path d="M380 20H280l-60 65 60 65h100v-26h-89l-39-39 39-39h89Z" />
              <path d="M420 20h160v26H420Zm0 54h140v22H420Zm0 50h160v26H420Z" />
              <path d="m620 20 32 1 48 81 48-81 32-1-80 130Z" />
              <path d="m820 150 80-130 80 130h-32l-48-79-48 79Z" />
            </g>
          </svg>
        </div>
        <div className={styles.backdropVeil} />
      </div>
      <div className="image-backed-content" style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "clamp(48px,6vw,72px) clamp(20px,4vw,48px)" }}>
        <div className={styles.footerGrid}>
          <div className={styles.brandBlock}>
            <div className={styles.brandLockup}>
              <LogoMark id="acevaStrokeFoot" width={36} height={22} />
              <span className={styles.brandText}>
                <span className={styles.brandName}>ACEVA</span>
                <span className={styles.brandSub}>TECHNOLOGY</span>
              </span>
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
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 14, color: "var(--ink)" }}>
                {CONTACT_EMAIL}
              </a>
              <a href={`tel:${CONTACT_PHONE.e164}`} style={{ fontSize: 14, color: "var(--ink)" }}>
                {CONTACT_PHONE.display}
              </a>
              <a
                href={CONTACT_PHONE.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, color: "var(--muted)" }}
              >
                Chat on WhatsApp
              </a>
            </div>
            <SocialLinks className={styles.socialRow} />
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "14px 26px", alignItems: "center", justifyContent: "space-between", marginTop: "clamp(36px,5vw,56px)", paddingTop: 24 }}>
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
