import { ROUTES } from "@/lib/nav";

/** Single source for /about copy and the pages each claim points to. */

export const ABOUT_HERO = {
  eyebrow: "Why Aceva",
  lead: "We won't compete by saying more. We'll compete by ",
  emphasis: "proving",
  tail: " more.",
  lede: "Aceva builds custom software, automation and mobile products, and rescues the ones other teams couldn't finish. What sets us apart isn't the list of services. It's what you can check before you commit.",
} as const;

export const ABOUT_STANCE = {
  eyebrow: "What we are not claiming",
  title: "Familiar services. A clearer way to buy them.",
  paragraphs: [
    "Our five services aren't unique. Global consultancies already sell custom software, AI, product engineering, cloud and modernization.",
    "AI-assisted coding is becoming normal too. **The advantage is the review, the architecture, the security and the customer experience around it.**",
    "So we don't try to invent a category. We package what you already know you need in a way that's faster to understand and easier to trust.",
  ],
} as const;

export interface ProofPoint {
  num: string;
  title: string;
  /** Short line used in the stance list. */
  gist: string;
  /** Longer line used in the proof rows. */
  claim: string;
  linkLabel: string;
  href: string;
}

export const PROOF_POINTS: readonly ProofPoint[] = [
  {
    num: "01",
    title: "Clarity",
    gist: "You can tell what we do in one screen.",
    claim: "One screen says what we do, who it's for, and what the first step costs you.",
    linkLabel: "Homepage",
    href: ROUTES.home,
  },
  {
    num: "02",
    title: "Proof",
    gist: "A narrow paid sprint before a large commitment.",
    claim: "Concept demos you can use, each honestly labeled as live, fictional or sample.",
    linkLabel: "Experiments",
    href: ROUTES.work,
  },
  {
    num: "03",
    title: "Product Rescue",
    gist: "The offer most agencies avoid.",
    claim: "A sample rescue report with findings ranked by severity, so you see the deliverable before you buy it.",
    linkLabel: "Rescue report",
    href: `${ROUTES.work}#rescue-report`,
  },
  {
    num: "04",
    title: "Ownership",
    gist: "Your code, your accounts, your data.",
    claim: "Your code, your hosting accounts, your data. Handover is the plan from day one.",
    linkLabel: "How we work",
    href: ROUTES.process,
  },
  {
    num: "05",
    title: "Transparency",
    gist: "Weekly working proof, risks included.",
    claim: "A working update every week, with the risks written down next to the progress.",
    linkLabel: "How we work",
    href: ROUTES.process,
  },
];

export const ABOUT_PROOF = {
  eyebrow: "Check the claims",
  title: "Every promise points at something you can open.",
  lede: "No client logos or testimonials we can't back. Just the pages that show the work.",
} as const;

export const ABOUT_BUILT = {
  eyebrow: "How we're built",
  title: "Senior review on every change. Juniors growing under named mentors.",
  columns: [
    { kicker: "Review", title: "A named senior signs off", body: "Every change is reviewed by a named senior engineer before it reaches production." },
    { kicker: "Mentorship", title: "Juniors work with a mentor", body: "Research, UI components, tests and documentation, each with a mentor attached." },
    { kicker: "Scope", title: "A smaller finished version", body: "We'd rather ship a narrower scope that works than promise a large one that doesn't." },
  ],
  linkLabel: "See how the team is structured",
  href: ROUTES.company,
} as const;

export const ABOUT_CLOSE = {
  lines: ["Build new products.", "Improve existing businesses.", "Rescue software that other teams could not finish."],
} as const;
