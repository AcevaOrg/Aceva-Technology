import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { CONTACT_EMAIL, CONTACT_PHONE, SOCIAL_LINKS } from "@/lib/social";
import { ArrowRightIcon, FacebookIcon, InstagramIcon, LinkedInIcon, LogoMark, PhoneIcon, WhatsAppIcon, XIcon } from "@/components/ui/icons";
import FooterCopyEmail from "./FooterCopyEmail";
import FooterPulseButton from "./FooterPulseButton";
import FooterSignature from "./FooterSignature";
import styles from "./Footer.module.css";

type FooterLink = { href: string; label: string };

const GROUPS: { key: string; title: string; links: FooterLink[] }[] = [
  {
    key: "capabilities",
    title: "Capabilities",
    links: [
      { href: capabilityRoute("digital"), label: "Digital Experiences" },
      { href: capabilityRoute("software"), label: "Custom Software" },
      { href: capabilityRoute("mobile"), label: "Mobile Products" },
      { href: capabilityRoute("intelligence"), label: "Intelligence & Automation" },
      { href: capabilityRoute("rescue"), label: "Product Rescue" },
    ],
  },
  {
    key: "company",
    title: "Company",
    links: [
      { href: ROUTES.company, label: "About Us" },
      { href: ROUTES.about, label: "Why Aceva" },
      { href: ROUTES.process, label: "How We Work" },
      { href: ROUTES.industries, label: "Industries" },
      { href: ROUTES.careers, label: "Careers" },
      { href: ROUTES.contact, label: "Contact" },
    ],
  },
  {
    key: "resources",
    title: "Resources",
    links: [
      { href: ROUTES.work, label: "Experiments" },
      { href: ROUTES.technology, label: "Technology Stack" },
      { href: ROUTES.insights, label: "Insights" },
      { href: ROUTES.faq, label: "FAQs" },
    ],
  },
];

// WhatsApp is a conversation channel, so it sits with the phone line rather than the profiles.
const PROFILE_NAMES: Record<string, { name: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  linkedin: { name: "LinkedIn", Icon: LinkedInIcon },
  instagram: { name: "Instagram", Icon: InstagramIcon },
  facebook: { name: "Facebook", Icon: FacebookIcon },
  x: { name: "X", Icon: XIcon },
};
const PROFILES = SOCIAL_LINKS.filter((social) => social.key in PROFILE_NAMES);

function PulseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12h4l2.5-7 4 14 3-10.5 1.5 3.5h5" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link href={ROUTES.home} className={styles.lockup} aria-label="ACEVA Technology home">
              <LogoMark id="acevaStrokeFoot" width={40} height={24} />
              <span className={styles.lockupText}>
                <span className={styles.lockupName}>ACEVA</span>
                <span className={styles.lockupSub}>TECHNOLOGY</span>
              </span>
            </Link>
            <p className={styles.statement}>
              Aceva builds new products, improves existing operations and rescues software that needs a stronger path forward.
            </p>
            <p className={styles.entity}>ACEVA HOLDINGS / SOFTWARE DIVISION</p>
          </div>

          <div className={styles.contact}>
            <p className={styles.label}>
              <span className={styles.slash} aria-hidden="true" />
              Start a conversation
            </p>
            <div className={styles.emailRow}>
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.email}>
                {CONTACT_EMAIL}
              </a>
              <FooterCopyEmail email={CONTACT_EMAIL} className={styles.copy} statusClassName={styles.srOnly} />
            </div>
            <ul className={styles.channels}>
              <li>
                <a href={`tel:${CONTACT_PHONE.e164}`} className={styles.channel}>
                  <PhoneIcon width={16} height={16} />
                  {CONTACT_PHONE.display}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT_PHONE.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.channel}
                  aria-label="Chat with ACEVA Technology on WhatsApp (opens in a new tab)"
                >
                  <WhatsAppIcon width={16} height={16} />
                  WhatsApp
                </a>
              </li>
              <li>
                <FooterPulseButton className={styles.channel}>
                  <PulseGlyph />
                  Ask Aceva Pulse
                </FooterPulseButton>
              </li>
            </ul>
          </div>
        </div>

        <nav className={styles.columns} aria-label="Footer">
          {GROUPS.map((group, index) => (
            <div key={group.key} className={styles.column}>
              <p id={`footer-${group.key}`} className={styles.columnTitle}>
                <span className={styles.columnIndex}>0{index + 1}</span>
                {group.title}
              </p>
              <ul className={styles.list} aria-labelledby={`footer-${group.key}`}>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.link}>
                      <span className={styles.linkText}>{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className={styles.column}>
            <p id="footer-follow" className={styles.columnTitle}>
              <span className={styles.columnIndex}>0{GROUPS.length + 1}</span>
              Follow
            </p>
            <ul className={styles.list} aria-labelledby="footer-follow">
              {PROFILES.map((profile) => {
                const { name, Icon } = PROFILE_NAMES[profile.key];
                return (
                  <li key={profile.key}>
                    <a
                      href={profile.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                      aria-label={`${profile.label} (opens in a new tab)`}
                    >
                      <span className={styles.linkText}>
                        <Icon width={15} height={15} className={styles.profileIcon} />
                        {name}
                        <ArrowRightIcon width={12} height={12} className={styles.external} />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className={styles.legal}>
          <p className={styles.copyright}>© {new Date().getFullYear()} Aceva Technology. All rights reserved.</p>
          <ul className={styles.legalLinks}>
            <li>
              <Link href={ROUTES.privacy} className={styles.legalLink}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href={ROUTES.terms} className={styles.legalLink}>
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>

        <FooterSignature className={styles.signature} sweepClassName={styles.sweep} />
      </div>
    </footer>
  );
}
