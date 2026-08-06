export interface AutoStepDetail {
  k: string;
  v: string;
}

export interface AutoStep {
  kicker: string;
  title: string;
  body: string;
  detail: AutoStepDetail[];
  approval?: boolean;
  done?: boolean;
  nextLabel?: string;
  log: string;
}

export const AUTO_STEPS: AutoStep[] = [
  {
    kicker: "STEP 1 — REQUEST RECEIVED",
    title: "A customer asks for a refund by email.",
    body: "The assistant reads the message, identifies the invoice number and opens a case. Nothing is changed in any system yet.",
    detail: [
      { k: "Channel", v: "support@ inbox" },
      { k: "Invoice", v: "INV-2291" },
      { k: "Stated reason", v: "Duplicate charge" },
    ],
    nextLabel: "Look up the record",
    log: "Case opened from inbound email. No system changes.",
  },
  {
    kicker: "STEP 2 — DATA LOOKUP",
    title: "It checks the record instead of guessing.",
    body: "Billing, order history and the payment provider are read together. The duplicate charge is confirmed against the provider, not just the customer’s description.",
    detail: [
      { k: "Charged", v: "$248.00 × 2" },
      { k: "Provider status", v: "Both captured" },
      { k: "Customer since", v: "2023" },
    ],
    nextLabel: "Propose an action",
    log: "Billing, orders and payment provider read. Duplicate confirmed.",
  },
  {
    kicker: "STEP 3 — PROPOSED ACTION",
    title: "Refund $248.00 to the original card.",
    body: "The proposal states exactly what will change, in which system, and what the customer will see. It is a recommendation — not an action.",
    detail: [
      { k: "Action", v: "Refund one charge" },
      { k: "Amount", v: "$248.00" },
      { k: "Systems touched", v: "Payments, CRM" },
    ],
    approval: true,
    log: "Action proposed: refund $248.00. Awaiting human approval.",
  },
  {
    kicker: "STEP 4 — HUMAN APPROVAL",
    title: "Approved by a named person with the Finance role.",
    body: "The decision, the person and the timestamp are written to the log before anything executes. Anyone can reconstruct what happened and why.",
    detail: [
      { k: "Approved by", v: "R. Okafor · Finance" },
      { k: "Decision", v: "Approve refund" },
      { k: "Policy check", v: "Within limit" },
    ],
    nextLabel: "Update the systems",
    log: "Approved by R. Okafor (Finance). Decision recorded.",
  },
  {
    kicker: "STEP 5 — SYSTEM UPDATE",
    title: "Refund issued, records updated, customer told.",
    body: "The refund is executed, the CRM note is written, the case is closed and the customer receives a plain-language reply. The log holds the full trail.",
    detail: [
      { k: "Refund", v: "Issued · 4s" },
      { k: "CRM", v: "Note written, case closed" },
      { k: "Customer", v: "Reply sent" },
    ],
    done: true,
    log: "Refund issued. CRM updated. Customer notified. Case closed.",
  },
];
