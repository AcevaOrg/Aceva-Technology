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

export function validateContact(f: Pick<ContactFormValues, "name" | "email" | "details">): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  const name = f.name.trim();
  const email = f.email.trim();
  const details = f.details.trim();

  if (!name || name.length > CONTACT_LIMITS.name) errors.name = true;
  if (email.length > CONTACT_LIMITS.email || !EMAIL_RE.test(email)) errors.email = true;
  if (details.length < CONTACT_LIMITS.detailsMin || details.length > CONTACT_LIMITS.detailsMax) errors.details = true;
  return errors;
}

export function errorSummary(errors: ContactFieldErrors): string {
  const parts: string[] = [];
  if (errors.name) parts.push("your name");
  if (errors.email) parts.push("a valid work email");
  if (errors.company) parts.push("a shorter company name");
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
