import { getRecommendedModules } from "./modules";
import { isValidEmail } from "./leadValidation";
import type { SavedDirection } from "./directionStore";

/**
 * The two emails Pulse can send to a visitor, as fixed templates.
 *
 * The previous blueprint email copied the visitor's name, every answer and the
 * stored module list straight into the body, and the address came from the
 * same unverified submission, so ACEVA's verified sender would deliver any text
 * or link to any address (red-team R1). Now:
 *
 *  - Nothing a visitor typed appears in either email: no name, no answers, no
 *    context text. The only dynamic values are the server-generated reference,
 *    module names from the fixed catalogue in `modules.ts`, a link built from
 *    the configured site URL (never the request's Host header), and a number.
 *  - Both are plain text only, so no visitor HTML can ever be rendered.
 *  - Every dynamic value is still passed through `plain()`, which strips line
 *    breaks and control characters and caps length, in case a future caller
 *    hands one something it should not.
 *  - Recipients are validated by `validateRecipient` and are always the stored
 *    address; the routes never mail an address taken from the request.
 */

const MAX_DYNAMIC_LENGTH = 300;

/** One line of plain text: no CR/LF or control characters, bounded length. */
export function plain(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DYNAMIC_LENGTH);
}

/**
 * A single, well-formed mailbox, normalised to lower case, or null.
 * Rejects lists, display names, header injection and over-long addresses.
 */
export function validateRecipient(address: unknown): string | null {
  if (typeof address !== "string") return null;
  if (/[\r\n,;<>]/.test(address)) return null;
  const trimmed = address.trim().toLowerCase();
  return isValidEmail(trimmed) ? trimmed : null;
}

function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = configured && /^https:\/\/[^/\s]+$/.test(configured) ? configured : "https://acevatech.com";
  return base.replace(/\/+$/, "");
}

/** The verification page. The token goes in the fragment, which browsers never send to a server. */
export function verificationUrl(token: string): string {
  return `${siteUrl()}/pulse/verify#token=${encodeURIComponent(token)}`;
}

export function renderVerificationEmail(input: { pulseId: string; token: string; ttlMinutes: number }): {
  subject: string;
  text: string;
} {
  const reference = plain(input.pulseId);
  return {
    subject: `Confirm your email to receive your ACEVA blueprint (${reference})`,
    text: [
      "Hello,",
      "",
      `Someone asked for the project blueprint saved under PULSE reference ${reference} to be emailed to this address.`,
      "",
      `If that was you, open this link within ${Math.round(input.ttlMinutes)} minutes and confirm:`,
      verificationUrl(input.token),
      "",
      "The link works once. If you did not ask for this, ignore this email; nothing will be sent.",
      "",
      "ACEVA Technology",
    ].join("\n"),
  };
}

/**
 * The blueprint itself: the reference, the recommended modules recomputed from
 * the saved context, and fixed next steps. Never the stored module strings,
 * which arrived from the browser.
 */
export function renderBlueprintEmail(direction: SavedDirection): { subject: string; text: string } {
  const reference = plain(direction.pulseId);
  const modules = getRecommendedModules(direction.context?.industry, direction.context, direction.answers ?? []).map(
    (module, index) => `${index + 1}. ${plain(module)}`
  );

  return {
    subject: `Your ACEVA project blueprint (${reference})`,
    text: [
      "Hello,",
      "",
      `Here is the recommended architecture for the project direction saved under PULSE reference ${reference}.`,
      "",
      "--- RECOMMENDED SYSTEM ARCHITECTURE ---",
      ...modules,
      "",
      "Nothing here is a quote or a commitment. It is the shape of the work as Pulse understood it.",
      `Quote ${reference} when you contact the ACEVA team to discuss it or correct anything:`,
      `${siteUrl()}/contact`,
      "",
      "ACEVA Technology",
    ].join("\n"),
  };
}
