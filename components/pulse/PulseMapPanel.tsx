"use client";

import React, { useState } from "react";
import styles from "./pulse.module.css";
import { PulseState } from "./types";

interface PulseMapPanelProps {
  state: PulseState;
  score: number;
}

function getSystemTagsForIndustry(industry?: string): string[] {
  const lower = (industry || "").toLowerCase();

  if (lower.includes("restaurant") || lower.includes("hospitality") || lower.includes("food")) {
    return ["Digital Ordering", "Kitchen Workflow", "Owner Command Center", "Revenue Intelligence"];
  }
  if (lower.includes("health") || lower.includes("clinic") || lower.includes("medical")) {
    return ["Patient Portal", "Telehealth Booking", "Health Records Vault", "Clinic Analytics"];
  }
  if (lower.includes("commerce") || lower.includes("retail") || lower.includes("shop") || lower.includes("store")) {
    return ["Conversion Storefront", "SKU Inventory Sync", "Fulfillment Engine", "E-Commerce Analytics"];
  }
  if (lower.includes("property") || lower.includes("real estate")) {
    return ["Property Listing Portal", "Tenant Workflow", "Automated Rent Gateway", "Portfolio Analytics"];
  }
  if (lower.includes("logistics") || lower.includes("transport") || lower.includes("fleet")) {
    return ["Dispatch Control Tower", "Driver Mobile App", "GPS Fleet Telemetry", "Logistics Analytics"];
  }
  if (lower.includes("construction") || lower.includes("contractor") || lower.includes("builder")) {
    return ["Project Intake", "Field Reporting App", "Job Coordination", "Milestone Control"];
  }
  if (lower.includes("refactoring") || lower.includes("software") || lower.includes("tech") || lower.includes("java")) {
    return ["Codebase Audit", "Migration Pipeline", "API Contract Harness", "Performance Telemetry"];
  }
  if (lower.includes("education") || lower.includes("school") || lower.includes("course")) {
    return ["Student Portal", "Course Engine", "Tuition Gateway", "Academic Analytics"];
  }
  if (lower.includes("beauty") || lower.includes("wellness") || lower.includes("salon")) {
    return ["Client Self-Booking", "Stylist Scheduler", "Automated SMS Alerts", "Salon Analytics"];
  }
  if (lower.includes("fitness") || lower.includes("gym")) {
    return ["Member Check-In App", "Trainer Scheduler", "Subscription Billing", "Gym Analytics"];
  }
  if (lower.includes("finance") || lower.includes("fintech") || lower.includes("loan")) {
    return ["KYC Onboarding", "Digital Wallet Vault", "Payment Gateway", "Risk Audit Dashboard"];
  }

  return ["Digital Foundation", "Connected Workflow", "Operational Control", "Decision Intelligence"];
}

function truncateMapValue(val?: string | string[]): string | undefined {
  if (!val) return undefined;
  const str = Array.isArray(val) ? val.join(" / ") : val;
  return str.length > 55 ? `${str.slice(0, 52)}...` : str;
}

export default function PulseMapPanel({ state, score }: PulseMapPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const ctx = state.context;
  const systemTags = getSystemTagsForIndustry(ctx.industry);

  const nodeFields = [
    { label: "INTENT", rawValue: ctx.intent, value: truncateMapValue(ctx.intent) },
    { label: "INDUSTRY", rawValue: ctx.industry, value: truncateMapValue(ctx.industry) },
    { label: "OPERATION", rawValue: ctx.scale || ctx.business, value: truncateMapValue(ctx.scale || ctx.business) },
    { label: "CURRENT STATE", rawValue: ctx.current, value: truncateMapValue(ctx.current) },
    { label: "FRICTION DETECTED", rawValue: ctx.friction, value: truncateMapValue(ctx.friction) },
    { label: "DESIRED OUTCOME", rawValue: ctx.goals, value: truncateMapValue(ctx.goals) },
  ];

  const activeNodesCount = nodeFields.filter((n) => n.value).length;
  const isDirectionActive = ["direction", "contact", "confirmation"].includes(state.stage);

  return (
    <aside className={styles.mapPanel} aria-label="Live project map panel">
      <div
        className={styles.mapTop}
        onClick={() => setMobileExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMobileExpanded((prev) => !prev);
          }
        }}
        style={{ cursor: "pointer" }}
        role="button"
        tabIndex={0}
        aria-expanded={mobileExpanded}
      >
        <span>
          LIVE PROJECT MAP <small className={styles.mobileBadge}>({activeNodesCount} MAPPED {mobileExpanded ? "▲" : "▼"})</small>
        </span>
        <b>{String(score).padStart(2, "0")}%</b>
      </div>

      {/* Collapsible Mobile Parameter Drawer */}
      <div className={`${styles.mobileDrawer} ${mobileExpanded ? styles.drawerOpen : ""}`}>
        <div className={styles.mobileDrawerGrid}>
          {nodeFields.map((node, i) => (
            <div key={node.label} className={styles.mobileDrawerCard}>
              <span>0{i + 1} / {node.label}</span>
              <strong>{node.value || "Awaiting context..."}</strong>
            </div>
          ))}
        </div>
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
            title={typeof node.rawValue === "string" ? node.rawValue : undefined}
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
