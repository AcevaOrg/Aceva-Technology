import { CAPS, type CapabilityKey } from "@/lib/data/caps";
import { PATHS, PATH_KEYS } from "@/lib/data/paths";
import type { Review } from "@/components/features/ReviewCard";
import reviewsData from "@/data/reviews.json";
import { FINDINGS, ROADMAP, VERDICTS } from "@/lib/data/experiments";
import { PROCESS_COMMITMENTS, PROCESS_PHASES } from "@/lib/data/process";

/**
 * Homepage copy. Every line here is either existing Aceva copy (capabilities, paths,
 * process, experiments, limits) or the new hero wording. No statistics, client names
 * or results are introduced — the demo reviews are labelled as demo where rendered.
 */

export const HERO = {
  kicker: "ACEVA HOLDINGS / SOFTWARE DIVISION",
  lines: [
    { verb: "Build", rest: "what’s next." },
    { verb: "Improve", rest: "what runs." },
    { verb: "Rescue", rest: "what’s stuck." },
  ],
  lede:
    "Aceva Technology designs and engineers websites, custom software, mobile apps and AI automation for growing businesses — and rescues software that other teams could not finish. Senior-reviewed, proven every week, and owned by you.",
} as const;

/** Short one-liners per capability (previously inline in OfferTabs). */
export const CAP_SHORT: Record<CapabilityKey, string> = {
  digital: "Premium websites, e-commerce, portals and customer-facing platforms.",
  software: "SaaS products, dashboards, marketplaces and internal business systems.",
  mobile: "iOS, Android and cross-platform applications for customers and teams.",
  intelligence: "AI assistants, workflow automation, integrations, knowledge systems and reporting.",
  rescue: "Audit, stabilize, secure and modernize unfinished, outdated or AI-generated software.",
};

export const CAPABILITIES = CAPS.map((cap) => ({
  key: cap.key,
  num: cap.num,
  name: cap.name,
  short: CAP_SHORT[cap.key],
  includes: cap.includes.map((item) => item.replace(/\.$/, "")),
  limit: cap.limit,
  flagship: cap.key === "rescue",
}));

export type HomeCapability = (typeof CAPABILITIES)[number];

/** The sentences visitors already recognise from the current homepage. */
const PATH_SENTENCES = {
  new: "I am starting something new",
  improve: "I need to improve my business",
  help: "I already built something, but it needs help",
} as const;

export const HOME_PATHS = PATH_KEYS.map((key, index) => {
  const path = PATHS[key];
  const [sprintName, sprintBody] = path.sprint.split(" — ");
  return {
    key,
    letter: String.fromCharCode(65 + index),
    sentence: PATH_SENTENCES[key],
    headline: path.headline,
    body: path.body,
    sprintName,
    sprintBody,
    cta: path.cta,
    caps: path.caps,
  };
});

const rescue = CAPS.find((cap) => cap.key === "rescue")!;

export const RESCUE = {
  sales: rescue.sales,
  sprintTitle: rescue.engagement?.title ?? "Rescue Sprint",
  sprintSteps: rescue.engagement?.items ?? [],
  /** Derived from the same data as /experiments, so the two can never drift apart. */
  reportRows: FINDINGS.filter((f) => f.featured).map((f) => ({
    area: f.area,
    finding: f.finding,
    verdict: VERDICTS[f.verdict].label,
    severity: f.severity.charAt(0) + f.severity.slice(1).toLowerCase(),
  })),
  roadmap: ROADMAP,
};

export const PRINCIPLE = "We will not compete by saying more. We will compete by proving more.";

/** Derived from the same data as /process, so the homepage loop and the full page can never drift apart. */
export const PROCESS_STEPS = PROCESS_PHASES.map(({ n, title, summary }) => ({ n, title, body: summary }));

export const COMMITMENTS = PROCESS_COMMITMENTS;

export const SIGNATURES = [
  "AI-accelerated. Senior-reviewed.",
  "Your code. Your data.",
  "New York insight. Global execution.",
] as const;

export type ProofKind = "site" | "dashboard" | "mobile" | "automation" | "report";

export const PROOF_ITEMS: { kind: ProofKind; label: string; title: string; body: string }[] = [
  { kind: "site", label: "LIVE PROOF · DIGITAL EXPERIENCES", title: "This website", body: "Digital Experiences, demonstrated by the thing you are using now." },
  { kind: "dashboard", label: "CONCEPT DEMO · FICTIONAL DATA", title: "Operations dashboard", body: "Users, permissions, tasks, data and reporting in one realistic workflow." },
  { kind: "mobile", label: "CONCEPT DEMO · MOBILE PRODUCTS", title: "Mobile journey", body: "One complete journey from sign-in to a useful outcome — not ten loose screens." },
  { kind: "automation", label: "INTERACTIVE DEMO · AUTOMATION", title: "Automation with approval", body: "Request, lookup, proposed action, human approval, system update." },
  { kind: "report", label: "SAMPLE DELIVERABLE · RESCUE", title: "Rescue Report", body: "Findings, severity, what to keep, what to replace, and a 30/60/90-day plan." },
];

export const DEMO_REVIEWS = (reviewsData as Review[]).slice(0, 3);

export const FAQ_TEASERS = [
  "How do we get started with Aceva?",
  "Do you offer fixed-price or dedicated-team engagements?",
  "Who owns the code, the accounts and the data?",
] as const;
