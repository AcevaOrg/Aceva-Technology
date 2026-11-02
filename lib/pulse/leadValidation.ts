import type { PulseContextData } from "@/components/pulse/types";

/**
 * Server-side validation for /api/pulse/save-direction.
 *
 * Every stored field has a type check and a hard maximum, and an oversized
 * value is rejected rather than silently truncated, so what is stored is what
 * the visitor sent. Before this, answers and module names had no per-item cap
 * at all: a single 12,000-character answer was accepted and stored (red-team
 * R4), bounded only by the 16 KB body limit.
 *
 * LIMITS (documented in the P1 report; change them here only):
 *   request body            16,384 bytes
 *   lead.name               1–120 characters
 *   lead.contact            email ≤ 254, or phone 7–20 characters
 *   lead.method             "Email" | "Phone" | "Text"
 *   context.intent          ≤ 500     context.industry   ≤ 200
 *   context.business        ≤ 500     context.current    ≤ 500
 *   context.scale           ≤ 200     context.market     ≤ 200
 *   context.timeline        ≤ 200     context.budget     ≤ 200
 *   context.friction/goals  ≤ 10 items, each ≤ 200
 *   answers                 ≤ 20 items, each ≤ 1,000 (a chat message is capped at 1,000)
 *
 * Top-level fields outside the allowed set are rejected. Unknown keys inside
 * `context` are dropped, so a new client field cannot cost a visitor their lead.
 */

export const LEAD_LIMITS = {
  bodyBytes: 16_384,
  name: 120,
  email: 254,
  phoneMin: 7,
  phoneMax: 20,
  arrayItems: 10,
  arrayItem: 200,
  answers: 20,
  answer: 1_000,
} as const;

const CONTEXT_STRING_LIMITS: Record<string, number> = {
  intent: 500,
  industry: 200,
  business: 500,
  current: 500,
  scale: 200,
  market: 200,
  timeline: 200,
  budget: 200,
};

const CONTEXT_ARRAY_FIELDS = ["friction", "goals"] as const;

/**
 * `pulseId` and `recommendedModules` are accepted so a page loaded before this
 * change still saves, but both are ignored: the ID is generated here and the
 * modules are recomputed from the context.
 */
const ALLOWED_TOP_LEVEL = new Set([
  "pulseId",
  "lead",
  "context",
  "answers",
  "recommendedModules",
  "turnstileToken",
  "cf-turnstile-response",
]);

export type ContactMethod = "Email" | "Phone" | "Text";

export interface ValidLeadSubmission {
  lead: { name: string; contact: string; method: ContactMethod };
  context: PulseContextData | undefined;
  answers: string[];
  contactIsEmail: boolean;
}

export type LeadValidation =
  | { ok: true; value: ValidLeadSubmission }
  | { ok: false; errors: Record<string, true> };

/** Control characters Postgres or an email header could choke on. Tab and newline stay. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value: string): string {
  return value.replace(CONTROL_CHARACTERS, "").trim();
}

export const EMAIL_PATTERN = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()".]{2,}$/;
/**
 * Digits with the usual separators. It used to demand a digit first and had no
 * dot, so "(555) 123-4567" and "555.123.4567", two of the most common ways to
 * write a number, were refused and the save failed with only "check your details".
 */
const PHONE_PATTERN = /^\+?[0-9(][0-9 ().-]*[0-9]$/;

export function isValidEmail(value: string): boolean {
  return value.length <= LEAD_LIMITS.email && EMAIL_PATTERN.test(value);
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return (
    value.length >= LEAD_LIMITS.phoneMin &&
    value.length <= LEAD_LIMITS.phoneMax &&
    digits.length >= LEAD_LIMITS.phoneMin - 1 &&
    PHONE_PATTERN.test(value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateLeadSubmission(body: Record<string, unknown>): LeadValidation {
  const errors: Record<string, true> = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) errors.body = true;
  }

  // ---- lead
  let lead: ValidLeadSubmission["lead"] | undefined;
  let contactIsEmail = false;
  if (!isPlainObject(body.lead)) {
    errors.lead = true;
  } else {
    const { name, contact, method } = body.lead;
    const cleanName = typeof name === "string" ? clean(name) : "";
    const cleanContact = typeof contact === "string" ? clean(contact) : "";

    if (!cleanName || cleanName.length > LEAD_LIMITS.name) errors.name = true;

    contactIsEmail = cleanContact.includes("@");
    if (contactIsEmail ? !isValidEmail(cleanContact) : !isValidPhone(cleanContact)) errors.contact = true;

    let cleanMethod: ContactMethod = "Email";
    if (method !== undefined) {
      if (method === "Email" || method === "Phone" || method === "Text") cleanMethod = method;
      else errors.method = true;
    }

    lead = { name: cleanName, contact: cleanContact, method: cleanMethod };
  }

  // ---- context
  let context: PulseContextData | undefined;
  if (body.context !== undefined && body.context !== null) {
    if (!isPlainObject(body.context)) {
      errors.context = true;
    } else {
      const raw = body.context;
      const out: Record<string, unknown> = {};

      for (const [key, max] of Object.entries(CONTEXT_STRING_LIMITS)) {
        const value = raw[key];
        if (value === undefined || value === null || value === "") continue;
        if (typeof value !== "string" || clean(value).length > max) {
          errors[`context.${key}`] = true;
          continue;
        }
        out[key] = clean(value);
      }

      for (const key of CONTEXT_ARRAY_FIELDS) {
        const value = raw[key];
        if (value === undefined || value === null) continue;
        if (
          !Array.isArray(value) ||
          value.length > LEAD_LIMITS.arrayItems ||
          value.some((item) => typeof item !== "string" || clean(item).length > LEAD_LIMITS.arrayItem)
        ) {
          errors[`context.${key}`] = true;
          continue;
        }
        out[key] = (value as string[]).map(clean).filter(Boolean);
      }

      context = out as PulseContextData;
    }
  }

  // ---- answers
  let answers: string[] = [];
  if (body.answers !== undefined && body.answers !== null) {
    const value = body.answers;
    if (
      !Array.isArray(value) ||
      value.length > LEAD_LIMITS.answers ||
      value.some((item) => typeof item !== "string" || clean(item).length > LEAD_LIMITS.answer)
    ) {
      errors.answers = true;
    } else {
      answers = (value as string[]).map(clean).filter(Boolean);
    }
  }

  if (Object.keys(errors).length > 0 || !lead) return { ok: false, errors };
  return { ok: true, value: { lead, context, answers, contactIsEmail } };
}

function fit(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * For the browser, before it saves: shortens the context and answers it derived
 * from free text so they fit the limits above. The server still rejects
 * anything oversized; this only stops a genuine visitor's long answer from
 * costing them their lead.
 */
export function fitSubmissionToLimits(
  context: PulseContextData,
  answers: string[]
): { context: PulseContextData; answers: string[] } {
  const out: Record<string, unknown> = {};
  const raw = context as Record<string, unknown>;
  for (const [key, max] of Object.entries(CONTEXT_STRING_LIMITS)) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) out[key] = fit(value, max);
  }
  for (const key of CONTEXT_ARRAY_FIELDS) {
    const value = raw[key];
    if (Array.isArray(value)) {
      out[key] = value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .slice(0, LEAD_LIMITS.arrayItems)
        .map((item) => fit(item, LEAD_LIMITS.arrayItem));
    }
  }
  return {
    context: out as PulseContextData,
    answers: answers.slice(-LEAD_LIMITS.answers).map((answer) => fit(answer, LEAD_LIMITS.answer)),
  };
}
