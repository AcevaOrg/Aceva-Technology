export const ROUTES = {
  home: "/",
  services: "/services",
  work: "/experiments",
  process: "/process",
  about: "/about",
  company: "/company",
  technology: "/technology",
  industries: "/industries",
  testimonials: "/testimonials",
  careers: "/careers",
  insights: "/insights",
  faq: "/faq",
  contact: "/contact",
  privacy: "/legal/privacy",
  terms: "/legal/terms",
} as const;

export function capabilityRoute(key: string): string {
  return `/services/${key}`;
}

export function contactRoute(situation?: string): string {
  return situation ? `${ROUTES.contact}?situation=${situation}` : ROUTES.contact;
}
