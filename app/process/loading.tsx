"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import Skeleton, { SkeletonText, SkeletonCard } from "@/components/ui/Skeleton";

/**
 * Process page loading skeleton
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
        <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.76)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)", textAlign: "center" }}>
          <Skeleton
            variant="text"
            width="30%"
            height="12px"
            radius="4px"
            delay={0}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              margin: "0 auto 24px",
              display: "inline-block",
            }}
          />
          <Skeleton
            variant="heading"
            width="80%"
            height="clamp(56px,12vw,120px)"
            delay={100}
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "clamp(2.25rem,11vw,3.55rem)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.045em",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              margin: "0 auto 24px",
            }}
          />
          <Skeleton
            variant="text"
            width="60%"
            height="24px"
            delay={200}
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              margin: "0 auto",
            }}
          />
        </div>
      </section>

      {/* Process Steps */}
      <section className="process" style={{ position: "relative", overflow: "hidden", padding: "80px 0" }}>
        <div className="process-overlay" style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.76)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton
            variant="text"
            width="25%"
            height="12px"
            radius="4px"
            delay={300}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              marginBottom: 16,
            }}
          />
          <Skeleton
            variant="heading"
            width="50%"
            height="48px"
            delay={400}
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              marginBottom: 48,
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Skeleton
                  variant="circular"
                  width={64}
                  height={64}
                  delay={500 + i * 100}
                  style={{
                    border: "2px solid var(--electric)",
                    backgroundColor: "transparent",
                    marginBottom: 16,
                  }}
                />
                <Skeleton
                  variant="text"
                  width="80%"
                  height="20px"
                  delay={500 + i * 100 + 50}
                  style={{
                    fontFamily: "var(--font-space-grotesk)",
                    fontSize: 18,
                    fontWeight: 600,
                    border: "none",
                    backgroundColor: "var(--elevated)",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <Skeleton
                  variant="text"
                  width="100%"
                  height="14px"
                  delay={500 + i * 100 + 100}
                  style={{
                    color: "var(--muted)",
                    border: "none",
                    backgroundColor: "var(--elevated)",
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                />
                <Skeleton
                  variant="text"
                  width="80%"
                  height="14px"
                  delay={500 + i * 100 + 150}
                  style={{
                    color: "var(--muted)",
                    border: "none",
                    backgroundColor: "var(--elevated)",
                    borderRadius: 4,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules / Principles Section */}
      <section style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton
            variant="text"
            width="25%"
            height="12px"
            radius="4px"
            delay={1100}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              marginBottom: 16,
            }}
          />
          <Skeleton
            variant="heading"
            width="50%"
            height="48px"
            delay={1200}
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              marginBottom: 32,
            }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard
                key={i}
                variant="flagship"
                showImage={false}
                showHeader={true}
                showBody={true}
                showFooter={false}
                bodyLines={3}
                delay={1300 + i * 60}
                style={{ minHeight: 200 }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: "80px 0", textAlign: "center" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <Skeleton
            variant="text"
            width="30%"
            height="12px"
            radius="4px"
            delay={1800}
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              margin: "0 auto 16px",
              display: "inline-block",
            }}
          />
          <Skeleton
            variant="heading"
            width="60%"
            height="48px"
            delay={1900}
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: "clamp(2rem,5vw,3.5rem)",
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: "-0.035em",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              margin: "0 auto 24px",
            }}
          />
          <Skeleton
            variant="text"
            width="70%"
            height="24px"
            delay={2000}
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--muted)",
              border: "none",
              backgroundColor: "var(--elevated)",
              borderRadius: 4,
              margin: "0 auto 32px",
            }}
          />
          <Skeleton variant="button" width="auto" delay={2100} style={{ padding: "16px 28px", minHeight: 52 }} />
        </div>
      </section>
    </div>
  );
}