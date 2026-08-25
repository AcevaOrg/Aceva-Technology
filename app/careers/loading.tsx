"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton, { SkeletonText, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Careers page loading skeleton
 */
export default function Loading() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || reduceMotion) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "50px", threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  const shouldAnimate = inView && !reduceMotion;

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
      }}
    >
      {/* Hero Section */}
      <section style={{ position: "relative", padding: "clamp(100px,15vh,160px) 0 clamp(60px,8vh,100px)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.72)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)", textAlign: "center" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={0} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", margin: "0 auto 24px", display: "inline-block" }} />
          <Skeleton variant="heading" width="80%" height="clamp(56px,12vw,120px)" delay={100} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2.25rem,11vw,3.55rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.045em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 24px" }} />
          <Skeleton variant="text" width="60%" height="24px" delay={200} style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto" }} />
        </div>
      </section>

      {/* Lane Cards Section */}
      <section style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={300} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={400} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard
                key={i}
                variant="flagship"
                showImage={false}
                showHeader={true}
                showBody={true}
                showFooter={true}
                bodyLines={4}
                delay={500 + i * 80}
                style={{ minHeight: 320 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Open Roles Section */}
      <section style={{ padding: "80px 0", borderTop: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={900} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={1000} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 32 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard
                key={i}
                variant="ghost"
                showImage={false}
                showHeader={true}
                showBody={true}
                showFooter={false}
                bodyLines={2}
                delay={1100 + i * 60}
                style={{ minHeight: 160 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: "80px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={1400} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", margin: "0 auto 16px", display: "inline-block" }} />
          <Skeleton variant="heading" width="60%" height="48px" delay={1500} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 24px" }} />
          <Skeleton variant="text" width="70%" height="24px" delay={1600} style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 32px" }} />
          <Skeleton variant="button" width="auto" delay={1700} style={{ padding: "16px 28px", minHeight: 52 }} />
        </div>
      </section>
    </div>
  );
}