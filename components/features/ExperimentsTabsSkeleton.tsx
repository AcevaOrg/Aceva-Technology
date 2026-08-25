"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton, { SkeletonCard, SkeletonGrid, SkeletonText } from "@/components/ui/Skeleton";

interface ExperimentsTabsSkeletonProps {
  /** Which panel to show skeleton for */
  activeTab?: "site" | "dash" | "mob" | "auto" | "rescue";
  /** Animation delay */
  delay?: number;
  /** Custom styles */
  style?: CSSProperties;
}

/**
 * ExperimentTabBarSkeleton - The sticky tab bar skeleton
 */
export function ExperimentTabBarSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <section
      style={{
        position: "sticky",
        top: 72,
        zIndex: 40,
        background: "rgba(10,10,12,.9)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--hairline)",
        ...style,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
        <div role="tablist" aria-label="Experiments" style={{ display: "flex", gap: 4, overflowX: "auto", padding: "12px 0" }}>
          {["01 · This website", "02 · Operations dashboard", "03 · Mobile journey", "04 · Automation with approval", "05 · Rescue Report"].map((label, i) => (
            <Skeleton
              key={i}
              variant="button"
              width="auto"
              height={44}
              delay={delay + i * 60}
              style={{
                flex: "none",
                padding: "11px 17px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                fontSize: 14,
                fontWeight: 500,
                minWidth: "fit-content",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * SitePanelSkeleton - Skeleton for "This website" panel
 */
export function SitePanelSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div key="site" style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both", ...style }}>
      <SkeletonGrid columns={3} minColumnWidth="280px" gap="14px" count={6} cardProps={{ variant: "flagship", showImage: true, delay }} />
    </div>
  );
}

/**
 * DashPanelSkeleton - Skeleton for "Operations dashboard" panel
 */
export function DashPanelSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div key="dash" style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both", ...style }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={4} delay={delay} />
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={4} delay={delay + 80} />
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay + 160} />
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay + 240} />
      </div>
    </div>
  );
}

/**
 * MobPanelSkeleton - Skeleton for "Mobile journey" panel
 */
export function MobPanelSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div key="mob" style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both", ...style }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <SkeletonCard variant="flagship" showImage={true} imageAspectRatio="9 / 16" showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay} />
        <SkeletonCard variant="flagship" showImage={true} imageAspectRatio="9 / 16" showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay + 80} />
        <SkeletonCard variant="flagship" showImage={true} imageAspectRatio="9 / 16" showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay + 160} />
      </div>
    </div>
  );
}

/**
 * AutoPanelSkeleton - Skeleton for "Automation with approval" panel
 */
export function AutoPanelSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div key="auto" style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both", ...style }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14, alignItems: "start" }}>
        <SkeletonCard variant="default" showImage={false} showHeader={true} showBody={true} showFooter={true} bodyLines={4} delay={delay} style={{ minHeight: 400 }} />
        <SkeletonCard variant="default" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={3} delay={delay + 80} style={{ minHeight: 400 }} />
      </div>
    </div>
  );
}

/**
 * RescuePanelSkeleton - Skeleton for "Rescue Report" panel
 */
export function RescuePanelSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <div key="rescue" style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both", ...style }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={5} delay={delay} />
        <SkeletonCard variant="flagship" showImage={false} showHeader={true} showBody={true} showFooter={false} bodyLines={4} delay={delay + 80} />
      </div>
    </div>
  );
}

/**
 * ExperimentsTabsSkeleton - Full skeleton for ExperimentsTabs component
 */
export default function ExperimentsTabsSkeleton({
  activeTab = "site",
  delay = 0,
  style,
}: ExperimentsTabsSkeletonProps) {
  const panelMap: Record<string, React.ReactNode> = {
    site: <SitePanelSkeleton delay={delay} />,
    dash: <DashPanelSkeleton delay={delay} />,
    mob: <MobPanelSkeleton delay={delay} />,
    auto: <AutoPanelSkeleton delay={delay} />,
    rescue: <RescuePanelSkeleton delay={delay} />,
  };

  return (
    <div style={style}>
      <ExperimentTabBarSkeleton delay={delay} />
      {panelMap[activeTab]}
    </div>
  );
}

/**
 * ExperimentsTabsSkeletonWithSwitching - Skeleton that simulates tab switching
 */
export function ExperimentsTabsSkeletonWithSwitching({
  delay = 0,
  style,
}: { delay?: number; style?: CSSProperties }) {
  return (
    <ExperimentsTabsSkeleton activeTab="site" delay={delay} style={style} />
  );
}