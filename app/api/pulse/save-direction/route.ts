import { Resend } from "resend";
import { CONTACT_EMAIL } from "@/lib/social";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  methodNotAllowedHandler,
  optionsHandler,
  sanitizeHeaderValue,
} from "@/lib/api/response";
import { isDisposableEmail } from "@/lib/spamFilter";
import { createDirection } from "@/lib/pulse/directionStore";
import { describeDatabaseError } from "@/lib/pulse/db";
import { generatePulseId } from "@/lib/pulse/pulseId";
import { LEAD_LIMITS, validateLeadSubmission } from "@/lib/pulse/leadValidation";
import { getRecommendedModules } from "@/lib/pulse/modules";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { enforceRateLimits, HOUR_MS, MINUTE_MS } from "@/lib/security/sharedRateLimit";
import { readTurnstileToken, verifyPulseTurnstile } from "@/lib/security/turnstile";

/**
 * Saves a visitor's project direction and notifies the team.
 *
 * Hardened on 30 October 2026 (P1):
 *  - The PULSE reference is generated here with a CSPRNG. Any reference the
 *    browser sends is ignored, so IDs cannot be pre-claimed, future-dated or
 *    chosen to collide (red-team R2, R3).
 *  - The write is insert-only (`createDirection`), so no submission, duplicate
 *    or concurrent, can overwrite another record. The old read-then-upsert
 *    ownership check, which two racing requests could both pass, is gone.
 *  - Every field is type-checked and length-limited, and unexpected top-level
 *    fields are refused (R4; limits in lib/pulse/leadValidation.ts).
 *  - Cloudflare Turnstile is verified on the server for action "pulse_save".
 *  - Rate limits are shared across instances and counted per client address
 *    and per contact (R5); if the shared store is down the save is refused.
 *  - The recommended modules are recomputed from the context, so the stored
 *    and emailed list never carries browser-supplied text.
 *  - The team notification defangs links in visitor text, and no log line
 *    carries the visitor's contact details.
 */

const SAVE_LIMITS = {
  perIp: { limit: 5, windowMs: 10 * MINUTE_MS },
  perContact: { limit: 3, windowMs: HOUR_MS },
};

/** Fresh references tried before giving up. A clash needs ~2^20 saves on one day to become likely. */
const MAX_ID_ATTEMPTS = 3;

const SAVE_FAILED =
  "We could not save your project direction just now. Please try again in a moment.";

/**
 * Visitor text for ACEVA's own inbox: one line, bounded, with links made
 * unclickable ("hxxps[://]evil[.]example") so a lead cannot phish the team.
 */
function forTeam(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)
    .replace(/\b(h)tt(ps?):\/\//gi, "$1xx$2[://]")
    .replace(/\bwww\./gi, "www[.]")
    .replace(/\.(com|net|org|io|co|app|dev|xyz|info|biz|me|ly|example)\b/gi, "[.]$1") || fallback;
}

export const POST = withRouteErrorHandling("pulse-save-direction", async (request, requestId) => {
  const ip = getTrustedClientIp(request);

  // 1. Shared per-address limit, before any body is read.
  await enforceRateLimits("pulse-save", [{ dimension: "ip", value: ip, ...SAVE_LIMITS.perIp }], {
    onStoreError: "deny",
  });

  // 2. Same origin, JSON only, bounded body.
  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readJsonObjectBody(request, { maxBytes: LEAD_LIMITS.bodyBytes });

  // 3. Strict validation. Field flags only; no values echoed or logged.
  const validation = validateLeadSubmission(body);
  if (!validation.ok) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Please check your details — some required fields are missing or incorrect.", errors: validation.errors },
      { fields: Object.keys(validation.errors) }
    );
  }
  const { lead, context, answers, contactIsEmail } = validation.value;

  // 4. Turnstile, server-side.
  const turnstileFailure = await verifyPulseTurnstile(readTurnstileToken(body), {
    action: "pulse_save",
    ip,
    requestId,
  });
  if (turnstileFailure) throw new ApiError(turnstileFailure, {}, { reason: "turnstile" });

  // 5. Disposable addresses.
  if (contactIsEmail && isDisposableEmail(lead.contact.toLowerCase())) {
    throw new ApiError(
      "DISPOSABLE_EMAIL",
      { message: "Please use your real work email address so we can reply to you." },
      { reason: "disposable-email" }
    );
  }

  // 6. Shared per-contact limit, so one address cannot be flooded from many clients.
  await enforceRateLimits(
    "pulse-save",
    [{ dimension: "email", value: lead.contact.toLowerCase(), ...SAVE_LIMITS.perContact }],
    { onStoreError: "deny" }
  );

  // 7. Insert under a fresh server-generated reference. Insert-only: a clash
  //    returns false and a new reference is drawn; nothing is ever overwritten.
  const recommendedModules = getRecommendedModules(context?.industry, context, answers);
  const createdAt = new Date().toISOString();
  let pulseId: string | null = null;

  try {
    for (let attempt = 1; attempt <= MAX_ID_ATTEMPTS && !pulseId; attempt++) {
      const candidate = generatePulseId();
      const inserted = await createDirection({
        pulseId: candidate,
        lead,
        context,
        answers,
        recommendedModules,
        createdAt,
      });
      if (inserted) pulseId = candidate;
    }
  } catch (error) {
    // Operation, failure category and SQLSTATE only: never the driver message,
    // which can quote submitted values or the database host.
    const failure = describeDatabaseError(error);
    console.error(`[pulse-save-direction][${requestId}] direction store failed`, failure);
    throw new ApiError("SERVICE_UNAVAILABLE", { message: SAVE_FAILED }, {
      reason: "direction-store-write-failed",
      operation: failure.operation,
      category: failure.category,
      ...(failure.code ? { sqlstate: failure.code } : {}),
    });
  }

  if (!pulseId) {
    console.error(`[pulse-save-direction][${requestId}] no free reference after ${MAX_ID_ATTEMPTS} attempts`);
    throw new ApiError("SERVICE_UNAVAILABLE", { message: SAVE_FAILED }, { reason: "reference-attempts-exhausted" });
  }

  // 8. Notify the team. Failure here does not fail the save.
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "ACEVA PULSE <onboarding@resend.dev>";

  if (apiKey) {
    const emailLines: string[] = [
      `=== ACEVA PULSE PROJECT DIRECTION SUBMISSION ===`,
      `PULSE Reference ID: ${pulseId}`,
      `Date & Time: ${createdAt}`,
      ``,
      `--- VISITOR CONTACT DETAILS ---`,
      `Name: ${forTeam(lead.name, "Not specified")}`,
      `Contact: ${forTeam(lead.contact, "Not specified")}`,
      `Preferred Method: ${lead.method}`,
      ``,
      `--- MAPPED PROJECT CONTEXT (visitor text; links defanged) ---`,
      `Primary Intent: ${forTeam(context?.intent, "Not specified")}`,
      `Industry Focus: ${forTeam(context?.industry, "General Business")}`,
      `Business Details: ${forTeam(context?.business, "Not specified")}`,
      `Current System State: ${forTeam(context?.current, "Not specified")}`,
      `Friction Points: ${forTeam(context?.friction?.join(", "), "None listed")}`,
      `Target Goals: ${forTeam(context?.goals?.join(", "), "None listed")}`,
      `Operation Scale: ${forTeam(context?.scale, "Not specified")}`,
      `Market: ${forTeam(context?.market, "Not specified")}`,
      `Timeline: ${forTeam(context?.timeline, "Flexible")}`,
      `Budget: ${forTeam(context?.budget, "To be discussed")}`,
      ``,
      `--- RECOMMENDED SYSTEM ARCHITECTURE ---`,
      ...recommendedModules.map((mod, i) => `  ${i + 1}. ${mod}`),
      ``,
      `==================================================`,
      `Submitted via official PULSE AI Assistant on ACEVA Technology platform.`,
    ];

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        replyTo: contactIsEmail ? lead.contact : undefined,
        subject: sanitizeHeaderValue(`[PULSE Lead] New Project Direction from ${forTeam(lead.name, "a visitor")}`),
        text: emailLines.join("\n"),
      });
      if (error) {
        console.error(`[pulse-save-direction][${requestId}] Resend rejection`, { name: error.name });
      }
    } catch {
      console.error(`[pulse-save-direction][${requestId}] Exception sending email`);
    }
  } else {
    console.log(`[pulse-save-direction][${requestId}] RESEND_API_KEY not set — direction saved but not emailed`);
  }

  return apiSuccess({ pulseId });
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
