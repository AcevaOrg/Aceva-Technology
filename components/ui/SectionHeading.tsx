import type { ReactNode } from "react";
import Eyebrow from "./Eyebrow";
import Reveal from "./Reveal";

interface SectionHeadingProps {
  eyebrow: ReactNode;
  title: ReactNode;
  titleMaxWidth?: string;
  /** Right-hand content next to the title on wide screens: a short blurb or an action button. */
  side?: ReactNode;
  /** Full-width paragraph under the title, for single-column intros. */
  intro?: ReactNode;
  reveal?: boolean;
}

export default function SectionHeading({ eyebrow, title, titleMaxWidth, side, intro, reveal = true }: SectionHeadingProps) {
  const Wrap = reveal ? Reveal : "div";
  return (
    <Wrap style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(28px,3.6vw,42px)",
            lineHeight: 1.1,
            letterSpacing: "-.025em",
            margin: 0,
            maxWidth: titleMaxWidth,
          }}
        >
          {title}
        </h2>
        {intro && (
          <p style={{ fontSize: "16.5px", lineHeight: 1.65, color: "var(--muted)", margin: "22px 0 0", maxWidth: "46ch" }}>
            {intro}
          </p>
        )}
      </div>
      {side}
    </Wrap>
  );
}
