import { CAPS } from "@/lib/data/caps";
import { FAQS, type Faq } from "@/lib/data/faqs";
import { PROVENANCE } from "@/lib/data/experiments";

/**
 * Single source for the /process page and the homepage's "How we work" section.
 * Every line is existing Aceva copy: the phases are verbatim from the previous /process page,
 * the one-line summaries verbatim from the homepage, and the rest is quoted from the FAQs and
 * capability limits. The only invented content is the weekly-update sample, which is labelled
 * as a sample deliverable on a fictional project wherever it renders.
 */

export type PhaseKey = "understand" | "design" | "build" | "launch" | "improve";

export interface ProcessPhase {
  key: PhaseKey;
  n: string;
  title: string;
  /** The one-liner the homepage's delivery loop shows. */
  summary: string;
  lead: string;
  /** "You receive": always three written deliverables. */
  receive: readonly [string, string, string];
}

export const PROCESS_PHASES: readonly ProcessPhase[] = [
  {
    key: "understand",
    n: "01",
    title: "Understand",
    summary: "Requirements, goals, constraints and feasibility before any code.",
    lead: "We document the business problem, constraints, and success criteria before anyone estimates anything. Technical feasibility is evaluated by a senior engineer, not a salesperson.",
    receive: [
      "A written problem statement and success criteria",
      "Scope boundaries detailing what is included and what is deferred",
      "A feasibility evaluation from a senior engineer",
    ],
  },
  {
    key: "design",
    n: "02",
    title: "Design",
    summary: "UX, interface and architecture planning with acceptance criteria.",
    lead: "Interface and system architecture are designed together, so the user experience is matched by clean, maintainable engineering.",
    receive: [
      "Screens and interaction flows for primary user journeys, including mobile",
      "An architecture plan with key decisions written down",
      "Acceptance criteria we will be measured against",
    ],
  },
  {
    key: "build",
    n: "03",
    title: "Build",
    summary: "Senior-reviewed sprints with weekly working demos.",
    lead: "AI-accelerated development with mandatory senior code review. No junior change reaches production without a named senior review.",
    receive: [
      "A working demo every week — not just a status email",
      "The week's decisions, risks, and open questions in writing",
      "Commit access to your own repository from day one",
    ],
  },
  {
    key: "launch",
    n: "04",
    title: "Launch",
    summary: "QA, security basics, deployment and analytics under your accounts.",
    lead: "Mobile QA, browser QA, security basics, content review, analytics, and deployment — under accounts you control.",
    receive: [
      "A launch checklist that had to pass before going live",
      "Ownership of domain, hosting, repository, and analytics",
      "Named people responsible for resolving post-launch issues",
    ],
  },
  {
    key: "improve",
    n: "05",
    title: "Improve",
    summary: "Monitoring, iteration and a modernization roadmap you can act on.",
    lead: "Monitoring, iteration, and a modernization roadmap you can act on with us or independently.",
    receive: [
      "Monitoring and alerts configured to reach a human",
      "A prioritized improvement list based on real usage",
      "Documentation structured for another team to pick up",
    ],
  },
];

export const PROCESS_INTRO =
  "Five distinct phases with weekly demos and clear ownership. You see working progress, decisions, risks, and tests every week instead of waiting for a deadline.";

/** Every written deliverable across the five phases, in order. */
export const DELIVERABLES = PROCESS_PHASES.flatMap((phase) =>
  phase.receive.map((text, i) => ({ phase: phase.key, n: phase.n, index: i, text }))
);

/** How many deliverables you hold once each phase is done (3, 6, 9, 12, 15). */
export const DELIVERED_BY: Record<PhaseKey, number> = Object.fromEntries(
  PROCESS_PHASES.map((phase, i) => [
    phase.key,
    PROCESS_PHASES.slice(0, i + 1).reduce((sum, p) => sum + p.receive.length, 0),
  ])
) as Record<PhaseKey, number>;

export const PROCESS_COMMITMENTS = [
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

export function phaseByKey(key: PhaseKey): ProcessPhase {
  const phase = PROCESS_PHASES.find((p) => p.key === key);
  if (!phase) throw new Error(`Unknown phase: ${key}`);
  return phase;
}

/* ---------- who owns what ---------- */

export interface OwnershipRow {
  item: string;
  owner: string;
  when: string;
  /** The existing sentence this row restates, so the table can never claim more than the copy. */
  source: string;
}

export const OWNERSHIP_ROWS: readonly OwnershipRow[] = [
  {
    item: "Code and repository",
    owner: "You",
    when: "From day one of Build",
    source: phaseByKey("build").receive[2],
  },
  {
    item: "Domain, hosting and analytics",
    owner: "You",
    when: "At Launch, under accounts you control",
    source: phaseByKey("launch").receive[1],
  },
  {
    item: "Your data",
    owner: "You",
    when: "Always",
    source: PROCESS_COMMITMENTS[1].body,
  },
  {
    item: "Acceptance criteria",
    owner: "You — we are measured against them",
    when: "Written in Design",
    source: phaseByKey("design").receive[2],
  },
  {
    item: "Documentation",
    owner: "You — structured for another team to pick up",
    when: "Improve",
    source: phaseByKey("improve").receive[2],
  },
  {
    item: "Architecture, security and quality",
    owner: "Aceva — a named senior engineer",
    when: "Every change",
    source: PROCESS_COMMITMENTS[0].body,
  },
  {
    item: "Post-launch issues",
    owner: "Aceva — named people",
    when: "After Launch",
    source: phaseByKey("launch").receive[2],
  },
];

/* ---------- what we won't promise ---------- */

function faqAnswer(question: string): string {
  const faq = FAQS.find((f) => f.q === question);
  if (!faq) throw new Error(`FAQ not found: ${question}`);
  return faq.a;
}

function sentenceFrom(answer: string, starts: string): string {
  const sentence = answer.split(/(?<=\.)\s+/).find((s) => s.startsWith(starts));
  if (!sentence) throw new Error(`Sentence not found: ${starts}`);
  return sentence;
}

export const WONT_PROMISE: readonly { label: string; text: string }[] = [
  {
    label: "Timelines",
    text: sentenceFrom(faqAnswer("What is your typical project timeline?"), "It depends on scope"),
  },
  {
    label: "Support",
    text: sentenceFrom(faqAnswer("Do you provide post-launch support?"), "Support terms"),
  },
  ...CAPS.map((cap) => ({ label: cap.name, text: cap.limit })),
];

/* ---------- process FAQs ---------- */

/** "How do we get started" is left out on purpose: the page's close quotes that answer. */
export const PROCESS_FAQ_QUESTIONS = [
  "What is your typical project timeline?",
  "Do you offer fixed-price or dedicated-team engagements?",
  "Who owns the code, the accounts and the data?",
  "You use AI. How do I know the code is safe?",
  "Do you provide post-launch support?",
] as const;

export const PROCESS_FAQS: readonly Faq[] = PROCESS_FAQ_QUESTIONS.map((q) => ({ q, a: faqAnswer(q) }));

/* ---------- the weekly update (a labelled sample) ---------- */

export const SAMPLE_UPDATE = {
  label: `${PROVENANCE.sample.label} · Fictional project`,
  project: "Customer booking portal",
  title: "Weekly update",
  demo: "Working demo: this week’s build, ready to click through",
  sections: [
    {
      heading: "Working this week",
      items: ["Customers can book, move and cancel an appointment", "Staff see the day’s bookings on one screen"],
    },
    {
      heading: "Decisions",
      items: ["Reminder emails send from the client’s own email account", "Cancellation rules stay editable by the client’s team"],
    },
    {
      heading: "Risks",
      items: ["The calendar provider’s usage limits are not yet confirmed"],
    },
    {
      heading: "Open questions",
      items: ["Who approves a refund for a late cancellation?"],
    },
  ],
  signoff: "Every change reviewed by a named senior engineer",
} as const;
