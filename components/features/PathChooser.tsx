"use client";

import { useState } from "react";
import Link from "next/link";
import { PATHS, PATH_KEYS, type PathKey } from "@/lib/data/paths";
import { ROUTES, capabilityRoute, contactRoute } from "@/lib/nav";
import { CheckIcon, ArrowRightIcon } from "@/components/ui/icons";
import Reveal from "@/components/ui/Reveal";

const PATH_META: Record<PathKey, { badge: string; title: string; body: string }> = {
  new: {
    badge: "PATH A",
    title: "I am starting something new",
    body: "An idea that needs a scope, a prototype and a production build.",
  },
  improve: {
    badge: "PATH B",
    title: "I need to improve my business",
    body: "Repeated work, scattered information, or customers waiting too long.",
  },
  help: {
    badge: "PATH C",
    title: "I already built something, but it needs help",
    body: "Unfinished, unstable, insecure, or trapped with a previous developer.",
  },
};

function pathStyle(on: boolean) {
  return {
    bg: on ? "rgba(28,28,34,.7)" : "rgba(20,20,24,.55)",
    border: on ? "var(--electric)" : "var(--hairline)",
    dot: on ? "var(--electric)" : "var(--hairline)",
    dotBg: on ? "var(--royal)" : "transparent",
  };
}

export default function PathChooser() {
  const [selected, setSelected] = useState<PathKey | null>(null);
  const path = selected ? PATHS[selected] : null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14, marginTop: "clamp(28px,4vw,44px)" }}>
        {PATH_KEYS.map((key) => {
          const meta = PATH_META[key];
          const on = selected === key;
          const st = pathStyle(on);
          return (
            <Reveal key={key} style={{ textAlign: "left" }}>
              <button
                type="button"
                onClick={() => setSelected((s) => (s === key ? null : key))}
                aria-pressed={on}
                style={{
                  textAlign: "left",
                  width: "100%",
                  background: st.bg,
                  border: `1px solid ${st.border}`,
                  borderRadius: 14,
                  padding: 26,
                  minHeight: 170,
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  color: "var(--ink)",
                  transition: "transform 200ms cubic-bezier(.16,1,.3,1), border-color 200ms ease, background 200ms ease, box-shadow 200ms ease",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--ice)" }}>{meta.badge}</span>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${st.dot}`, display: "flex", alignItems: "center", justifyContent: "center", background: st.dotBg, transform: on ? "scale(1)" : "scale(.82)", boxShadow: on ? "0 0 0 4px rgba(59,124,255,.16), 0 0 16px rgba(59,124,255,.35)" : "none", transition: "transform 300ms cubic-bezier(.34,1.56,.64,1), box-shadow 260ms ease, background 220ms ease, border-color 220ms ease" }}>
                    <CheckIcon />
                  </span>
                </span>
                <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, lineHeight: 1.28, letterSpacing: "-.01em" }}>{meta.title}</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", marginTop: "auto" }}>{meta.body}</span>
              </button>
            </Reveal>
          );
        })}
      </div>

      {path && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid var(--hairline)",
            borderRadius: 16,
            background: "linear-gradient(180deg,rgba(20,20,24,.6),rgba(15,15,19,.5))",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            overflow: "hidden",
            animation: "acFadeUp 460ms cubic-bezier(.16,1,.3,1) both",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between", padding: "18px 26px", borderBottom: "1px solid var(--hairline)", background: "var(--elevated)", animation: "acMobileItem 420ms cubic-bezier(.16,1,.3,1) 70ms both" }}>
            <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--ice)", margin: 0 }}>YOUR PATH — {path.label}</p>
            <button type="button" onClick={() => setSelected(null)} style={{ background: "none", border: 0, color: "var(--muted)", fontSize: 13, padding: "6px 0" }}>
              Reset
            </button>
          </div>
          <div style={{ padding: "clamp(26px,4vw,40px) clamp(20px,3vw,40px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(26px,4vw,48px)" }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(23px,2.6vw,31px)", lineHeight: 1.18, letterSpacing: "-.02em", margin: 0, animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 120ms both" }}>{path.headline}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 170ms both" }}>{path.body}</p>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "26px 0 12px", animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 220ms both" }}>FIRST ENGAGEMENT</p>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "var(--ink)", margin: 0, padding: "16px 18px", borderLeft: "2px solid var(--royal)", background: "rgba(30,79,217,.08)", animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 270ms both" }}>{path.sprint}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26, animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 330ms both" }}>
                <Link href={contactRoute(path.key)} className="ac-btn-primary" style={{ padding: "14px 22px", minHeight: 48 }}>
                  {path.cta}
                  <ArrowRightIcon />
                </Link>
                <Link href={ROUTES.work} className="ac-btn-ghost" style={{ padding: "12px 20px", minHeight: 44 }}>
                  See the proof
                  <ArrowRightIcon />
                </Link>
              </div>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 14px", animation: "acBlurIn 520ms cubic-bezier(.16,1,.3,1) 150ms both" }}>CAPABILITIES THAT APPLY</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {path.caps.map((cap, i) => (
                  <Link
                    key={cap.key}
                    href={capabilityRoute(cap.key)}
                    style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", borderBottom: "1px solid var(--hairline)", padding: "16px 4px", color: "var(--ink)", animation: `acMobileItem 440ms cubic-bezier(.16,1,.3,1) ${200 + i * 45}ms both` }}
                  >
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--electric)", width: 20 }}>{cap.num}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-space-grotesk)", fontSize: 16.5, fontWeight: 500 }}>{cap.name}</span>
                      <span style={{ display: "block", fontSize: 13.5, color: "var(--muted)", marginTop: 3 }}>{cap.why}</span>
                    </span>
                    <ArrowRightIcon width={15} height={15} stroke="#9CA0AC" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
