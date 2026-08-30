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
  seoTitle: string;
  seoDescription: string;
  engagement?: {
    title: string;
    items: string[];
  };
  closing?: string;
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
    lead: "Aceva engineers AI-assisted workflows that retrieve approved knowledge,coordinate business systems and require human authorization at critical decision points.",
    includes: [
      "Knowledge assistants grounded in approved repositories.",
      "Workflow and document automation",
      "Integrations across approved CRM, email, calendar and payment systems.",
      "Operational alerts and decision-ready reporting.",
      "Human approval and activity logging",
    ],
    when: "Use this service when teams repeatedly transfer data across disconnected tools, struggle to retrieve reliable knowledge or need faster processing without relinquishing human authorization.",
    sales: "We automate repeatable operations while preserving accountable human oversight",
    proof: "Demonstrate an end-to-end controlled flow: request -> approved retrieval -> proposed action -> human authorization -> system update -> audit log. Link directly to the Automation with Approval experiment.",
    limit: "We do not sell nominal 'agents' or uncontrolled autonomy. Production workflows require explicit permissions, tested failure modes and accountable approval gates.",
    seoTitle: "AI & Workflow Automation",
    seoDescription:
      "AI and connected workflows that cut repetitive work and improve decisions — for scattered information, manual handoffs and slow customer response.",
    engagement: {
      title: "Automation Proof Sprint",
      items: [
        "Map the workflow, trigger, data and owners.",
        "Define access, approval gates and exceptions.",
        "Prototype one controlled flow using approved sample data.",
        "Validate edge cases, failures and human handoffs.",
        "Issue a risk assessment and scale-up roadmap."
      ]
    },
    closing: "Identify the workflow creating the greatest delay. We will determine whether a focused proof can validate its automation potential.",
  },
  {
    key: "rescue",
    num: "05",
    name: "Product Rescue & Reliability",
    lead: "Aceva audits unfinished, unstable, inherited or AI-generated software, distinguishes recoverable assets from structural liabilities and defines an evidence-led recovery path.",
    includes: [
      "Code and architecture audit",
      "Bug stabilization and performance work",
      "AI-generated code review",
      "Security and deployment assessment",
      "Testing, documentation and modernization roadmap",
    ],
    when: "Use Product Rescue when a product is unfinished, releases remain unstable, inherited or AI-generated code is unmaintainable, deployment is fragile or the business lacks evidence to choose remediation over replacement.",
    sales: "We first determine what can be saved. Then we stabilize the product and create a clear path forward.",
    proof: "The Rescue Report provides an executive diagnosis, evidence-backed risk register, architecture and security findings, maintainability gaps, a keep/remediate/replace/defer matrix and a prioritized 30/60/90-day roadmap.",
    limit: "Not every product warrants rescue. Aceva estimates recovery only after senior technical review, and the evidence may justify replacing high-risk components.",
    seoTitle: "Product Rescue & Software Reliability",
    seoDescription:
      "Recover unfinished, unstable or unscalable software without rebuilding blindly. We audit first, rank risks by severity, then separate keep from replace.",
    engagement: {
      title: "Rescue Sprint",
      items: [
        "Triage objectives, symptoms and available access.",
        "Assess architecture, code, dependencies, data, security, testing and deployment.",
        "Classify components as keep, remediate, replace or defer.",
        "Sequence critical stabilization work.",
        "Issue a 30/60/90-day remediation roadmap."
      ]
    },
    closing: "Describe what is broken, incomplete or untrustworthy. A senior will determine the evidence required and whether a Rescue Sprint is justified.",
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
