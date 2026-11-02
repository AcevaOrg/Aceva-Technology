"use client";

import { useRef, useState, type CSSProperties } from "react";
import { AUTO_STEPS } from "@/lib/data/autoSteps";
import { c } from "./cx";
import { Arrow } from "./Placard";

interface LogEntry {
  at: string;
  text: string;
  halt?: boolean;
}

const LAST = AUTO_STEPS.length - 1;
const APPROVAL = AUTO_STEPS.findIndex((s) => s.approval);

const REJECTED = {
  kicker: "STOPPED — MANUAL REVIEW",
  title: "Sent to manual review. No refund issued.",
  body: "The automation stops at the decision. A person picks the case up from here, with the full record attached.",
  detail: [
    { k: "Decided by", v: "R. Okafor · Finance" },
    { k: "Decision", v: "Send to review" },
    { k: "Refund", v: "Not issued" },
  ],
  log: "Sent to manual review by R. Okafor. Automation stopped; no refund issued.",
  at: "09:16:41",
};

const NODES = [
  { label: "Request", icon: <path d="M4 6h16v12H4zM4 7l8 6 8-6" /> },
  { label: "Lookup", icon: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></> },
  { label: "Proposal", icon: <path d="M5 12h14M13 6l6 6-6 6" /> },
  { label: "Approval", icon: null },
  { label: "Update", icon: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
];

/**
 * The refund automation from the old tabbed page, rebuilt. Every control stays mounted (no fake
 * loading skeleton), the log entry for a step appears when you enter it, and when the control you
 * pressed disappears focus moves to the step heading instead of dropping to <body>.
 */
export default function AutomationRun() {
  const [at, setAt] = useState(0);
  const [rejected, setRejected] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([{ at: AUTO_STEPS[0].at, text: AUTO_STEPS[0].log }]);
  const title = useRef<HTMLHeadingElement>(null);
  const resetBtn = useRef<HTMLButtonElement>(null);

  const step = rejected ? REJECTED : AUTO_STEPS[at];
  const detail = rejected ? REJECTED.detail : AUTO_STEPS[at].detail;
  const finished = rejected || at === LAST;
  const awaiting = !rejected && at === APPROVAL;
  const gateState = rejected ? "stopped" : at > APPROVAL ? "open" : at === APPROVAL ? "waiting" : "";

  const enter = (next: number) => {
    setAt(next);
    setLog((l) => [...l, { at: AUTO_STEPS[next].at, text: AUTO_STEPS[next].log }]);
  };

  return (
    <div className={c("auto")}>
      <div className={c("auto-h")}>
        <b>Refund request — INV-2291</b>
        <span>{rejected ? "STOPPED" : `STEP ${at + 1} / ${AUTO_STEPS.length}`}</span>
      </div>

      <div className={c("pipe", rejected && "rejected")} aria-hidden="true" style={{ "--at": rejected ? APPROVAL : at } as CSSProperties}>
        <span className={c("pipe-line")}>
          <i />
        </span>
        <span className={c("lane")}>
          <span className={c("packet")} />
        </span>
        {NODES.map((node, i) => {
          const cur = i === (rejected ? APPROVAL : at);
          const isGate = i === APPROVAL;
          return (
            <span
              key={node.label}
              className={c("node", !rejected && i < at && "done", cur && "cur", isGate && "gate", isGate && gateState)}
            >
              <span className={c("dot")}>
                {isGate ? (
                  <span className={c("gate-bar")} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {node.icon}
                  </svg>
                )}
              </span>
              <span>{node.label}</span>
            </span>
          );
        })}
        <span className={c("branch")}>
          <span>MANUAL REVIEW</span>
        </span>
      </div>

      <div className={c("auto-b")}>
        <div className={c("stepc")}>
          <p className={c("k")}>{"kicker" in step ? step.kicker : ""}</p>
          <h3 ref={title} tabIndex={-1}>
            {step.title}
          </h3>
          <p>{step.body}</p>
          <dl className={c("det")}>
            {detail.map((d) => (
              <div key={d.k}>
                <dt>{d.k}</dt>
                <dd>{d.v}</dd>
              </div>
            ))}
          </dl>

          {awaiting ? (
            <div role="group" className={c("approval")} aria-labelledby="exp-approval-q">
              <p id="exp-approval-q">The assistant will not act on its own. A human with the Finance role decides.</p>
              <div className={c("ctrl")}>
                <button
                  type="button"
                  className={c("btn", "btn-primary")}
                  onClick={() => {
                    enter(APPROVAL + 1);
                    title.current?.focus();
                  }}
                >
                  Approve refund
                </button>
                <button
                  type="button"
                  className={c("btn", "btn-reject")}
                  onClick={() => {
                    setRejected(true);
                    setLog((l) => [...l, { at: REJECTED.at, text: REJECTED.log, halt: true }]);
                    title.current?.focus();
                  }}
                >
                  Send to review
                </button>
              </div>
            </div>
          ) : null}

          <div className={c("ctrl")}>
            {!finished && !awaiting ? (
              <button
                type="button"
                className={c("btn", "btn-primary")}
                onClick={() => {
                  enter(at + 1);
                  // Moving onto the approval step swaps this button for the decision; keep focus on the heading.
                  if (at + 1 === APPROVAL || at + 1 === LAST) title.current?.focus();
                }}
              >
                {AUTO_STEPS[at].nextLabel}
                <Arrow />
              </button>
            ) : null}
            {finished ? (
              <button
                type="button"
                ref={resetBtn}
                className={c("btn", "btn-ghost")}
                onClick={() => {
                  setAt(0);
                  setRejected(false);
                  setLog([{ at: AUTO_STEPS[0].at, text: AUTO_STEPS[0].log }]);
                  title.current?.focus();
                }}
              >
                Run it again
              </button>
            ) : null}
          </div>
        </div>

        <div className={c("logp")}>
          <div className={c("logp-h")}>
            <b>Activity log</b>
            <span>EVERY STEP IS RECORDED AND ATTRIBUTABLE</span>
          </div>
          <ol className={c("log")} role="log" aria-label="Activity log">
            {log.map((entry, i) => (
              <li key={i} className={entry.halt ? c("halt") : undefined}>
                <time>{entry.at}</time>
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
