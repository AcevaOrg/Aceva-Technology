import { Resend } from "resend";
import { CONTACT_EMAIL } from "@/lib/social";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  readString,
  readEnum,
  logRouteError,
  methodNotAllowedHandler,
  optionsHandler,
} from "@/lib/api/response";
import { getClientIp, checkRateLimit, cleanupRateLimitStore } from "@/lib/rateLimit";
import { isDisposableEmail } from "@/lib/spamFilter";
import { getDirection, saveDirection, type SavedDirection } from "@/lib/pulse/directionStore";
import { sanitizeHeaderValue } from "@/lib/api/response";

const MAX_BODY_BYTES = 16_384;

/** A PULSE reference code: PLS-YYMMDD-NNN. Anything else is rejected outright. */
const PULSE_ID_PATTERN = /^PLS-\d{6}-\d{3}$/;

type ContactMethod = "Email" | "Phone" | "Text";

export const POST = withRouteErrorHandling("pulse-save-direction", async (request, requestId) => {
  // 1. Rate limiting
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit("pulse-save-direction", ip);
  if (!rateLimit.allowed) {
    throw new ApiError("RATE_LIMITED", { retryAfter: rateLimit.retryAfter }, { ip });
  }
  if (Math.random() < 0.05) cleanupRateLimitStore();

  // 2. Reject cross-origin and non-JSON callers before touching the body.
  //
  // This was the only write route without the origin guard — /api/chat,
  // /api/contact and /api/pulse/email-blueprint all had it. Without it a page
  // on any other origin could post a lead to this endpoint, which stores the
  // visitor's name and contact details and sends mail to the team.
  assertSameOrigin(request);
  assertJsonContentType(request);

  // 3. Read bounded body
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });

  // 4. Validate required fields — no internal detail in error responses
  const pulseId = readString(body.pulseId, 100).toUpperCase();
  if (!PULSE_ID_PATTERN.test(pulseId)) {
    console.warn(`[pulse-save-direction][${requestId}] missing or malformed pulseId`);
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Please check your details — some required fields are missing or incorrect." },
      { field: "pulseId" }, // server log only
    );
  }

  const leadRaw = body.lead;
  if (!leadRaw || typeof leadRaw !== "object" || Array.isArray(leadRaw)) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Please check your details — some required fields are missing or incorrect." },
      { field: "lead" },
    );
  }
  const leadObj = leadRaw as Record<string, unknown>;
  const name    = readString(leadObj.name,    200);
  const contact = readString(leadObj.contact, 200);
  const method  = readEnum<ContactMethod>(leadObj.method, ["Email", "Phone", "Text"], "Email");

  if (!name || !contact) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Please check your details — some required fields are missing or incorrect." },
      { missingFields: [!name ? "name" : null, !contact ? "contact" : null].filter(Boolean) },
    );
  }

  // 5. Disposable email guard
  const isEmail = contact.includes("@") && contact.includes(".");
  if (isEmail && isDisposableEmail(contact.toLowerCase())) {
    throw new ApiError(
      "DISPOSABLE_EMAIL",
      { message: "Please use your real work email address so we can reply to you." },
      { contact },
    );
  }

  // 5b. A PULSE ID already in use may only be re-saved by the same lead. The ids
  // are short and guessable, so without this check anyone could overwrite another
  // visitor's stored direction by posting their own details under its reference.
  // Both outcomes return the same generic validation failure, so a caller cannot
  // use this endpoint to discover which ids exist.
  let existing: SavedDirection | null;
  try {
    existing = await getDirection(pulseId);
  } catch (error) {
    logRouteError("pulse-save-direction", requestId, error, { pulseId, reason: "ownership-check-read-failed" });
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      { message: "We could not save your project direction just now. Please try again in a moment." },
      { pulseId, reason: "ownership-check-read-failed" },
    );
  }

  if (existing && existing.lead.contact.trim().toLowerCase() !== contact.toLowerCase()) {
    throw new ApiError(
      "VALIDATION_FAILED",
      { message: "Please check your details — some required fields are missing or incorrect." },
      { pulseId, reason: "pulse-id-owned-by-another-lead" },
    );
  }

  // 6. Extract optional context fields
  const contextRaw = body.context && typeof body.context === "object" && !Array.isArray(body.context)
    ? (body.context as Record<string, unknown>)
    : undefined;

  const context = contextRaw
    ? {
        intent:   readString(contextRaw.intent,   500),
        industry: readString(contextRaw.industry, 200),
        business: readString(contextRaw.business, 500),
        current:  readString(contextRaw.current,  500),
        scale:    readString(contextRaw.scale,    200),
        market:   readString(contextRaw.market,   200),
        friction: Array.isArray(contextRaw.friction)
          ? (contextRaw.friction as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 10)
          : [],
        goals: Array.isArray(contextRaw.goals)
          ? (contextRaw.goals as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 10)
          : [],
        timeline: readString(contextRaw.timeline, 200),
        budget:   readString(contextRaw.budget,   200),
      }
    : undefined;

  const recommendedModules = Array.isArray(body.recommendedModules)
    ? (body.recommendedModules as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 20)
    : undefined;

  const answers = Array.isArray(body.answers)
    ? (body.answers as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 50)
    : undefined;

  // 7. Persist to direction store. A failed write must never be reported as a
  // success: the visitor would leave with a PULSE ID that resolves to nothing
  // and the team would never receive the lead, so stop before the email.
  try {
    await saveDirection({
      pulseId,
      lead: { name, contact, method },
      context,
      answers,
      recommendedModules,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    logRouteError("pulse-save-direction", requestId, error, { pulseId });
    throw new ApiError(
      "SERVICE_UNAVAILABLE",
      { message: "We could not save your project direction just now. Please try again in a moment." },
      { pulseId, reason: "direction-store-write-failed" },
    );
  }

  // 8. Send email (non-blocking on failure — direction is already saved)
  const apiKey   = process.env.RESEND_API_KEY;
  const toEmail  = process.env.CONTACT_TO_EMAIL  || CONTACT_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "ACEVA PULSE <onboarding@resend.dev>";

  if (apiKey) {
    const emailLines: string[] = [
      `=== ACEVA PULSE PROJECT DIRECTION SUBMISSION ===`,
      `PULSE Reference ID: ${pulseId}`,
      `Date & Time: ${new Date().toISOString()}`,
      ``,
      `--- VISITOR CONTACT DETAILS ---`,
      `Name: ${name}`,
      `Contact: ${contact}`,
      `Preferred Method: ${method}`,
      ``,
      `--- MAPPED PROJECT CONTEXT ---`,
      `Primary Intent: ${context?.intent || "Not specified"}`,
      `Industry Focus: ${context?.industry || "General Business"}`,
      `Business Details: ${context?.business || "Not specified"}`,
      `Current System State: ${context?.current || "Not specified"}`,
      `Friction Points: ${context?.friction?.join(", ") || "None listed"}`,
      `Target Goals: ${Array.isArray(context?.goals) ? context.goals.join(", ") : "None listed"}`,
      `Operation Scale: ${context?.scale || "Not specified"}`,
      `Market: ${context?.market || "Not specified"}`,
      `Timeline: ${context?.timeline || "Flexible"}`,
      // Scale, market and budget were collected by the wizard but left out of
      // this email, so the qualification fields the team acts on never arrived.
      `Budget: ${context?.budget || "To be discussed"}`,
      ``,
      `--- RECOMMENDED SYSTEM ARCHITECTURE ---`,
      ...(recommendedModules && recommendedModules.length > 0
        ? recommendedModules.map((mod, i) => `  ${i + 1}. ${mod}`)
        : [`  - Custom ACEVA Digital System Solution`]),
      ``,
      `==================================================`,
      `Submitted via official PULSE AI Assistant on ACEVA Technology platform.`,
    ];

    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        replyTo: isEmail ? contact : undefined,
        subject: sanitizeHeaderValue(`[PULSE Lead] New Project Direction from ${name}`),
        text: emailLines.join("\n"),
      });
      if (error) {
        // Email failure is logged but does not fail the request — direction is already saved.
        console.error(`[pulse-save-direction][${requestId}] Resend rejection`, {
          name: error.name,
          // message intentionally omitted — may contain API detail
        });
      }
    } catch {
      console.error(`[pulse-save-direction][${requestId}] Exception sending email`);
    }
  } else {
    console.log(`[pulse-save-direction][${requestId}] RESEND_API_KEY not set — direction saved but not emailed`);
  }

  return apiSuccess({ pulseId });
});

export const GET  = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
