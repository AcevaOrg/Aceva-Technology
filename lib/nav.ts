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
  documents: "/documents",
  verify: "/verify",
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

/** Public verification URL for a code — the exact string encoded into every QR. */
export function verifyRoute(code: string): string {
  return `${ROUTES.verify}/${encodeURIComponent(code)}`;
}

/** Internal admin console paths. Never linked from the public site. */
export const ADMIN_ROUTES = {
  root: "/admin",
  login: "/admin/login",
  documents: "/admin/documents",
  newDocument: "/admin/documents/new",
  verification: "/admin/verification",
  activity: "/admin/activity",
  settings: "/admin/settings",
} as const;

export function adminDocumentRoute(id: string): string {
  return `${ADMIN_ROUTES.documents}/${id}`;
}
