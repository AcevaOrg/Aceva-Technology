import type { CSSProperties, ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  tone?: "ice" | "muted";
  style?: CSSProperties;
  className?: string;
}

export default function Eyebrow({ children, tone = "ice", style, className }: EyebrowProps) {
  if (tone === "muted") {
    return (
      <p className={`ac-eyebrow${className ? ` ${className}` : ""}`} style={{ margin: 0, ...style }}>
        {children}
      </p>
    );
  }
  return (
    <p
      className={className}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: "11.5px",
        letterSpacing: ".2em",
        color: "var(--ice)",
        margin: "0 0 18px",
        ...style,
      }}
    >
      {children}
    </p>
  );
}
