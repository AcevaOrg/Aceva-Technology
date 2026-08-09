"use client";

import { useState, type ReactNode } from "react";
import styles from "./ExperimentsTabs.module.css";

export type ExperimentTabKey = "site" | "dash" | "mob" | "auto" | "rescue";

interface ExperimentsTabsProps {
  site: ReactNode;
  dash: ReactNode;
  mob: ReactNode;
  auto: ReactNode;
  rescue: ReactNode;
}

const TABS: { key: ExperimentTabKey; label: string }[] = [
  { key: "site", label: "01 · This website" },
  { key: "dash", label: "02 · Operations dashboard" },
  { key: "mob", label: "03 · Mobile journey" },
  { key: "auto", label: "04 · Automation with approval" },
  { key: "rescue", label: "05 · Rescue Report" },
];

function tabStyle(on: boolean) {
  return {
    background: on ? "var(--elevated)" : "transparent",
    border: on ? "var(--electric)" : "var(--hairline)",
    color: on ? "var(--ink)" : "var(--muted)",
  };
}

export default function ExperimentsTabs({ site, dash, mob, auto, rescue }: ExperimentsTabsProps) {
  const [exp, setExp] = useState<ExperimentTabKey>("site");
  const panels: Record<ExperimentTabKey, ReactNode> = { site, dash, mob, auto, rescue };

  return (
    <>
      <section
        style={{
          position: "sticky",
          top: 72,
          zIndex: 40,
          background: "rgba(10,10,12,.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px)" }}>
          <div
            role="tablist"
            aria-label="Experiments"
            style={{ display: "flex", gap: 4, overflowX: "auto", padding: "12px 0" }}
          >
            {TABS.map((t) => {
              const st = tabStyle(exp === t.key);
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={exp === t.key}
                  onClick={() => setExp(t.key)}
                  className={styles.tab}
                  style={{
                    flex: "none",
                    background: st.background,
                    border: `1px solid ${st.border}`,
                    color: st.color,
                    fontSize: 14,
                    fontWeight: 500,
                    padding: "11px 17px",
                    borderRadius: 10,
                    minHeight: 44,
                    whiteSpace: "nowrap",
                    transform: exp === t.key ? "translateY(-1px) scale(1.015)" : "none",
                    boxShadow: exp === t.key ? "0 4px 14px rgba(0,0,0,.28)" : "none",
                    transition: "background 220ms ease, border-color 220ms ease, color 220ms ease, transform 260ms cubic-bezier(.34,1.56,.64,1), box-shadow 220ms ease",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <div key={exp} style={{ animation: "acBlurIn 480ms cubic-bezier(.16,1,.3,1) both" }}>
        {panels[exp]}
      </div>
    </>
  );
}
