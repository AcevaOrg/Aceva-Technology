import type { CSSProperties, ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  variant?: "chip" | "dashed" | "outline-ice";
  style?: CSSProperties;
}

export default function Tag({ children, variant = "chip", style }: TagProps) {
  if (variant === "chip") {
    return (
      <span className="ac-chip" style={style}>
        {children}
      </span>
    );
  }
  if (variant === "outline-ice") {
    return (
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "10px",
          letterSpacing: ".14em",
          color: "var(--ice)",
          border: "1px solid rgba(127,178,255,.3)",
          borderRadius: 999,
          padding: "4px 9px",
          alignSelf: "flex-start",
          ...style,
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px dashed var(--hairline)",
        borderRadius: 6,
        fontFamily: "var(--font-jetbrains-mono)",
        fontSize: "9.5px",
        letterSpacing: ".12em",
        color: "#4b4f5b",
        padding: "8px 10px",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
