export type CapabilityKey = "digital" | "software" | "mobile" | "intelligence" | "rescue";

export interface Capability {
  key: CapabilityKey;
  num: string;
  name: string;
  lead: string;
  includes: string[];
  when: string;
  sales: string;
  proof: string;
  limit: string;
  /**
   * Search-facing title, kept separate from `name` so the on-page heading can stay in
   * brand language ("Digital Experiences") while the page title targets the term buyers
   * actually search ("Website & Digital Platform Development"). The brand suffix is
   * appended by the root layout's title template.
   */
  seoTitle: string;
  /** Search-facing description, 140–160 characters. */
  seoDescription: string;
}

export const CAPS: Capability[] = [
  {
    key: "digital",
    num: "01",
    name: "Digital Experiences",
    lead: "Websites and digital platforms designed to attract, convert and serve customers.",
    includes: [
      "Corporate and startup websites",
      "E-commerce and booking experiences",
      "Customer portals and dashboards",
      "Landing pages and conversion journeys",
      "UX/UI design systems",
    ],
    when: "A business needs a new digital presence, or its current website looks weak, slow or confusing.",
    sales: "We design digital experiences that make the business easier to understand, trust and use.",
    proof: "One premium Aceva website concept with strong mobile behavior, real speed and a working lead flow.",
    limit: "We do not promise guaranteed sales or search rankings.",
    seoTitle: "Website & Digital Platform Development",
    seoDescription:
      "Websites and digital platforms designed to attract, convert and serve customers — corporate sites, e-commerce, booking flows, portals and dashboards.",
  },
  {
    key: "software",
    num: "02",
    name: "Custom Software",
    lead: "Software built around the way a business actually operates.",
    includes: [
      "SaaS products",
      "Internal management systems",
      "Operational dashboards",
      "Marketplaces and portals",
      "Custom web applications and integrations — TypeScript, Next.js, Node.js, PostgreSQL",
    ],
    when: "Off-the-shelf software no longer fits your workflow or business model.",
    sales: "We engineer systems around your operation — not the other way around.",
    proof: "A clean operations dashboard with users, permissions, tasks, data and reporting.",
    limit: "We do not accept a large build without written scope, milestones and acceptance criteria.",
    seoTitle: "Custom Software Development",
    seoDescription:
      "Software built around the way your business actually operates, for when off-the-shelf tools no longer fit your workflow or business model.",
  },
  {
    key: "mobile",
    num: "03",
    name: "Mobile Products",
    lead: "Customer and field-team apps for iOS and Android — built with Expo and React Native by default.",
    includes: [
      "iOS and Android apps from a single codebase (Expo / React Native)",
      "Fully native or Flutter builds when a requirement justifies it",
      "Customer self-service apps",
      "Employee and field-work apps",
      "Connections to your existing systems over REST and typed APIs",
    ],
    when: "Customers or employees need to complete important work from a phone.",
    sales: "An app has to earn its place on someone’s phone. We build for that bar.",
    proof: "One interactive app prototype with a complete user journey — not ten disconnected screens.",
    limit: "We do not promise separate native iOS and Android builds when Expo covers what the product needs.",
    seoTitle: "Mobile App Development",
    seoDescription:
      "Mobile products designed for adoption, performance and growth — for when customers or employees must complete important work from a phone.",
  },
  {
    key: "intelligence",
    num: "04",
    name: "Intelligence & Automation",
    lead: "AI and connected workflows that reduce repetitive work and improve decisions.",
    includes: [
      "AI assistants and knowledge search",
      "Workflow and document automation",
      "CRM, email, calendar and payment integrations",
      "Operational dashboards and alerts",
      "Human approval and activity logging",
    ],
    when: "Employees repeat the same work, information is scattered, or customers wait too long.",
    sales: "We connect the work, remove repetition and keep people in control of important decisions.",
    proof: "One controlled automation: request → data lookup → proposed action → human approval → system update.",
    limit: "We do not call every chatbot an AI agent, and we do not promise full autonomy.",
    seoTitle: "AI & Workflow Automation",
    seoDescription:
      "AI and connected workflows that cut repetitive work and improve decisions — for scattered information, manual handoffs and slow customer response.",
  },
  {
    key: "rescue",
    num: "05",
    name: "Product Rescue & Reliability",
    lead: "Recover unfinished, unstable or difficult-to-scale software without rebuilding blindly.",
    includes: [
      "Code and architecture audit",
      "Bug stabilization and performance work",
      "AI-generated code review",
      "Security and deployment assessment",
      "Testing, documentation and modernization roadmap",
    ],
    when: "You already spent money, but the software is broken, delayed, insecure or trapped with a previous developer.",
    sales: "We first determine what can be saved. Then we stabilize the product and create a clear path forward.",
    proof: "A sample Rescue Report with findings, severity, what to keep, what to replace and a 30/60/90-day plan.",
    limit: "We do not promise that every product can be repaired, and we do not quote a rescue before senior review.",
    seoTitle: "Product Rescue & Software Reliability",
    seoDescription:
      "Recover unfinished, unstable or unscalable software without rebuilding blindly. We audit first, rank risks by severity, then separate keep from replace.",
  },
];

export const CAP_PAGES: Record<CapabilityKey, string> = {
  digital: "digital",
  software: "software",
  mobile: "mobile",
  intelligence: "intelligence",
  rescue: "rescue",
};

export function getCapability(key: string): Capability | undefined {
  return CAPS.find((c) => c.key === key);
}

export function getAdjacentCapabilities(key: CapabilityKey): { prev: Capability | null; next: Capability | null } {
  const idx = CAPS.findIndex((c) => c.key === key);
  const prev = idx > 0 ? CAPS[idx - 1] : null;
  const next = idx >= 0 && idx < CAPS.length - 1 ? CAPS[idx + 1] : null;
  return { prev, next };
}
