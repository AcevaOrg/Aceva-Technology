"use client";

import Link from "next/link";
import { useCallback, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";

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
  plain: "ac-card-plain",
};

export default function Card({ children, variant = "default", href, onClick, style, className }: CardProps) {
  // Cache the reduced-motion preference once per card instance.
  const motionOk = useRef<boolean | null>(null);

  // Cursor-follow spotlight: feed the CSS radial highlight via --mx/--my vars.
  const handleMouseMove = useCallback((e: MouseEvent<HTMLElement>) => {
    if (motionOk.current === null) {
      motionOk.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    if (!motionOk.current) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  const baseStyle: CSSProperties =
    variant === "plain"
      ? { borderRadius: "var(--radius)" }
      : {};
  const cls = `${VARIANT_CLASS[variant]}${className ? ` ${className}` : ""}`.trim();
  const combinedStyle = { ...baseStyle, ...style };

  if (href) {
    return (
      <Link
        href={href}
        className={cls || undefined}
        style={{ display: "block", color: "inherit", ...combinedStyle }}
        onMouseMove={handleMouseMove}
      >
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cls || undefined}
        style={{ display: "block", width: "100%", color: "inherit", ...combinedStyle }}
        onMouseMove={handleMouseMove}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={cls || undefined} style={combinedStyle} onMouseMove={handleMouseMove}>
      {children}
    </div>
  );
}
