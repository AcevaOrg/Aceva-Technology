export interface ContactFormValues {
  name: string;
  email: string;
  company: string;
  situation: "new" | "improve" | "help";
  service: "unsure" | "digital" | "software" | "mobile" | "intelligence" | "rescue";
  budget: "" | "sprint" | "small" | "mid" | "ongoing";
  details: string;
}

export interface ContactFieldErrors {
  name?: boolean;
  email?: boolean;
  company?: boolean;
  budget?: boolean;
  details?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  company: 150,
  detailsMin: 20,
  detailsMax: 5_000,
} as const;

export function validateContact(f: ContactFormValues): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const name = f.name.trim();
  const email = f.email.trim();
  const company = f.company.trim();
  const details = f.details.trim();

  if (!name || name.length > CONTACT_LIMITS.name) errors.name = true;
  if (email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email)) errors.email = true;
  if (!company || company.length > CONTACT_LIMITS.company) errors.company = true;
  if (!f.budget) errors.budget = true;
  if (details.length < CONTACT_LIMITS.detailsMin || details.length > CONTACT_LIMITS.detailsMax) errors.details = true;
  return errors;
}

/**
 * Per-field messages. A red border alone fails WCAG 1.4.1 (colour is the only cue) and
 * tells a screen-reader user nothing about what to fix.
 */
export const FIELD_MESSAGES: Record<keyof ContactFieldErrors, string> = {
  name: "Enter your name.",
  email: "Enter a valid work email, like you@company.com.",
  company: `Enter your company name, under ${CONTACT_LIMITS.company} characters.`,
  budget: "Choose a budget range.",
  details: `Describe the problem in at least ${CONTACT_LIMITS.detailsMin} characters.`,
};

/** Order used to decide which invalid field receives focus after a failed submit. */
export const FIELD_ORDER: (keyof ContactFieldErrors)[] = ["name", "email", "company", "budget", "details"];

export function errorSummary(errors: ContactFieldErrors): string {
  const parts: string[] = [];
  if (errors.name) parts.push("your name");
  if (errors.email) parts.push("a valid work email");
  if (errors.company) parts.push("your company name");
  if (errors.budget) parts.push("a budget range");
  if (errors.details) parts.push(`a problem description between ${CONTACT_LIMITS.detailsMin} and ${CONTACT_LIMITS.detailsMax} characters`);
  if (!parts.length) return "";
  return "We still need " + parts.join(", ") + " before a senior can read this.";
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  email: "",
  company: "",
  situation: "new",
  service: "unsure",
  budget: "",
  details: "",
};
