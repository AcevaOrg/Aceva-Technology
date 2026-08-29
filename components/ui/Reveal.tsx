"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type RevealVariant = "up" | "mask" | "blur" | "zoom";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  style?: CSSProperties;
}

const EASE = "cubic-bezier(.16,1,.3,1)";

function hiddenStyle(variant: RevealVariant): CSSProperties {
  switch (variant) {
    case "mask":
      return { opacity: 0, clipPath: "inset(100% 0 0 0)", transform: "translateY(8px)" };
    case "blur":
      return { opacity: 0, filter: "blur(6px)", transform: "translateY(14px)" };
    case "zoom":
      return { opacity: 0, transform: "scale(.96)" };
    default:
      return { opacity: 0, transform: "translateY(22px)" };
  }
}

function shownStyle(variant: RevealVariant): CSSProperties {
  if (variant === "mask") return { opacity: 1, clipPath: "inset(0% 0 0 0)", transform: "none" };
  if (variant === "blur") return { opacity: 1, filter: "blur(0px)", transform: "none" };
  return { opacity: 1, transform: "none" };
}

function transitionFor(variant: RevealVariant): string {
  const duration = variant === "mask" ? 900 : variant === "up" ? 620 : 700;
  const props = variant === "mask" ? ["clip-path", "opacity", "transform"] : variant === "blur" ? ["opacity", "filter", "transform"] : ["opacity", "transform"];
  return props.map((prop) => `${prop} ${duration}ms ${EASE}`).join(", ");
}

export default function Reveal({ children, as: Tag = "div", delay = 0, variant = "up", className, style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // Bridging to a browser API unavailable at SSR time, not derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          timer = setTimeout(() => setShown(true), delay);
          io.unobserve(el);
        });
      },
      {
        rootMargin: mobile ? "0px 0px -3% 0px" : "0px 0px -8% 0px",
        threshold: mobile ? 0.01 : 0.08,
      },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [delay]);

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...(shown ? shownStyle(variant) : hiddenStyle(variant)),
        transition: transitionFor(variant),
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
