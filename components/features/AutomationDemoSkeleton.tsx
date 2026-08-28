"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton, { SkeletonCard, SkeletonText } from "@/components/ui/Skeleton";

interface AutomationDemoSkeletonProps {
  /** Which step to show skeleton for (0-4) */
  step?: number;
  /** Animation delay */
  delay?: number;
  /** Custom styles */
  style?: CSSProperties;
}

/**
 * AutomationDemoPanelSkeleton - Left panel skeleton (step detail)
 */
export function AutomationDemoPanelSkeleton({
  delay = 0,
  showDetail = true,
  showActions = true,
  style,
}: { delay?: number; showDetail?: boolean; showActions?: boolean; style?: CSSProperties }) {
  return (
    <SkeletonCard
      variant="default"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={2}
      delay={delay}
      height={400}
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 16,
        background: "rgba(20,20,24,.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
        {/* Header area */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 16, borderBottom: "1px solid var(--hairline)" }}>
          <Skeleton variant="text" width="40%" height="15px" radius="4px" delay={delay} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500 }} />
          <Skeleton variant="text" width="80px" height="10px" radius="4px" delay={delay} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--ice)" }} />
        </div>

        {/* Kicker */}
        <Skeleton variant="text" width="35%" height="10px" radius="4px" delay={delay + 100} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)" }} />

        {/* Title */}
        <Skeleton
          variant="heading"
          width="60%"
          height="28px"
          delay={delay + 150}
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
            border: "none",
            backgroundColor: "var(--elevated)",
            borderRadius: 4,
          }}
        />

        {/* Body text */}
        <SkeletonText lines={3} lastLineWidth="70%" delay={delay + 200} style={{ fontSize: 15, lineHeight: 1.62, color: "var(--muted)" }} />

        {/* Detail table */}
        {showDetail && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height={0}
            style={{
              aspectRatio: "1",
              minHeight: 160,
              border: "1px solid var(--hairline)",
              borderRadius: 10,
              overflow: "hidden",
              marginTop: 8,
            }}
            delay={delay + 300}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  variant="rectangular"
                  width="100%"
                  height="40px"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "12px 14px",
                    borderBottom: i < 4 ? "1px solid var(--hairline)" : "none",
                    backgroundColor: "transparent",
                    border: "none",
                  }}
                  delay={delay + 300 + i * 30}
                >
                  <Skeleton variant="text" width="30%" height="13.5px" radius="4px" delay={delay + 300 + i * 30} style={{ color: "var(--muted)", border: "none", backgroundColor: "var(--elevated)" }} />
                  <Skeleton variant="text" width="40%" height="13.5px" radius="4px" delay={delay + 300 + i * 30} style={{ textAlign: "right", border: "none", backgroundColor: "var(--elevated)" }} />
                </Skeleton>
              ))}
            </div>
          </Skeleton>
        )}

        {/* Approval actions */}
        {showActions && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100px"
            radius="12px"
            delay={delay + 450}
            style={{
              border: "1px solid rgba(59,124,255,.35)",
              borderRadius: 12,
              background: "rgba(30,79,217,.09)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <SkeletonText lines={2} lastLineWidth="80%" delay={delay + 450} style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink)" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <Skeleton variant="button" width="auto" delay={delay + 500} style={{ background: "var(--royal)", border: "none", color: "#fff", minHeight: 46, padding: "13px 20px", borderRadius: 10 }} />
              <Skeleton variant="button" width="auto" delay={delay + 520} style={{ background: "none", border: "1px solid var(--hairline)", color: "var(--ink)", minHeight: 46, padding: "13px 20px", borderRadius: 10 }} />
            </div>
          </Skeleton>
        )}

        {/* Next/Reset button */}
        <Skeleton
          variant="button"
          width="auto"
          delay={delay + 600}
          style={{
            background: "none",
            border: "1px solid var(--hairline)",
            color: "var(--ink)",
            minHeight: 46,
            padding: "13px 20px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        />
      </div>
    </SkeletonCard>
  );
}

/**
 * AutomationDemoLogSkeleton - Right panel skeleton (activity log)
 */
export function AutomationDemoLogSkeleton({
  delay = 0,
  logLines = 5,
  style,
}: { delay?: number; logLines?: number; style?: CSSProperties }) {
  return (
    <SkeletonCard
      variant="default"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={0}
      delay={delay}
      height={400}
      style={{
        border: "1px solid var(--hairline)",
        borderRadius: 16,
        background: "rgba(15,15,19,.5)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <Skeleton variant="text" width="30%" height="15px" radius="4px" delay={delay} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500 }} />
          <Skeleton variant="text" width="60%" height="10px" radius="4px" delay={delay + 50} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: "0.12em", color: "#4b4f5b", marginTop: 6, border: "none", backgroundColor: "var(--elevated)" }} />
        </div>

        {/* Log entries */}
        <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          {Array.from({ length: logLines }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width="100%"
              height="40px"
              style={{
                display: "flex",
                gap: 14,
                padding: "13px 0",
                borderBottom: i < logLines - 1 ? "1px solid var(--hairline)" : "none",
                backgroundColor: "transparent",
                border: "none",
              }}
              delay={delay + 100 + i * 60}
            >
              <Skeleton variant="text" width="50px" height="11px" radius="4px" delay={delay + 100 + i * 60} style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "#4b4f5b", flex: "none", paddingTop: 2, border: "none", backgroundColor: "var(--elevated)" }} />
              <Skeleton variant="text" width="70%" height="14px" radius="4px" delay={delay + 100 + i * 60} style={{ border: "none", backgroundColor: "var(--elevated)" }} />
            </Skeleton>
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}

/**
 * AutomationDemoSkeleton - Full skeleton for AutomationDemo component
 */
export default function AutomationDemoSkeleton({
  step = 2,
  delay = 0,
  style,
}: AutomationDemoSkeletonProps) {
  const showApproval = step === 2; // Step 2 (index 2) has approval
  const showNext = step < 3 && !showApproval; // Show next button for non-approval, non-last steps
  const done = step >= 4;

  return (
    <div
      style={{
        marginTop: "clamp(28px,4vw,44px)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
        gap: 14,
        alignItems: "start",
        ...style,
      }}
    >
      <AutomationDemoPanelSkeleton
        delay={delay}
        showDetail={true}
        showActions={showApproval || showNext || done}
      />
      <AutomationDemoLogSkeleton delay={delay} logLines={step + 1} />
    </div>
  );
}