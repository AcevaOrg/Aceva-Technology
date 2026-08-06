import type { ReactNode } from "react";
import Reveal from "./Reveal";

interface PhoneFrameProps {
  children: ReactNode;
  width?: number;
  height?: number;
  radius?: number;
  footerLabel?: string;
  caption?: ReactNode;
  delay?: number;
}

export default function PhoneFrame({ children, width = 252, height = 480, radius = 30, footerLabel, caption, delay = 0 }: PhoneFrameProps) {
  return (
    <Reveal delay={delay} style={{ width, flex: "none" }}>
      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: radius,
          padding: 9,
          background: "rgba(20,20,24,.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            borderRadius: radius - 8,
            overflow: "hidden",
            background: "var(--void)",
            height,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px 6px",
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "9.5px",
              color: "var(--muted)",
            }}
          >
            <span>9:41</span>
            <span>▮▮▮</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 20 }}>
            {children}
          </div>
          {footerLabel && (
            <p
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "9px",
                letterSpacing: ".12em",
                color: "#4b4f5b",
                textAlign: "center",
                padding: "0 0 16px",
                margin: 0,
              }}
            >
              {footerLabel}
            </p>
          )}
        </div>
      </div>
      {caption && <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: "14px 0 0" }}>{caption}</p>}
    </Reveal>
  );
}
