"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon, ChevronDownIcon, CloseIcon, LogoMark } from "@/components/ui/icons";
import styles from "./Header.module.css";

interface PillStyle {
  color: string;
  background: string;
  boxShadow: string;
}

function pillStyle(on: boolean): PillStyle {
  return on
    ? { color: "var(--ink)", background: "var(--elevated)", boxShadow: "inset 0 0 0 1px rgba(59,124,255,.18)" }
    : { color: "var(--muted)", background: "transparent", boxShadow: "none" };
}

const DESKTOP_LINKS: { href: string; label: string; match: (p: string) => boolean }[] = [
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
  { href: ROUTES.mobile, label: "Mobile Layouts" },
];

const MORE_ROUTES = MORE_LINKS.map((l) => l.href);

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? Math.min(window.scrollY / total, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Close menus on navigation — syncing to the route, not derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  const headerStyle: CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 80,
    background: scrolled ? "rgba(20,20,24,.62)" : "rgba(10,10,12,.38)",
    borderBottom: `1px solid ${scrolled ? "rgba(245,246,248,.10)" : "rgba(245,246,248,.06)"}`,
    backdropFilter: "blur(13px) saturate(140%)",
    WebkitBackdropFilter: "blur(13px) saturate(140%)",
    boxShadow: scrolled ? "0 10px 30px rgba(0,0,0,.4)" : "none",
    transition: "background 260ms ease, border-color 260ms ease, backdrop-filter 260ms ease, box-shadow 260ms ease",
  };

  const moreActive = MORE_ROUTES.some((r) => pathname === r);

  return (
    <>
      <header ref={navRef} className="ac-hairline" style={headerStyle}>
        <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "linear-gradient(90deg, var(--royal), var(--electric))", transform: `scaleX(${progress})`, transformOrigin: "left", opacity: progress > 0 ? 1 : 0, transition: "transform 90ms linear, opacity 260ms ease", willChange: "transform" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)", height: 72, display: "flex", alignItems: "center", gap: 32 }}>
          <Link href={ROUTES.home} aria-label="ACEVA Technology — home" className={styles.logoBtn} style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ink)" }}>
            <LogoMark id="acevaStrokeHeader" />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: 17, letterSpacing: ".16em" }}>ACEVA</span>
              <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8, letterSpacing: ".32em", color: "var(--electric)", marginTop: 3 }}>TECHNOLOGY</span>
            </span>
          </Link>

          <nav aria-label="Primary" data-desktop-nav style={{ alignItems: "center", gap: 4, marginLeft: 8 }}>
            {DESKTOP_LINKS.map((l) => {
              const p = pillStyle(l.match(pathname));
              return (
                <Link key={l.href} href={l.href} className="ac-nav-btn" style={{ color: p.color, background: p.background, boxShadow: p.boxShadow }}>
                  {l.label}
                </Link>
              );
            })}
            {(() => {
              const p = pillStyle(moreActive);
              return (
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className="ac-nav-btn"
                  style={{ color: p.color, background: p.background, boxShadow: p.boxShadow }}
                >
                  More
                  <ChevronDownIcon style={{ transition: "transform 180ms ease", transform: moreOpen ? "rotate(180deg)" : "none", marginLeft: 6 }} />
                </button>
              );
            })()}
          </nav>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={ROUTES.contact} data-desktop-cta className="ac-btn-primary" style={{ padding: "11px 20px" }}>
              Start a Project
              <ArrowRightIcon width={14} height={14} strokeWidth={2.2} />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              data-burger
              aria-label="Open menu"
              className={styles.burger}
              style={{ background: "none", border: "1px solid var(--hairline)", borderRadius: 10, width: 44, height: 44, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 5 }}
            >
              <span style={{ display: "block", width: 17, height: 1.5, background: "var(--ink)" }} />
              <span style={{ display: "block", width: 11, height: 1.5, background: "var(--muted)" }} />
            </button>
          </div>
        </div>

        {moreOpen && (
          <div style={{ borderTop: "1px solid var(--hairline)", background: "rgba(20,20,24,.92)", backdropFilter: "blur(18px)", transformOrigin: "top", animation: "acDropdownIn 260ms cubic-bezier(.16,1,.3,1) both" }}>
            <div className="ac-more-grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "26px clamp(20px,4vw,48px) 30px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "8px 28px" }}>
              {MORE_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className={styles.moreItem} style={{ textAlign: "left", padding: "10px 12px", borderRadius: 8, color: "var(--ink)", fontSize: 14.5, fontWeight: 500 }}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "var(--void)", display: "flex", flexDirection: "column", animation: "acFadeUp 240ms cubic-bezier(.16,1,.3,1) both" }}>
          <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 clamp(20px,4vw,48px)", borderBottom: "1px solid var(--hairline)" }}>
            <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".24em", color: "var(--muted)" }}>MENU</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className={styles.closeBtn}
              style={{ background: "none", border: "1px solid var(--hairline)", borderRadius: 10, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink)" }}
            >
              <CloseIcon />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px clamp(20px,4vw,48px) 140px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {DESKTOP_LINKS.map((l, i) => (
                <Link
                  key={l.href}
                  href={l.href}
                  style={{ textAlign: "left", borderBottom: "1px solid var(--hairline)", padding: "20px 0", color: "var(--ink)", fontFamily: "var(--font-space-grotesk)", fontSize: 26, fontWeight: 500, letterSpacing: "-.01em", minHeight: 56, display: "block", animation: `acMobileItem 420ms cubic-bezier(.16,1,.3,1) ${90 + i * 55}ms both` }}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".24em", color: "var(--muted)", margin: "34px 0 10px", animation: "acMobileItem 420ms cubic-bezier(.16,1,.3,1) 340ms both" }}>COMPANY</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 18px" }}>
              {MORE_LINKS.map((l, i) => (
                <Link key={l.href} href={l.href} style={{ textAlign: "left", padding: "14px 0", color: "var(--muted)", fontSize: 15, minHeight: 48, display: "block", animation: `acMobileItem 420ms cubic-bezier(.16,1,.3,1) ${400 + i * 35}ms both` }}>
                  {l.label}
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 10 }}>
              <Link href={ROUTES.contact} className="ac-btn-primary" style={{ padding: 17, borderRadius: 12, minHeight: 56, animation: `acMobileItem 420ms cubic-bezier(.16,1,.3,1) ${680 + MORE_LINKS.length * 35}ms both` }}>
                Start a Project
              </Link>
              <a href="mailto:acevatechnology@gmail.com" className={styles.mobileEmail} style={{ textAlign: "center", border: "1px solid var(--hairline)", color: "var(--ink)", fontSize: 16, fontWeight: 500, padding: 17, borderRadius: 12, minHeight: 56, animation: `acMobileItem 420ms cubic-bezier(.16,1,.3,1) ${760 + MORE_LINKS.length * 35}ms both` }}>
                acevatechnology@gmail.com
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
