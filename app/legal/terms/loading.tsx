"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";

/**
 * Terms of service page loading skeleton
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
      <section style={{ padding: "clamp(100px,15vh,160px) 0 clamp(60px,8vh,100px)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={0} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 24, display: "inline-block" }} />
          <Skeleton variant="heading" width="80%" height="clamp(56px,12vw,120px)" delay={100} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2.25rem,11vw,3.55rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.045em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonText key={i} lines={i % 3 === 0 ? 1 : 3} lastLineWidth="70%" delay={200 + i * 80} style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4 }} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}