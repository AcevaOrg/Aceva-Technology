"use client";

import { useState } from "react";
import type { Faq } from "@/lib/data/faqs";
import Reveal from "@/components/ui/Reveal";

interface FaqAccordionProps {
  items: Faq[];
}

export default function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;
        return (
          <Reveal key={item.q} delay={Math.min(i, 6) * 60} style={{ borderBottom: "1px solid var(--hairline)" }}>
            <button
              type="button"
              onClick={() => setOpenIndex((s) => (s === i ? -1 : i))}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((h) => (h === i ? null : h))}
              aria-expanded={open}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 20,
                textAlign: "left",
                background: hoverIndex === i ? "rgba(255,255,255,.028)" : "none",
                border: 0,
                borderRadius: 10,
                padding: "24px 14px",
                margin: "0 -14px",
                color: hoverIndex === i ? "var(--ice)" : "var(--ink)",
                minHeight: 56,
                transition: "color 160ms ease, background 220ms ease",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: "clamp(17px,1.9vw,20px)",
                  fontWeight: 500,
                  lineHeight: 1.35,
                  letterSpacing: "-.01em",
                }}
              >
                {item.q}
              </span>
              <span
                style={{
                  flex: "none",
                  width: 26,
                  height: 26,
                  border: "1px solid var(--hairline)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 14,
                  color: "var(--ice)",
                  marginTop: 2,
                  transform: open ? "rotate(135deg)" : "none",
                  transition: "transform 340ms cubic-bezier(.34,1.56,.64,1)",
                }}
              >
                {open ? "–" : "+"}
              </span>
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateRows: open ? "1fr" : "0fr",
                transition: "grid-template-rows 460ms cubic-bezier(.16,1,.3,1)",
              }}
            >
              <div style={{ overflow: "hidden", minHeight: 0 }}>
                <p
                  style={{
                    fontSize: 16,
                    lineHeight: 1.68,
                    color: "var(--muted)",
                    margin: 0,
                    padding: "0 0 26px",
                    maxWidth: "62ch",
                  }}
                >
                  {item.a}
                </p>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
