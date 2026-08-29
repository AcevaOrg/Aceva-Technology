"use client";

import React from "react";
import styles from "./pulse.module.css";
import { PulseState } from "./types";

interface PulseMapPanelProps {
  state: PulseState;
  score: number;
}

const DEFAULT_SYSTEM_TAGS: Record<string, string[]> = {
  Hospitality: ["Digital ordering", "Kitchen workflow", "Owner command center", "Revenue intelligence"],
  "Beauty & Wellness": ["Client booking", "Service scheduling", "Team operations", "Retention system"],
  Commerce: ["Conversion experience", "Product system", "Fulfillment flow", "Commerce intelligence"],
  Construction: ["Project intake", "Field reporting", "Team coordination", "Job intelligence"],
  "Professional Services": ["Qualified intake", "Matter workflow", "Client portal", "Practice intelligence"],
  Logistics: ["Dispatch control", "Fleet visibility", "Handoff tracking", "Operations intelligence"],
  Technology: ["Product strategy", "Core experience", "Operational tooling", "Growth systems"],
  Default: ["Digital foundation", "Connected workflow", "Operational control", "Decision intelligence"],
};

export default function PulseMapPanel({ state, score }: PulseMapPanelProps) {
  const ctx = state.context;
  const industry = ctx.industry || "Default";
  const systemTags = DEFAULT_SYSTEM_TAGS[industry] || DEFAULT_SYSTEM_TAGS.Default;

  const nodeFields = [
    { label: "INTENT", value: ctx.intent },
    { label: "INDUSTRY", value: ctx.industry },
    { label: "OPERATION", value: ctx.scale || ctx.business },
    { label: "CURRENT STATE", value: ctx.current },
    { label: "FRICTION DETECTED", value: ctx.friction?.join(" / ") },
    { label: "DESIRED OUTCOME", value: ctx.goals?.join(" / ") },
  ];

  const isDirectionActive = ["direction", "contact", "confirmation"].includes(state.stage);

  return (
    <aside className={styles.mapPanel} aria-label="Live project map panel">
      <div className={styles.mapTop}>
        <span>LIVE PROJECT MAP</span>
        <b>{String(score).padStart(2, "0")}%</b>
      </div>

      <div className={styles.mapCanvas}>
        <div className={styles.mapAxis} />

        <div className={styles.coreNode}>
          <span>PULSE</span>
          <i style={{ ["--score" as string]: `${(3.6 * score).toFixed(1)}deg` }} />
          <small>UNDERSTANDING</small>
        </div>

        {nodeFields.map((node, i) => (
          <div
            key={node.label}
            className={`${styles.mapNode} ${styles[`n${i}`]} ${node.value ? styles.active : ""}`}
          >
            <span>0{i + 1} / {node.label}</span>
            <strong>{node.value || "Awaiting context"}</strong>
          </div>
        ))}

        <div className={`${styles.systemPath} ${isDirectionActive ? styles.active : ""}`}>
          <span>SYSTEM DIRECTION</span>
          <div>
            {systemTags.slice(0, 4).map((tag, i) => (
              <b key={tag}>
                <i>0{i + 1}</i>
                {tag}
              </b>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.mapBottom}>
        <span>
          {state.stage !== "intent"
            ? "CONTEXT UPDATES WITH EACH RESPONSE"
            : "DIRECTION WILL ASSEMBLE HERE"}
        </span>
        <i className={styles.scanner} aria-hidden="true" />
      </div>
    </aside>
  );
}
