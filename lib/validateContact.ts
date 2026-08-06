export interface ContactFormValues {
  name: string;
  email: string;
  company: string;
  situation: "new" | "improve" | "help";
  service: "unsure" | "digital" | "software" | "mobile" | "intelligence" | "rescue";
  budget: string;
  details: string;
}

export interface ContactFieldErrors {
  name?: boolean;
  email?: boolean;
  details?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(f: Pick<ContactFormValues, "name" | "email" | "details">): ContactFieldErrors {
  const errors: ContactFieldErrors = {};
  if (!f.name.trim()) errors.name = true;
  if (!EMAIL_RE.test(f.email.trim())) errors.email = true;
  if (f.details.trim().length < 12) errors.details = true;
  return errors;
}

export function errorSummary(errors: ContactFieldErrors): string {
  const parts: string[] = [];
  if (errors.name) parts.push("your name");
  if (errors.email) parts.push("a valid work email");
  if (errors.details) parts.push("a sentence or two about the problem");
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
