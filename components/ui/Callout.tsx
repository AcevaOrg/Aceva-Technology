import type { CSSProperties, ReactNode } from "react";

interface CalloutProps {
  children: ReactNode;
  variant?: "info" | "warning" | "error" | "quote";
  style?: CSSProperties;
}

const VARIANT_COLOR: Record<NonNullable<CalloutProps["variant"]>, string> = {
  info: "var(--royal)",
  warning: "var(--warning)",
  error: "var(--error)",
  quote: "var(--royal)",
};

const VARIANT_BG: Record<NonNullable<CalloutProps["variant"]>, string> = {
  info: "rgba(30,79,217,.08)",
  warning: "rgba(224,169,59,.08)",
  error: "rgba(224,80,59,.08)",
  quote: "rgba(30,79,217,.08)",
};

export default function Callout({ children, variant = "info", style }: CalloutProps) {
  const color = VARIANT_COLOR[variant];
  const isQuote = variant === "quote";
  return (
    <p
      style={{
        fontSize: isQuote ? "clamp(19px,2.2vw,25px)" : "15.5px",
        fontFamily: isQuote ? "var(--font-space-grotesk)" : undefined,
        fontWeight: isQuote ? 500 : undefined,
        lineHeight: isQuote ? 1.32 : 1.6,
        letterSpacing: isQuote ? "-.015em" : undefined,
        color: isQuote ? "var(--ink)" : "var(--ink)",
        margin: 0,
        padding: isQuote ? "0 0 0 22px" : "16px 18px",
        borderLeft: `2px solid ${color}`,
        background: isQuote ? "transparent" : VARIANT_BG[variant],
        ...style,
      }}
    >
      {children}
    </p>
  );
}
