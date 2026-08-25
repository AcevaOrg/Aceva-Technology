"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon, CloseIcon, LogoMark } from "@/components/ui/icons";
import styles from "./Header.module.css";

const DESKTOP_LINKS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: ROUTES.home, label: "Home", match: () => false },
  { href: ROUTES.services, label: "Capabilities", match: (p) => p.startsWith("/services") },
  { href: ROUTES.work, label: "Experiments", match: (p) => p === ROUTES.work },
  { href: ROUTES.process, label: "How We Work", match: (p) => p === ROUTES.process },
  { href: ROUTES.about, label: "Why Aceva", match: (p) => p === ROUTES.about },
];

const MORE_LINKS = [
  { href: ROUTES.company, label: "About Us" },
  { href: ROUTES.technology, label: "Technology Stack" },
  { href: ROUTES.industries, label: "Industries We Serve" },
  { href: ROUTES.testimonials, label: "Client Feedback" },
  { href: ROUTES.careers, label: "Careers" },
  { href: ROUTES.insights, label: "Insights" },
  { href: ROUTES.faq, label: "FAQs" },
];

const MORE_ROUTES = MORE_LINKS.map((l) => l.href);

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const moreActive = MORE_ROUTES.some((r) => pathname === r);

  const handleHomeClick = () => {
    if (pathname === ROUTES.home) window.scrollTo(0, 0);
  };

  return (
    <>
      {/* Floating Crystal Navbar */}
      <header
        ref={navRef}
        className={styles.crystalHeader}
        style={{
          paddingTop: scrolled ? "10px" : "18px",
          transition: "padding-top 320ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div className={styles.crystalPill}>

          {/* Logo */}
          <Link
            href={ROUTES.home}
            onClick={handleHomeClick}
            aria-label="ACEVA Technology — home"
            className={styles.logoBtn}
          >
            <LogoMark id="acevaStrokeHeader" />
            <span className={styles.logoText}>
              <span className={styles.logoName}>ACEVA</span>
              <span className={styles.logoSub}>TECHNOLOGY</span>
            </span>
          </Link>

          {/* Divider */}
          <div className={styles.pillDivider} />

          {/* Desktop Nav */}
          <nav aria-label="Primary" data-desktop-nav className={styles.crystalNav}>
            {DESKTOP_LINKS.map((l) => {
              const active = l.match(pathname);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={l.href === ROUTES.home ? handleHomeClick : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`${styles.crystalLink} ${active ? styles.crystalLinkActive : ""}`}
                >
                  {l.label}
                </Link>
              );
            })}

          </nav>

          {/* CTA Button */}
          <Link
            href={ROUTES.contact}
            data-desktop-cta
            className={styles.crystalCta}
          >
            Start a Project
            <ArrowRightIcon width={14} height={14} strokeWidth={2.2} />
          </Link>

          {/* More dropdown trigger */}
          <div className={`${styles.moreWrapper} ${styles.desktopMore}`}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label="More pages"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={`${styles.menuButton} ${moreActive ? styles.menuButtonActive : ""}`}
            >
              <span className={styles.menuIcon} aria-hidden="true">
                <span className={styles.menuIconLine} />
                <span className={styles.menuIconLine} />
                <span className={styles.menuIconLine} />
              </span>
            </button>

            {moreOpen && (
              <div className={styles.moreDropdown} role="menu">
                <div className={styles.moreDropdownInner}>
                  {MORE_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} role="menuitem" className={styles.moreDropdownItem}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile burger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            data-burger
            aria-label="Open menu"
            className={styles.burger}
          >
            <span className={styles.menuIcon} aria-hidden="true">
              <span className={styles.menuIconLine} />
              <span className={styles.menuIconLine} />
              <span className={styles.menuIconLine} />
            </span>
          </button>
        </div>
      </header>

      {/* Mobile fullscreen menu */}
      {menuOpen && (
        <div className={styles.mobileOverlay}>
          <div className={styles.mobileHeader}>
            <span className={styles.mobileMenuLabel}>MENU</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className={styles.closeBtn}
            >
              <CloseIcon />
            </button>
          </div>
          <div className={styles.mobileBody}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {DESKTOP_LINKS.map((l, i) => {
                const active = l.match(pathname);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={l.href === ROUTES.home ? handleHomeClick : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`${styles.mobilePrimaryLink} ${active ? styles.mobilePrimaryLinkActive : ""}`}
                    style={{ animationDelay: `${90 + i * 55}ms` }}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>

            <p className={styles.mobileSection}>COMPANY</p>
            <div className={styles.mobileGrid}>
              {MORE_LINKS.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={styles.mobileSecondaryLink}
                  style={{ animationDelay: `${400 + i * 35}ms` }}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className={styles.mobileCtas}>
              <Link
                href={ROUTES.contact}
                className="ac-btn-primary"
                style={{
                  padding: 17,
                  borderRadius: 12,
                  minHeight: 56,
                  animationDelay: `${680 + MORE_LINKS.length * 35}ms`,
                }}
              >
                Start a Project
              </Link>
              <a
                href="mailto:acevatechnology@gmail.com"
                className={styles.mobileEmail}
                style={{ animationDelay: `${760 + MORE_LINKS.length * 35}ms` }}
              >
                acevatechnology@gmail.com
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
