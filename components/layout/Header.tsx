"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/nav";
import { CONTACT_EMAIL } from "@/lib/social";
import { ArrowRightIcon, CloseIcon, LogoMark } from "@/components/ui/icons";
import { PulseButton, usePulse } from "@/components/pulse";
import styles from "./Header.module.css";

const DESKTOP_LINKS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: ROUTES.home, label: "Home", match: (p) => p === ROUTES.home },
  { href: ROUTES.services, label: "Capabilities", match: (p) => p.startsWith("/services") },
  { href: ROUTES.work, label: "Experiments", match: (p) => p === ROUTES.work },
  { href: ROUTES.process, label: "How We Work", match: (p) => p === ROUTES.process },
  { href: ROUTES.about, label: "Why Aceva", match: (p) => p === ROUTES.about },
];

// Footer-tier pages (Technology Stack, Careers, Insights, FAQs) deliberately live only
// in the footer — this list is navigation, not a duplicate of it.
const MORE_LINKS = [
  { href: ROUTES.company, label: "About Us" },
  { href: ROUTES.industries, label: "Industries We Serve" },
  { href: ROUTES.testimonials, label: "Client Feedback" },
];

const MORE_ROUTES = MORE_LINKS.map((l) => l.href);

export default function Header() {
  const pathname = usePathname();
  const { openPulse, state: pulseState } = usePulse();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const moreWrapperRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);

  // Returns focus to the control that opened the menu, so keyboard users are not dumped
  // at the top of the document.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    burgerRef.current?.focus();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the "More" dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!moreOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreWrapperRef.current && !moreWrapperRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [moreOpen]);

  // While the drawer is open it behaves as a modal dialog: the page behind must
  // not scroll, focus starts inside it, Tab cycles within it, and Escape dismisses it.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
        return;
      }
      if (e.key !== "Tab") return;

      const root = mobilePanelRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen, closeMenu]);

  // Escape closes the "More" dropdown and hands focus back to its trigger.
  useEffect(() => {
    if (!moreOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [moreOpen]);

  useEffect(() => {
    // Navigating away closes both without stealing focus from the incoming page.
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

          {/* Mobile Right Action Group (PULSE AI + Burger) */}
          <div className={styles.mobileActionsGroup}>
            <PulseButton
              onClick={openPulse}
              expandedState={pulseState.stage !== "entry" && pulseState.stage !== "intent"}
              className={styles.headerPulse}
            />

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
            <div ref={moreWrapperRef} className={`${styles.moreWrapper} ${styles.desktopMore}`}>
              <button
                ref={moreButtonRef}
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
          </div>

          {/* Mobile burger */}
          <button
            ref={burgerRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            data-burger
            aria-label="Open menu"
            aria-expanded={menuOpen}
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

      {/* Mobile drawer — kept mounted so it can animate both in and out; `inert` keeps
          it out of the tab order and accessibility tree while closed. */}
      <div
        className={styles.mobileScrim}
        data-open={menuOpen || undefined}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <div
        ref={mobilePanelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        data-open={menuOpen || undefined}
        inert={!menuOpen}
        className={styles.mobilePanel}
      >
        <div className={styles.mobileHeader}>
          <span className={styles.mobileMenuLabel}>MENU</span>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeMenu}
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
                  className={`${styles.mobilePrimaryLink} ${styles.mobileFadeItem} ${active ? styles.mobilePrimaryLinkActive : ""}`}
                  style={{ transitionDelay: `${90 + i * 45}ms` }}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <p className={`${styles.mobileSection} ${styles.mobileFadeItem}`} style={{ transitionDelay: "320ms" }}>
            COMPANY
          </p>
          <div className={styles.mobileGrid}>
            {MORE_LINKS.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                className={`${styles.mobileSecondaryLink} ${styles.mobileFadeItem}`}
                style={{ transitionDelay: `${360 + i * 35}ms` }}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* The fade rides the wrapper: both children own `transition` declarations of
              their own (hover lift, border colour) that a fade class would overwrite. */}
          <div
            className={`${styles.mobileCtas} ${styles.mobileFadeItem}`}
            style={{ transitionDelay: `${440 + MORE_LINKS.length * 35}ms` }}
          >
            <Link
              href={ROUTES.contact}
              className="ac-btn-primary"
              style={{ padding: 17, borderRadius: 12, minHeight: 56 }}
            >
              Start a Project
            </Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className={styles.mobileEmail}>
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
