"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";
import { ContactFormSkeleton } from "@/components/ui/FormSkeleton";

/**
 * Contact page loading skeleton
 */
export default function Loading() {
  const reduceMotion = usePrefersReducedMotion();
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

      {/* Contact Form Section */}
      <section style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <ContactFormSkeleton delay={300} />
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section style={{ padding: "80px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={1500} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", margin: "0 auto 16px", display: "inline-block" }} />
          <Skeleton variant="heading" width="60%" height="48px" delay={1600} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 24px" }} />
          <Skeleton variant="text" width="70%" height="24px" delay={1700} style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 32px" }} />
          <Skeleton variant="button" width="auto" delay={1800} style={{ padding: "16px 28px", minHeight: 52 }} />
        </div>
      </section>
    </div>
  );
}