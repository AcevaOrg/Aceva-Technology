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

function truncateMapValue(val?: string): string | undefined {
  if (!val) return undefined;
  return val.length > 55 ? `${val.slice(0, 52)}...` : val;
}

/**
 * Helper to condense user input strings into clean, professional, concise Live Map stage titles.
 * Rule: Extract -> Understand -> Condense -> Display. Never invent generic defaults.
 */
function condenseText(text: string, maxLength = 50): string {
  if (!text) return "";
  let clean = text
    .trim()
    .replace(/^(i want to|we want to|we need|i need|we are|it's for my|it's a|our|we currently|right now|we have)\s+/i, "")
    .replace(/^(build|create|make|develop|start|improve|automate|sell|solve)\s+(a|an|the)?\s*/i, "")
    .trim();

  if (!clean) clean = text.trim();
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 3)}...` : clean;
}

/**
 * Evaluates the sequential stage value for the Live Project Map (01 -> 06).
 * Enforces strict sequential progression (01 -> 02 -> 03 -> 04 -> 05 -> 06) and user-derived information only.
 */
export function getSequentialNodeValue(nodeIndex: number, state: PulseState): string | null {
  const hasIntent = Boolean(state.context.intent);
  const isDirectionActive = ["direction", "contact", "confirmation"].includes(state.stage);

  // Filter out intent selection prompts from step answers
  const validDiscoveryAnswers = state.answers.filter(
    (ans) =>
      !/^(i want to start something new|i want to improve what i have|i want to automate something|i want to sell something online|i want to solve a business problem|i'm not sure yet)/i.test(
        ans.trim()
      )
  );

  // Determine maximum unlocked sequential stages based on actual valid answers provided
  const maxAllowedStageCount = isDirectionActive
    ? 6
    : Math.min(6, (hasIntent ? 1 : 0) + validDiscoveryAnswers.length);

  // If nodeIndex is beyond current sequential unlocking, strictly return null (AWAITING CONTEXT)
  if (nodeIndex >= maxAllowedStageCount) {
    return null;
  }

  const ctx = state.context;
  const answers = validDiscoveryAnswers;

  switch (nodeIndex) {
    case 0: // 01 / INTENT
      return ctx.intent ? truncateMapValue(ctx.intent) || ctx.intent : null;

    case 1: { // 02 / INDUSTRY
      if (ctx.industry && ctx.industry !== "Business Services" && ctx.industry !== "General Business") {
        if (ctx.industry.toLowerCase().includes("hospitality") || ctx.industry.toLowerCase().includes("restaurant")) {
          return "Restaurant / Food Service";
        }
        return ctx.industry;
      }
      const ans0 = answers[0] || "";
      if (/restaurant|food|cafe|dining|kitchen/i.test(ans0)) return "Restaurant / Food Service";
      if (/clinic|health|medical|doctor/i.test(ans0)) return "Healthcare & Clinics";
      if (/shop|store|e-?commerce|retail/i.test(ans0)) return "E-Commerce & Retail";
      if (/property|real estate|tenant/i.test(ans0)) return "Real Estate & Property";
      if (/logistics|fleet|delivery|transport/i.test(ans0)) return "Logistics & Transport";
      return condenseText(ans0, 45) || null;
    }

    case 2: { // 03 / OPERATION
      const ans1 = answers[1] || "";
      if (/order|food|online/i.test(ans1)) return "Online Food Ordering";
      if (ctx.scale && !ctx.scale.toLowerCase().includes("core platform")) return condenseText(ctx.scale, 45);
      return condenseText(ans1, 45) || null;
    }

    case 3: { // 04 / CURRENT STATE
      const ans2 = answers[2] || answers[1] || "";
      if (/whatsapp/i.test(ans2)) return "Orders currently handled through WhatsApp";
      if (ctx.current && !ctx.current.toLowerCase().includes("existing workflow")) return condenseText(ctx.current, 50);
      return condenseText(ans2, 50) || null;
    }

    case 4: { // 05 / FRICTION DETECTED
      const ans3 = answers[3] || answers[2] || "";
      if (/difficult|track|keep track|manage/i.test(ans3)) return "Difficult to track and manage orders";
      if (Array.isArray(ctx.friction) && ctx.friction.length > 0) {
        const fStr = ctx.friction.join(" / ");
        if (!fStr.toLowerCase().includes("manual handoffs")) return condenseText(fStr, 50);
      }
      return condenseText(ans3, 50) || null;
    }

    case 5: { // 06 / DESIRED OUTCOME
      const ans4 = answers[4] || answers[3] || "";
      if (/one system|managed|centralized|single platform/i.test(ans4)) return "Centralized order management";
      if (Array.isArray(ctx.goals) && ctx.goals.length > 0) {
        const gStr = ctx.goals.join(" / ");
        if (!gStr.toLowerCase().includes("operational clarity")) return condenseText(gStr, 50);
      }
      return condenseText(ans4, 50) || null;
    }

    default:
      return null;
  }
}

export default function PulseMapPanel({ state, score }: PulseMapPanelProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const ctx = state.context;
  const systemTags = getSystemTagsForIndustry(ctx.industry);

  const nodeLabels = [
    "INTENT",
    "INDUSTRY",
    "OPERATION",
    "CURRENT STATE",
    "FRICTION DETECTED",
    "DESIRED OUTCOME",
  ];

  const nodeFields = nodeLabels.map((label, index) => {
    const rawValue = getSequentialNodeValue(index, state);
    const displayValue = rawValue ? truncateMapValue(rawValue) : undefined;
    return {
      label,
      rawValue,
      value: displayValue,
    };
  });

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
              <strong>{node.value || "AWAITING CONTEXT"}</strong>
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
            <strong>{node.value || "AWAITING CONTEXT"}</strong>
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
