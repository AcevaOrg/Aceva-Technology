import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "flagship" | "ghost" | "plain";
  href?: string;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

const VARIANT_CLASS: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "ac-card",
  flagship: "ac-card-flagship",
  ghost: "ac-card-ghost",
  plain: "",
};

export default function Card({ children, variant = "default", href, onClick, style, className }: CardProps) {
  const baseStyle: CSSProperties =
    variant === "plain"
      ? { background: "var(--charcoal)", border: "1px solid var(--hairline)", borderRadius: "var(--radius)" }
      : {};
  const cls = `${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`.trim();
  const combinedStyle = { ...baseStyle, ...style };

  if (href) {
    return (
      <Link href={href} className={cls || undefined} style={{ display: "block", color: "inherit", ...combinedStyle }}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls || undefined} style={{ display: "block", width: "100%", color: "inherit", ...combinedStyle }}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls || undefined} style={combinedStyle}>
      {children}
    </div>
  );
}
