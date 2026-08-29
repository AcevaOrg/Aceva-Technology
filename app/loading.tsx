"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import Skeleton, { SkeletonGrid, SkeletonText } from "@/components/ui/Skeleton";
import CardSkeleton, { CapabilityCardSkeleton, ProofCardSkeleton, TeaserCardSkeleton, PathCardSkeleton } from "@/components/ui/CardSkeleton";

/**
 * Root loading skeleton - shows while the home page is loading
 * This is the App Router loading.tsx pattern
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

  const baseStyle: CSSProperties = {
    backgroundColor: "var(--elevated)",
    border: "1px solid var(--hairline)",
    borderRadius: "var(--radius)",
    backgroundImage: shouldAnimate
      ? `linear-gradient(90deg, var(--elevated) 25%, rgba(59,124,255,.12) 50%, var(--elevated) 75%)`
      : "none",
    backgroundSize: shouldAnimate ? "200% 100%" : "auto",
    backgroundPosition: shouldAnimate ? "200% 0" : "0 0",
    animation: shouldAnimate ? `acShimmer 1500ms cubic-bezier(.16,1,.3,1) infinite` : "none",
    overflow: "hidden",
  };

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        color: "var(--ink)",
      }}
    >
      {/* Hero Section Skeleton */}
      <section className="hero" style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="hero-overlay" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,12,.82) 0%, rgba(10,10,12,.68) 40%, rgba(10,10,12,.68) 60%, rgba(10,10,12,.82) 100%)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)", textAlign: "center" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={0} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", margin: "0 auto 24px", display: "inline-block" }} />
          <Skeleton variant="heading" width="80%" height="clamp(56px,12vw,120px)" delay={100} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2.25rem,11vw,3.55rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.045em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 24px" }} />
          <Skeleton variant="text" width="60%" height="24px" delay={200} style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 32px" }} />
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Skeleton variant="button" width="auto" delay={300} style={{ padding: "16px 28px", minHeight: 52 }} />
            <Skeleton variant="button" width="auto" delay={350} style={{ padding: "16px 28px", minHeight: 52, background: "transparent", border: "1px solid var(--hairline)" }} />
          </div>
        </div>
      </section>

      {/* Path Selector Section Skeleton */}
      <section className="path-selector" style={{ position: "relative", padding: "80px 0" }}>
        <div className="path-overlay" style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.6)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={400} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={500} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <PathCardSkeleton delay={600} />
            <PathCardSkeleton delay={680} />
            <PathCardSkeleton delay={760} />
          </div>
        </div>
      </section>

      {/* Capabilities Section Skeleton */}
      <section className="capabilities" style={{ position: "relative", overflow: "hidden", padding: "80px 0" }}>
        <div className="capabilities-overlay" style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.72)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={800} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={900} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <CapabilityCardSkeleton delay={1000} />
          <CapabilityCardSkeleton delay={1080} />
          <CapabilityCardSkeleton delay={1160} />
          <CapabilityCardSkeleton delay={1240} />
          <CapabilityCardSkeleton delay={1320} />
          <CapabilityCardSkeleton delay={1400} />
        </div>
      </section>

      {/* Differentiators / Proof Section Skeleton */}
      <section className="experiments" style={{ position: "relative", overflow: "hidden", padding: "80px 0" }}>
        <div className="experiments-overlay" style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.72)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={1500} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={1600} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            <ProofCardSkeleton delay={1700} />
            <ProofCardSkeleton delay={1780} />
            <ProofCardSkeleton delay={1860} />
            <ProofCardSkeleton delay={1940} />
            <ProofCardSkeleton delay={2020} />
          </div>
        </div>
      </section>

      {/* Process Section Skeleton */}
      <section className="process" style={{ position: "relative", overflow: "hidden", padding: "80px 0" }}>
        <div className="process-overlay" style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.76)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={2100} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={2200} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Skeleton variant="circular" width={64} height={64} delay={2300 + i * 120} style={{ border: "2px solid var(--electric)", backgroundColor: "transparent", marginBottom: 16 }} />
                <Skeleton variant="text" width="80%" height="20px" delay={2300 + i * 120 + 50} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 600, border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 8 }} />
                <Skeleton variant="text" width="100%" height="14px" delay={2300 + i * 120 + 100} style={{ color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 4 }} />
                <Skeleton variant="text" width="80%" height="14px" delay={2300 + i * 120 + 150} style={{ color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teasers / See Also Section Skeleton */}
      <section style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="25%" height="12px" radius="4px" delay={2900} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", marginBottom: 16 }} />
          <Skeleton variant="heading" width="50%" height="48px" delay={3000} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, marginBottom: 48 } } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <TeaserCardSkeleton delay={3100} />
            <TeaserCardSkeleton delay={3180} />
            <TeaserCardSkeleton delay={3260} />
          </div>
        </div>
      </section>

      {/* CTA Section Skeleton */}
      <section style={{ padding: "80px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton variant="text" width="30%" height="12px" radius="4px" delay={3300} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", margin: "0 auto 16px", display: "inline-block" }} />
          <Skeleton variant="heading" width="60%" height="48px" delay={3400} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(2rem,5vw,3.5rem)", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 24px" }} />
          <Skeleton variant="text" width="70%" height="24px" delay={3500} style={{ fontSize: 18, lineHeight: 1.55, color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)", borderRadius: 4, margin: "0 auto 32px" }} />
          <Skeleton variant="button" width="auto" delay={3600} style={{ padding: "16px 28px", minHeight: 52 }} />
        </div>
      </section>
    </div>
  );
}