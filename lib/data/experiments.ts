import { ROUTES } from "@/lib/nav";

/**
 * Single source for the /experiments page and the homepage tiles that point at it.
 * Every figure here is fictional or sample data and is labelled as such on the page.
 */

export type ExperimentKey = "site" | "dashboard" | "mobile" | "automation" | "rescue" | "pulse";
export type Provenance = "live" | "fictional" | "sample";

export const PROVENANCE: Record<Provenance, { label: string; definition: string }> = {
  live: { label: "Live on this site", definition: "Real and running. You can use it right now." },
  fictional: {
    label: "Fictional brief",
    definition: "Our work on an invented brief. The companies, people and numbers are made up.",
  },
  sample: {
    label: "Sample deliverable",
    definition: "What you would receive from us, shown on a fictional product.",
  },
};

export interface Experiment {
  key: ExperimentKey;
  /** Public anchor on /experiments. Treat as a contract: other pages link to it. */
  slug: string;
  num: string;
  provenance: Provenance;
  /** Capability line shown after the provenance label. */
  capability: string;
  /** Short name used in the index and the homepage tiles. */
  title: string;
  /** Compact index label for narrow widths. */
  short: string;
}

export const EXPERIMENTS: Experiment[] = [
  { key: "site", slug: "this-website", num: "01", provenance: "live", capability: "Digital experiences", title: "This website", short: "Website" },
  { key: "dashboard", slug: "operations-dashboard", num: "02", provenance: "fictional", capability: "Custom software", title: "Operations dashboard", short: "Dashboard" },
  { key: "mobile", slug: "mobile-journey", num: "03", provenance: "fictional", capability: "Mobile products", title: "Mobile journey", short: "Mobile" },
  { key: "automation", slug: "automation-with-approval", num: "04", provenance: "fictional", capability: "Intelligence & automation", title: "Automation with approval", short: "Automation" },
  { key: "rescue", slug: "rescue-report", num: "05", provenance: "sample", capability: "Product rescue & reliability", title: "Rescue Report", short: "Rescue" },
  { key: "pulse", slug: "aceva-pulse", num: "06", provenance: "live", capability: "AI assistant", title: "Aceva Pulse", short: "Pulse" },
];

export function experimentHref(key: ExperimentKey): string {
  const exp = EXPERIMENTS.find((e) => e.key === key);
  return exp ? `${ROUTES.work}#${exp.slug}` : ROUTES.work;
}

/* ------------------------------ Rescue report ------------------------------ */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM";
export type Verdict = "keep" | "remediate" | "replace" | "defer";

export interface Finding {
  area: string;
  finding: string;
  severity: Severity;
  recommendation: string;
  verdict: Verdict;
  /** True for the five rows shown on the homepage's Rescue spotlight. */
  featured?: boolean;
}

export const FINDINGS: Finding[] = [
  { area: "Authentication", finding: "Session tokens never expire; password reset can be replayed.", severity: "CRITICAL", recommendation: "Replace with a managed provider. Week 1.", verdict: "replace", featured: true },
  { area: "Deployment", finding: "Production is deployed from a laptop; no rollback path exists.", severity: "CRITICAL", recommendation: "Replace with CI, staging and a rollback. Week 2.", verdict: "replace", featured: true },
  { area: "Data model", finding: "Schema is sound; naming is inconsistent and undocumented.", severity: "MEDIUM", recommendation: "Keep. Document and rename in place.", verdict: "keep", featured: true },
  { area: "AI-generated code", finding: "Payment logic was generated and never reviewed; no tests.", severity: "HIGH", recommendation: "Senior review, then tests before any change.", verdict: "remediate", featured: true },
  { area: "Performance", finding: "Booking list loads all records before rendering.", severity: "HIGH", recommendation: "Keep the screen. Paginate the query.", verdict: "remediate", featured: true },
  { area: "Background jobs", finding: "Failed email jobs retry forever and hold up the queue.", severity: "HIGH", recommendation: "Add a retry limit and a dead-letter queue.", verdict: "remediate" },
  { area: "Error logging", finding: "Errors go to the console and are lost on every restart.", severity: "MEDIUM", recommendation: "Replace with hosted error monitoring. Week 1.", verdict: "replace" },
  { area: "Test coverage", finding: "Only the sign-up flow has automated tests.", severity: "MEDIUM", recommendation: "Add tests around payments and bookings first.", verdict: "remediate" },
  { area: "Admin panel", finding: "Built on an unmaintained UI kit. It works, but changes are slow.", severity: "MEDIUM", recommendation: "Leave it until day 60. Replace only if the roadmap needs it.", verdict: "defer" },
];

export const VERDICTS: Record<Verdict, { label: string; note: string }> = {
  keep: { label: "Keep", note: "Sound. Leave it and document it." },
  remediate: { label: "Remediate", note: "Fix in place." },
  replace: { label: "Replace", note: "Rebuild this part." },
  defer: { label: "Defer", note: "Not now. Revisit later." },
};

export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM"];

/** Computed, so the summary can never disagree with the table again. */
export function severityCounts(findings: Finding[] = FINDINGS): Record<Severity, number> {
  return findings.reduce(
    (acc, f) => ({ ...acc, [f.severity]: acc[f.severity] + 1 }),
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0 } as Record<Severity, number>
  );
}

export const ROADMAP = [
  { when: "First 30 days", body: "Stop the bleeding: auth replaced, deployment pipeline in place, error monitoring on, backups verified." },
  { when: "Days 30–60", body: "Stabilize: payment path reviewed and tested, booking list paginated, documentation written for the kept schema." },
  { when: "Days 60–90", body: "Modernize with intent: the roadmap for what to rebuild, in what order, and what it buys the business." },
] as const;

/* ------------------------------ Dashboard ------------------------------ */

export type RoleKey = "dispatch" | "ops" | "finance";
export type TaskState = "yours" | "ready" | "blocked" | "locked" | "view";

export const ROLES: Record<RoleKey, { label: string; who: string; initials: string; side: [string, string] }> = {
  dispatch: { label: "Dispatch", who: "Dispatch — Amara O.", initials: "AO", side: ["ROLE: DISPATCH", "WRITE ACCESS: TASKS"] },
  ops: { label: "Ops manager", who: "Ops manager — T. Reyes", initials: "TR", side: ["ROLE: OPS MANAGER", "WRITE ACCESS: ROUTING"] },
  finance: { label: "Finance", who: "Finance — R. Okafor", initials: "RO", side: ["ROLE: FINANCE", "WRITE ACCESS: APPROVALS"] },
};

export interface DashTask {
  id: string;
  title: string;
  owner: string;
  verb: string;
  states: Record<RoleKey, { state: TaskState; why?: string }>;
}

export const TASKS: DashTask[] = [
  { id: "t1", title: "Reroute JOB-4412 — customs hold", owner: "Owner: T. Reyes · Ops Manager", verb: "Reroute", states: { dispatch: { state: "blocked", why: "Waiting on customs" }, ops: { state: "yours" }, finance: { state: "view", why: "Ops task" } } },
  { id: "t2", title: "Confirm dock slot — JOB-4418", owner: "Owner: Amara O. · Dispatch", verb: "Confirm", states: { dispatch: { state: "yours" }, ops: { state: "view", why: "Assigned to Amara O." }, finance: { state: "view", why: "Dispatch task" } } },
  { id: "t3", title: "Approve overtime — night crew", owner: "Requires: Finance role", verb: "Approve", states: { dispatch: { state: "locked", why: "Requires Finance role" }, ops: { state: "locked", why: "Requires Finance role" }, finance: { state: "yours" } } },
  { id: "t4", title: "Close out JOB-4390 — delivered", owner: "Owner: Amara O. · Dispatch", verb: "Close out", states: { dispatch: { state: "ready" }, ops: { state: "ready" }, finance: { state: "view", why: "Dispatch task" } } },
];

export const KPIS = [
  { label: "OPEN JOBS", value: "128" },
  { label: "ON TIME", value: "94%" },
  { label: "OVERDUE", value: "7" },
  { label: "AVG DWELL", value: "2.4", unit: "days" },
] as const;

export const ON_TIME_SERIES = [62, 71, 58, 80, 74, 88, 83, 94] as const;

/* ------------------------------ Mobile journey ------------------------------ */

export const JOURNEY_STEPS = [
  { caption: "Sign-in with a code. One field, one button, no dead ends.", screen: "Sign in to Freightline. Use your work email. We send a code, no password to forget. Work email amara@freightline.demo. Send code." },
  { caption: "Verification with a visible resend timer — no silent failure.", screen: "Enter the 6-digit code, sent to amara@freightline.demo. Resend in 0:24." },
  { caption: "The next action is always the largest thing on screen.", screen: "Tuesday, 3 stops left. Your route: JOB-4418 Dock 3, JOB-4421 Warehouse B, JOB-4425 Cross-dock. Start JOB-4418." },
  { caption: "A real outcome, and the next action offered immediately.", screen: "JOB-4418 closed out. Proof of delivery uploaded. Dispatch has been notified and the customer sees the update. Signed by M. Duarte at 10:22. Next stop." },
] as const;

/* ------------------------------ Pulse preview ------------------------------ */

export const PULSE_GREETING =
  "Hello! I'm Aceva Pulse, ACEVA's AI assistant. Tell me what you'd like to build or improve, and I'll help map out your project.";

/** Mirrors INTENT_OPTIONS in components/pulse/PulseMessages.tsx (a client module, so it can't be imported here). */
export const PULSE_INTENTS = [
  "Start something new",
  "Improve what I have",
  "Automate something",
  "Sell something",
  "Solve a problem",
  "I don't know yet",
] as const;
