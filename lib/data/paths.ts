import type { CapabilityKey } from "./caps";

export type PathKey = "new" | "improve" | "help";

export interface PathCapability {
  key: CapabilityKey;
  num: string;
  name: string;
  why: string;
}

export interface Path {
  key: PathKey;
  label: string;
  headline: string;
  body: string;
  sprint: string;
  cta: string;
  caps: PathCapability[];
}

export const PATHS: Record<PathKey, Path> = {
  new: {
    key: "new",
    label: "STARTING SOMETHING NEW",
    headline: "Turn the idea into a scope, a prototype and a production build.",
    body: "We start by writing down what the product must do and what it must not do yet. You get a scope, a working prototype and a build plan before large money is committed.",
    sprint:
      "Proof Sprint — we solve or demonstrate one narrow part of the problem, then hand over a roadmap.",
    cta: "Scope my idea",
    caps: [
      { key: "digital", num: "01", name: "Digital Experiences", why: "The public product: site, storefront or portal." },
      { key: "software", num: "02", name: "Custom Software", why: "The system your operation actually runs on." },
      { key: "mobile", num: "03", name: "Mobile Products", why: "If the work has to happen on a phone." },
    ],
  },
  improve: {
    key: "improve",
    label: "IMPROVING AN EXISTING BUSINESS",
    headline: "Connect the work, remove repetition, and give the team visibility.",
    body: "Employees repeat the same work, information sits in different places, or customers wait too long. We map the workflow, then automate the parts that are safe to automate and keep people in control of the rest.",
    sprint:
      "Proof Sprint — one controlled automation, end to end, with human approval and activity logging.",
    cta: "Map my workflow",
    caps: [
      { key: "intelligence", num: "04", name: "Intelligence & Automation", why: "Assistants, integrations, approvals and alerts." },
      { key: "software", num: "02", name: "Custom Software", why: "Dashboards and internal systems that fit the operation." },
      { key: "digital", num: "01", name: "Digital Experiences", why: "When the customer-facing side is the bottleneck." },
    ],
  },
  help: {
    key: "help",
    label: "RESCUING AN EXISTING PRODUCT",
    headline: "First we determine what can be saved. Then we stabilize it.",
    body: "Money is already spent and the software is broken, delayed, insecure or trapped with a previous developer. We do not recommend a rebuild by reflex — we audit, list the risks, and separate what to keep from what to replace.",
    sprint:
      "Rescue Sprint — audit, risk list, save-or-replace recommendation and a 30/60/90-day recovery roadmap.",
    cta: "Request a Rescue Sprint",
    caps: [
      { key: "rescue", num: "05", name: "Product Rescue & Reliability", why: "Audit, stabilize, secure, modernize." },
      { key: "software", num: "02", name: "Custom Software", why: "Rebuilding only the parts that must be rebuilt." },
      { key: "intelligence", num: "04", name: "Intelligence & Automation", why: "Reviewing AI-generated code and workflows." },
    ],
  },
};

export const PATH_KEYS: PathKey[] = ["new", "improve", "help"];

export function isPathKey(value: string | null | undefined): value is PathKey {
  return value === "new" || value === "improve" || value === "help";
}
