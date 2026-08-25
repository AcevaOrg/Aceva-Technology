"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Skeleton from "./Skeleton";

interface FormSkeletonProps {
  /** Number of input fields to show */
  fieldCount?: number;
  /** Whether to show a textarea */
  showTextarea?: boolean;
  /** Whether to show a select dropdown */
  showSelect?: boolean;
  /** Number of select dropdowns */
  selectCount?: number;
  /** Whether to show the Turnstile CAPTCHA placeholder */
  showTurnstile?: boolean;
  /** Whether to show the submit button */
  showSubmit?: boolean;
  /** Whether to show the form title/eyebrow */
  showTitle?: boolean;
  /** Animation delay in ms */
  delay?: number;
  /** Custom styles */
  style?: CSSProperties;
  /** Additional className */
  className?: string;
}

/**
 * FormFieldSkeleton - Individual form field skeleton (label + input)
 */
export function FormFieldSkeleton({
  delay = 0,
  showLabel = true,
  type = "input",
  style,
}: {
  delay?: number;
  showLabel?: boolean;
  type?: "input" | "select" | "textarea";
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      {showLabel && (
        <Skeleton
          variant="text"
          width="30%"
          height="13.5px"
          radius="4px"
          delay={delay}
          style={{ border: "none", backgroundColor: "var(--elevated)" }}
        />
      )}
      <Skeleton
        variant={type === "textarea" ? "rectangular" : type === "select" ? "input" : "input"}
        width="100%"
        height={type === "textarea" ? 120 : 48}
        radius={type === "textarea" ? 10 : 10}
        delay={delay + (showLabel ? 50 : 0)}
        style={{
          backgroundColor: type === "textarea" || type === "select" ? "#0F0F13" : "#0F0F13",
          border: "1px solid var(--hairline)",
          borderRadius: type === "textarea" ? 10 : 10,
          minHeight: type === "textarea" ? 120 : 48,
        }}
      />
    </div>
  );
}

/**
 * FormSkeleton - Full form skeleton matching ContactForm layout
 */
export default function FormSkeleton({
  fieldCount = 6,
  showTextarea = true,
  showSelect = true,
  selectCount = 2,
  showTurnstile = true,
  showSubmit = true,
  showTitle = true,
  delay = 0,
  style,
  className,
}: FormSkeletonProps) {
  const fields = Array.from({ length: fieldCount }).map((_, i) => {
    // First 2 fields are text inputs, next 2 are selects, next 2 are text inputs
    if (i < 2 || i >= 4) {
      return (
        <FormFieldSkeleton key={i} delay={delay + i * 80} type="input" />
      );
    }
    return (
      <FormFieldSkeleton key={i} delay={delay + i * 80} type="select" />
    );
  });

  return (
    <div
      className={className}
      style={{
        padding: "clamp(24px,3.5vw,36px)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        ...style,
      }}
    >
      {showTitle && (
        <Skeleton
          variant="text"
          width="40%"
          height="10.5px"
          radius="4px"
          delay={delay}
          style={{
            fontFamily: "var(--font-jetbrains-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            border: "none",
            backgroundColor: "var(--elevated)",
          }}
        />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
        {fields}
      </div>

      {showTextarea && (
        <FormFieldSkeleton
          delay={delay + fieldCount * 80}
          type="textarea"
          showLabel={true}
        />
      )}

      {showTurnstile && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="120px"
          radius="12px"
          delay={delay + (fieldCount + (showTextarea ? 1 : 0)) * 80}
          style={{
            backgroundColor: "rgba(20,20,24,.3)",
            border: "1px dashed var(--hairline)",
            borderRadius: 12,
          }}
        />
      )}

      {showSubmit && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 6 }}>
          <Skeleton
            variant="button"
            width="auto"
            delay={delay + (fieldCount + (showTextarea ? 1 : 0) + (showTurnstile ? 1 : 0)) * 80}
            style={{ padding: "16px 26px", minHeight: 52 }}
          />
          <Skeleton
            variant="text"
            width="30ch"
            height="13.5px"
            radius="4px"
            delay={delay + (fieldCount + (showTextarea ? 1 : 0) + (showTurnstile ? 1 : 0)) * 80 + 50}
            style={{ border: "none", backgroundColor: "var(--elevated)", color: "var(--muted)" }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * TurnstileSkeleton - Specific skeleton for the Turnstile CAPTCHA widget
 */
export function TurnstileSkeleton({ delay = 0, style }: { delay?: number; style?: CSSProperties }) {
  return (
    <Skeleton
      variant="rectangular"
      width="100%"
      height="120px"
      radius="12px"
      delay={delay}
      style={{
        backgroundColor: "rgba(20,20,24,.3)",
        border: "1px dashed var(--hairline)",
        borderRadius: 12,
        ...style,
      }}
    />
  );
}

/**
 * ContactFormSkeleton - Complete skeleton matching ContactForm exactly
 */
export function ContactFormSkeleton({ delay = 0, ...props }: Omit<FormSkeletonProps, "delay"> & { delay?: number }) {
  return (
    <FormSkeleton
      fieldCount={6}
      showTextarea={true}
      showSelect={true}
      selectCount={2}
      showTurnstile={true}
      showSubmit={true}
      showTitle={true}
      delay={delay}
      {...props}
    />
  );
}