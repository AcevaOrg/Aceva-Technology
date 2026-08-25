"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const EASE = "cubic-bezier(.16,1,.3,1)";
const SHIMMER_DURATION = 1500;

interface SkeletonProps {
  /** Variant determines the shape and size of the skeleton */
  variant?: "text" | "heading" | "circular" | "rectangular" | "card" | "avatar" | "button" | "input" | "tag" | "kpi" | "divider";
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Border radius (CSS value) */
  radius?: string | number;
  /** Additional CSS styles */
  style?: CSSProperties;
  /** Additional className */
  className?: string;
  /** For text variant: number of lines to show */
  lines?: number;
  /** For text variant: width of last line as percentage */
  lastLineWidth?: string;
  /** Animation delay in ms */
  delay?: number;
  /** Whether to show the shimmer animation */
  animated?: boolean;
  /** Custom children (for complex skeletons) */
  children?: ReactNode;
}

/**
 * Base Skeleton component with shimmer animation.
 * Respects prefers-reduced-motion and matches the site's design system colors.
 */
export default function Skeleton({
  variant = "rectangular",
  width,
  height,
  radius,
  style,
  className,
  lines = 1,
  lastLineWidth = "60%",
  delay = 0,
  animated = true,
  children,
}: SkeletonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inView, setInView] = useState(false);

  // Detect reduced motion preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Optional: trigger animation on intersection (for performance)
  useEffect(() => {
    const el = ref.current;
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

  const shouldAnimate = animated && inView && !reduceMotion;

  // Base styles using CSS variables from globals.css
  const baseStyle: CSSProperties = {
    // Layout
    width: width ?? "100%",
    height: height ?? "auto",
    minHeight: height ? undefined : "1em",
    overflow: "hidden",
    position: "relative",
    ...style,
    // Design system colors (set after style to avoid shorthand conflicts)
    backgroundColor: "var(--elevated)",
    border: "1px solid var(--hairline)",
    borderRadius: radius ?? "var(--radius)",
    // Shimmer animation (set after style to avoid shorthand conflicts)
    backgroundImage: shouldAnimate
      ? `linear-gradient(90deg, var(--elevated) 25%, rgba(59,124,255,.12) 50%, var(--elevated) 75%)`
      : "none",
    backgroundSize: shouldAnimate ? "200% 100%" : "auto",
    backgroundPosition: shouldAnimate ? "200% 0" : "0 0",
    animation: shouldAnimate ? `acShimmer ${SHIMMER_DURATION}ms ${EASE} ${delay}ms infinite` : "none",
  };

  // Define the shimmer keyframes via inline style (since we can't use CSS @keyframes in inline styles)
  // We'll use a CSS custom property approach
  if (shouldAnimate) {
    baseStyle.animationName = "acShimmer";
  }

  // Variant-specific overrides
  const variantStyles: Record<string, CSSProperties> = {
    text: {
      height: "1.125rem", // ~18px
      borderRadius: "4px",
      border: "none",
      backgroundColor: "var(--elevated)",
      minHeight: "1.125rem",
    },
    heading: {
      height: "2.5rem", // ~40px
      borderRadius: "4px",
      border: "none",
      backgroundColor: "var(--elevated)",
      minHeight: "2.5rem",
    },
    circular: {
      borderRadius: "50%",
      aspectRatio: "1 / 1",
    },
    avatar: {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      border: "1px solid var(--hairline)",
    },
    button: {
      height: "48px",
      borderRadius: "11px",
      minWidth: "120px",
      border: "1px solid var(--hairline)",
    },
    input: {
      height: "48px",
      borderRadius: "10px",
      border: "1px solid var(--hairline)",
      backgroundColor: "#0F0F13",
    },
    tag: {
      height: "28px",
      borderRadius: "999px",
      padding: "0 12px",
      border: "1px solid var(--hairline)",
      display: "inline-flex",
      alignItems: "center",
    },
    card: {
      borderRadius: "16px",
      border: "1px solid var(--hairline)",
      backgroundColor: "rgba(20,20,24,.55)",
      padding: "24px",
      minHeight: "200px",
    },
    kpi: {
      border: "none",
      backgroundColor: "transparent",
      padding: 0,
      minHeight: "auto",
    },
    divider: {
      height: "1px",
      border: "none",
      borderTop: "1px solid var(--hairline)",
      backgroundColor: "transparent",
      width: "100%",
    },
    rectangular: {},
  };

  const mergedStyle = { ...baseStyle, ...variantStyles[variant], ...style };

  // For multi-line text variant
  if (variant === "text" && lines > 1 && !children) {
    const lineElements: ReactNode[] = [];
    for (let i = 0; i < lines; i++) {
      const isLast = i === lines - 1;
      lineElements.push(
        <div
          key={i}
          ref={i === 0 ? ref : undefined}
          style={{
            ...mergedStyle,
            width: isLast ? lastLineWidth : "100%",
            marginTop: i > 0 ? "0.625rem" : 0, // 10px
            animationDelay: shouldAnimate ? `${delay + i * 100}ms` : undefined,
          }}
        />
      );
    }
    return <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>{lineElements}</div>;
  }

  return (
    <div ref={ref} className={className} style={mergedStyle}>
      {children}
    </div>
  );
}

/**
 * SkeletonText - Convenience component for multi-line text blocks
 */
export function SkeletonText({
  lines = 3,
  width = "100%",
  lastLineWidth = "60%",
  lineHeight = 1.6,
  spacing = "0.625rem",
  ...props
}: Omit<SkeletonProps, "variant" | "lines" | "lastLineWidth"> & { lines?: number; lastLineWidth?: string; lineHeight?: number; spacing?: string }) {
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

  const lineStyle: CSSProperties = {
    height: "1.125rem",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "var(--elevated)",
    backgroundImage: shouldAnimate
      ? `linear-gradient(90deg, var(--elevated) 25%, rgba(59,124,255,.12) 50%, var(--elevated) 75%)`
      : "none",
    backgroundSize: shouldAnimate ? "200% 100%" : "auto",
    backgroundPosition: shouldAnimate ? "200% 0" : "0 0",
    animation: shouldAnimate ? `acShimmer ${SHIMMER_DURATION}ms ${EASE} infinite` : "none",
    lineHeight: 0, // We control height directly
  };

  return (
    <div ref={containerRef} style={{ width, display: "flex", flexDirection: "column", gap: spacing, ...props.style }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...lineStyle,
            width: i === lines - 1 ? lastLineWidth : "100%",
            animationDelay: shouldAnimate ? `${i * 100}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * SkeletonCard - Pre-built card skeleton matching the flagship card design
 */
interface SkeletonCardProps {
  variant?: "default" | "flagship" | "ghost" | "plain";
  height?: string | number;
  padding?: string | number;
  showImage?: boolean;
  imageAspectRatio?: string;
  showHeader?: boolean;
  showBody?: boolean;
  showFooter?: boolean;
  bodyLines?: number;
  delay?: number;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

export function SkeletonCard({
  variant = "flagship",
  height,
  padding = 24,
  showImage = false,
  imageAspectRatio = "16 / 9",
  showHeader = true,
  showBody = true,
  showFooter = true,
  bodyLines = 3,
  delay = 0,
  style,
  className,
  children,
}: SkeletonCardProps) {
  const cardStyles: Record<string, CSSProperties> = {
    default: {
      borderRadius: "var(--radius)",
      border: "1px solid var(--hairline)",
      backgroundColor: "var(--surface-card)",
      backdropFilter: "blur(28px) saturate(115%)",
      WebkitBackdropFilter: "blur(28px) saturate(115%)",
      boxShadow: "var(--shadow-card)",
    },
    flagship: {
      borderRadius: "16px",
      border: "1px solid var(--hairline)",
      backgroundColor: "rgba(20,20,24,.55)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    },
    ghost: {
      borderRadius: "16px",
      border: "1px dashed var(--hairline)",
      backgroundColor: "transparent",
    },
    plain: {
      borderRadius: "var(--radius)",
      border: "none",
      backgroundColor: "transparent",
    },
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding,
        minHeight: height,
        ...cardStyles[variant],
        ...style,
      }}
    >
      {showImage && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height={0}
          style={{
            aspectRatio: imageAspectRatio,
            borderRadius: "12px",
            marginBottom: 8,
          }}
        />
      )}
      {showHeader && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton variant="text" width="30%" height="14px" radius="4px" delay={delay} />
          <Skeleton variant="heading" width="60%" delay={delay + 100} />
        </div>
      )}
      {showBody && (
        <SkeletonText lines={bodyLines} lastLineWidth="70%" delay={delay + 200} />
      )}
      {showFooter && (
        <Skeleton variant="button" width="auto" delay={delay + 300} />
      )}
      {children}
    </div>
  );
}

/**
 * SkeletonGrid - Grid of skeleton cards
 */
interface SkeletonGridProps {
  columns?: number;
  minColumnWidth?: string;
  gap?: string;
  count?: number;
  cardProps?: SkeletonCardProps;
  style?: CSSProperties;
}

export function SkeletonGrid({
  columns = 3,
  minColumnWidth = "280px",
  gap = "14px",
  count = 6,
  cardProps,
  style,
}: SkeletonGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`,
        gap,
        ...style,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} delay={i * 80} {...cardProps} />
      ))}
    </div>
  );
}

/**
 * SkeletonList - Vertical list of skeleton items
 */
interface SkeletonListProps {
  count?: number;
  itemHeight?: string | number;
  gap?: string;
  showAvatar?: boolean;
  showMeta?: boolean;
  bodyLines?: number;
  style?: CSSProperties;
}

export function SkeletonList({
  count = 5,
  itemHeight,
  gap = "16px",
  showAvatar = false,
  showMeta = false,
  bodyLines = 2,
  style,
}: SkeletonListProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            padding: "16px 0",
            borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
          }}
        >
          {showAvatar && <Skeleton variant="avatar" delay={i * 80} />}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {showMeta && <Skeleton variant="text" width="25%" height="12px" delay={i * 80} />}
            <Skeleton variant="heading" width="40%" delay={i * 80 + 50} />
            <SkeletonText lines={bodyLines} lastLineWidth="80%" delay={i * 80 + 100} />
          </div>
        </div>
      ))}
    </div>
  );
}