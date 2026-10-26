import { CAPS, type CapabilityKey } from "@/lib/data/caps";
import { PATHS, PATH_KEYS } from "@/lib/data/paths";
import type { Review } from "@/components/features/ReviewCard";
import reviewsData from "@/data/reviews.json";

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
  /** Mirrors the fictional Kestrel Booking sample on /experiments. */
  reportRows: [
    { area: "Authentication", finding: "Session tokens never expire; password reset can be replayed.", verdict: "Replace", severity: "Critical" },
    { area: "Deployment", finding: "Production is deployed from a laptop; no rollback path exists.", verdict: "Replace", severity: "Critical" },
    { area: "AI-generated code", finding: "Payment logic was generated and never reviewed; no tests.", verdict: "Remediate", severity: "High" },
    { area: "Performance", finding: "Booking list loads all records before rendering.", verdict: "Remediate", severity: "High" },
    { area: "Data model", finding: "Schema is sound; naming is inconsistent and undocumented.", verdict: "Keep", severity: "Medium" },
  ],
  roadmap: [
    { when: "First 30 days", body: "Stop the bleeding: auth replaced, deployment pipeline in place, error monitoring on, backups verified." },
    { when: "Days 30–60", body: "Stabilize: payment path reviewed and tested, booking list paginated, documentation written for the kept schema." },
    { when: "Days 60–90", body: "Modernize with intent: the roadmap for what to rebuild, in what order, and what it buys the business." },
  ],
} as const;

export const PRINCIPLE = "We will not compete by saying more. We will compete by proving more.";

export const PROCESS_STEPS = [
  { n: "01", title: "Understand", body: "Requirements, goals, constraints and feasibility before any code." },
  { n: "02", title: "Design", body: "UX, interface and architecture planning with acceptance criteria." },
  { n: "03", title: "Build", body: "Senior-reviewed sprints with weekly working demos." },
  { n: "04", title: "Launch", body: "QA, security basics, deployment and analytics under your accounts." },
  { n: "05", title: "Improve", body: "Monitoring, iteration and a modernization roadmap you can act on." },
] as const;

export const COMMITMENTS = [
  {
    title: "Senior review, always",
    body: "AI is used for speed. A senior engineer remains responsible for architecture, security, and quality.",
  },
  {
    title: "You own everything",
    body: "Your code. Your accounts. Your data. No developer personally owns the domain, repository, or hosting for your business.",
  },
  {
    title: "Weekly proof",
    body: "Working progress, decisions, risks and tests every week — instead of hiding until the deadline.",
  },
] as const;

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
