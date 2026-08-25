"use client";

import { useState, useEffect, useRef } from "react";
import { AUTO_STEPS } from "@/lib/data/autoSteps";
import Reveal from "@/components/ui/Reveal";
import { ArrowRightIcon } from "@/components/ui/icons";
import styles from "./AutomationDemo.module.css";
import AutomationDemoSkeleton from "./AutomationDemoSkeleton";

interface LogLine {
  t: string;
  m: string;
}

interface AutoState {
  step: number;
  log: LogLine[];
  rejected: boolean;
}

function stamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const INITIAL_STATE: AutoState = { step: 0, log: [], rejected: false };

export default function AutomationDemo() {
  const [state, setState] = useState<AutoState>(INITIAL_STATE);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevStepRef = useRef(0);

  const step = AUTO_STEPS[state.step];
  const last = state.step === AUTO_STEPS.length - 1;
  const stepLabel = `${state.step + 1} / ${AUTO_STEPS.length}`;
  const needsApproval = !!step.approval && !state.rejected;
  const showNext = !step.approval && !last && !state.rejected;
  const done = last || state.rejected;
  const logEmpty = state.log.length === 0;

  // Show skeleton during step transitions
  useEffect(() => {
    if (state.step !== prevStepRef.current) {
      setIsTransitioning(true);
      prevStepRef.current = state.step;
      const timer = setTimeout(() => setIsTransitioning(false), 400);
      return () => clearTimeout(timer);
    }
  }, [state.step]);

  if (isTransitioning) {
    return <AutomationDemoSkeleton step={state.step} />;
  }

  function advance() {
    setState((s) => {
      const next = Math.min(s.step + 1, AUTO_STEPS.length - 1);
      const lines: LogLine[] = [{ t: stamp(), m: AUTO_STEPS[s.step].log }];
      if (next === AUTO_STEPS.length - 1) {
        lines.push({ t: stamp(), m: AUTO_STEPS[next].log });
      }
      return { step: next, log: s.log.concat(lines), rejected: false };
    });
  }

  function reject() {
    setState((s) => ({
      step: s.step,
      rejected: true,
      log: s.log.concat([
        { t: stamp(), m: "Sent to manual review by R. Okafor. Automation stopped; no refund issued." },
      ]),
    }));
  }

  function reset() {
    setState(INITIAL_STATE);
  }

  return (
    <Reveal
      style={{
        marginTop: "clamp(28px,4vw,44px)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
        gap: 14,
        alignItems: "start",
      }}
    >
      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: 16,
          background: "rgba(20,20,24,.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, margin: 0 }}>
            Refund request — INV-2291
          </p>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              color: "var(--ice)",
            }}
          >
            STEP {stepLabel}
          </span>
        </div>
        <div style={{ padding: 20 }}>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              color: "var(--muted)",
              margin: "0 0 12px",
            }}
          >
            {step.kicker}
          </p>
          <p
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.3,
              letterSpacing: "-.01em",
              margin: 0,
            }}
          >
            {step.title}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.62, color: "var(--muted)", margin: "12px 0 0" }}>{step.body}</p>

          <div style={{ marginTop: 18, border: "1px solid var(--hairline)", borderRadius: 10, overflow: "hidden" }}>
            {step.detail.map((row) => (
              <div
                key={row.k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "12px 14px",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{row.k}</span>
                <span style={{ fontSize: 13.5, textAlign: "right" }}>{row.v}</span>
              </div>
            ))}
          </div>

          {needsApproval && (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                border: "1px solid rgba(59,124,255,.35)",
                borderRadius: 12,
                background: "rgba(30,79,217,.09)",
              }}
            >
              <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: "0 0 14px", color: "var(--ink)" }}>
                The assistant will not act on its own. A human with the Finance role decides.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={advance}
                  className={styles.approveBtn}
                  style={{
                    background: "var(--royal)",
                    border: 0,
                    color: "#fff",
                    fontSize: 14.5,
                    fontWeight: 600,
                    padding: "13px 20px",
                    borderRadius: 10,
                    minHeight: 46,
                  }}
                >
                  Approve refund
                </button>
                <button
                  type="button"
                  onClick={reject}
                  className={styles.rejectBtn}
                  style={{
                    background: "none",
                    border: "1px solid var(--hairline)",
                    color: "var(--ink)",
                    fontSize: 14.5,
                    fontWeight: 500,
                    padding: "13px 20px",
                    borderRadius: 10,
                    minHeight: 46,
                  }}
                >
                  Send to review
                </button>
              </div>
            </div>
          )}

          {showNext && (
            <button
              type="button"
              onClick={advance}
              className={styles.nextBtn}
              style={{
                marginTop: 20,
                background: "none",
                border: "1px solid var(--hairline)",
                color: "var(--ink)",
                fontSize: 14.5,
                fontWeight: 500,
                padding: "13px 20px",
                borderRadius: 10,
                minHeight: 46,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {step.nextLabel}
              <ArrowRightIcon />
            </button>
          )}

          {done && (
            <button
              type="button"
              onClick={reset}
              className={styles.resetBtn}
              style={{
                marginTop: 20,
                background: "none",
                border: "1px solid var(--hairline)",
                color: "var(--muted)",
                fontSize: 14,
                padding: "12px 18px",
                borderRadius: 10,
                minHeight: 44,
              }}
            >
              Run it again
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--hairline)",
          borderRadius: 16,
          background: "rgba(15,15,19,.5)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--hairline)" }}>
          <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, margin: 0 }}>
            Activity log
          </p>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              color: "#4b4f5b",
              margin: "6px 0 0",
            }}
          >
            EVERY STEP IS RECORDED AND ATTRIBUTABLE
          </p>
        </div>
        <div style={{ padding: "8px 20px 20px" }}>
          {state.log.map((line, i) => (
            <div
              key={i}
              style={{ display: "flex", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--hairline)" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  color: "#4b4f5b",
                  flex: "none",
                  paddingTop: 2,
                }}
              >
                {line.t}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.5 }}>{line.m}</span>
            </div>
          ))}
          {logEmpty && (
            <p style={{ fontSize: 14, color: "#4b4f5b", margin: "16px 0" }}>
              No activity yet. Advance the automation to populate the log.
            </p>
          )}
        </div>
      </div>
    </Reveal>
  );
}
