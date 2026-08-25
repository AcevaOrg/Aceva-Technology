"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton, { SkeletonCard, SkeletonGrid } from "./Skeleton";

interface CardSkeletonProps {
  /** Variant matching the Card component variants */
  variant?: "default" | "flagship" | "ghost" | "plain";
  /** Height of the card */
  height?: string | number;
  /** Padding inside the card */
  padding?: string | number;
  /** Whether to show an image placeholder */
  showImage?: boolean;
  /** Aspect ratio for the image placeholder */
  imageAspectRatio?: string;
  /** Whether to show header (eyebrow + title) */
  showHeader?: boolean;
  /** Whether to show body text lines */
  showBody?: boolean;
  /** Number of body text lines */
  bodyLines?: number;
  /** Whether to show footer (button) */
  showFooter?: boolean;
  /** Animation delay in ms */
  delay?: number;
  /** Custom styles */
  style?: CSSProperties;
  /** Additional className */
  className?: string;
}

/**
 * CardSkeleton - Matches the flagship/ghost/plain card designs exactly
 */
export default function CardSkeleton({
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
}: CardSkeletonProps) {
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
      borderRadius: "var(--radius)",
      border: "1px solid rgba(59, 124, 255, 0.3)",
      backgroundColor: "linear-gradient(145deg, rgba(30, 79, 217, 0.13), rgba(106, 79, 224, 0.06) 55%, rgba(20, 20, 24, 0))",
      backdropFilter: "blur(28px) saturate(115%)",
      WebkitBackdropFilter: "blur(28px) saturate(115%)",
      boxShadow: "var(--shadow-card)",
    },
    ghost: {
      borderRadius: "var(--radius)",
      border: "1px dashed #33333c",
      backgroundColor: "rgba(20, 20, 24, 0.4)",
      backdropFilter: "blur(28px) saturate(115%)",
      WebkitBackdropFilter: "blur(28px) saturate(115%)",
      boxShadow: "var(--shadow-card)",
    },
    plain: {
      borderRadius: "var(--radius)",
      border: "1px solid var(--hairline)",
      backgroundColor: "var(--surface-card)",
      backdropFilter: "blur(28px) saturate(115%)",
      WebkitBackdropFilter: "blur(28px) saturate(115%)",
      boxShadow: "var(--shadow-card)",
    },
  };

  return (
    <SkeletonCard
      variant={variant}
      height={height}
      padding={padding}
      showImage={showImage}
      imageAspectRatio={imageAspectRatio}
      showHeader={showHeader}
      showBody={showBody}
      showFooter={showFooter}
      bodyLines={bodyLines}
      delay={delay}
      style={{
        display: "flex",
        flexDirection: "column",
        ...cardStyles[variant],
        ...style,
      }}
      className={className}
    />
  );
}

/**
 * CapabilityCardSkeleton - Specific skeleton for capability cards on services pages
 */
export function CapabilityCardSkeleton({ delay = 0, ...props }: CardSkeletonProps) {
  return (
    <CardSkeleton
      variant="flagship"
      showImage={true}
      imageAspectRatio="4 / 3"
      showHeader={true}
      showBody={true}
      showFooter={true}
      bodyLines={3}
      delay={delay}
      {...props}
    />
  );
}

/**
 * TeaserCardSkeleton - For the "See also" teaser cards on home page
 */
export function TeaserCardSkeleton({ delay = 0, ...props }: CardSkeletonProps) {
  return (
    <CardSkeleton
      variant="ghost"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={2}
      delay={delay}
      {...props}
    />
  );
}

/**
 * ProofCardSkeleton - For experiment/proof cards on home page
 */
export function ProofCardSkeleton({ delay = 0, ...props }: CardSkeletonProps) {
  return (
    <CardSkeleton
      variant="flagship"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={3}
      delay={delay}
      {...props}
    />
  );
}

/**
 * PathCardSkeleton - For path selector cards on home page
 */
export function PathCardSkeleton({ delay = 0, ...props }: CardSkeletonProps) {
  return (
    <CardSkeleton
      variant="plain"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={3}
      delay={delay}
      {...props}
    />
  );
}

/**
 * ProcessStepCardSkeleton - For process step cards
 */
export function ProcessStepCardSkeleton({ delay = 0, ...props }: CardSkeletonProps) {
  return (
    <CardSkeleton
      variant="default"
      showImage={false}
      showHeader={true}
      showBody={true}
      showFooter={false}
      bodyLines={2}
      delay={delay}
      {...props}
    />
  );
}