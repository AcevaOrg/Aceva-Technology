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
  name: "Please enter your full name.",
  email: "Please enter a valid work email, like you@company.com.",
  company: `Please enter your company name (under ${CONTACT_LIMITS.company} characters).`,
  budget: "Please select a budget range to continue.",
  details: `Please describe your problem in at least ${CONTACT_LIMITS.detailsMin} characters.`,
};

/** Order used to decide which invalid field receives focus after a failed submit. */
export const FIELD_ORDER: (keyof ContactFieldErrors)[] = ["name", "email", "company", "budget", "details"];

export function errorSummary(errors: ContactFieldErrors): string {
  const missing: string[] = [];
  if (errors.name) missing.push("your name");
  if (errors.email) missing.push("a valid work email");
  if (errors.company) missing.push("your company name");
  if (errors.budget) missing.push("a budget range");
  if (errors.details) missing.push("a description of your problem");
  if (!missing.length) return "";
  if (missing.length === 1)
    return `Please complete the following before submitting: ${missing[0]}.`;
  return `Please complete the following before submitting: ${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}.`;
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
