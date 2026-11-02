import { Resend } from "resend";
import {
  withRouteErrorHandling,
  apiSuccess,
  ApiError,
  assertSameOrigin,
  assertJsonContentType,
  readJsonObjectBody,
  sanitizeHeaderValue,
  logRouteError,
  methodNotAllowedHandler,
  optionsHandler,
} from "@/lib/api/response";
import { getDirection } from "@/lib/pulse/directionStore";
import { renderBlueprintEmail, validateRecipient } from "@/lib/pulse/blueprintEmail";
import { getVerificationStore, hashToken, isWellFormedToken } from "@/lib/pulse/emailVerification";
import { PULSE_FEATURES } from "@/lib/pulse/features";
import { getTrustedClientIp } from "@/lib/security/clientIp";
import { enforceRateLimits, HOUR_MS } from "@/lib/security/sharedRateLimit";

/**
 * Step 2 of emailing a blueprint: the visitor opened the confirmation link.
 *
 * The token arrives in the request body (the page reads it from the URL
 * fragment, which never reaches a server log). It is redeemed with one atomic
 * conditional UPDATE, so it works exactly once even if two tabs submit it at
 * the same instant, and an expired, used, unknown or malformed token gets the
 * same refusal. The blueprint is a fixed template sent to the stored address.
 * Still switched off with the rest of blueprint email.
 */

const MAX_BODY_BYTES = 512;
const INVALID_LINK = "This link is invalid or has expired. Please request a new one.";

export const POST = withRouteErrorHandling("pulse-email-confirm", async (request, requestId) => {
  if (!PULSE_FEATURES.blueprintEmail) {
    throw new ApiError("FEATURE_DISABLED", {}, { reason: "blueprint-email-disabled" });
  }

  const ip = getTrustedClientIp(request);
  await enforceRateLimits("pulse-email-confirm", [{ dimension: "ip", value: ip, limit: 10, windowMs: HOUR_MS }], {
    onStoreError: "deny",
  });

  assertSameOrigin(request);
  assertJsonContentType(request);
  const body = await readJsonObjectBody(request, { maxBytes: MAX_BODY_BYTES });
  if (Object.keys(body).some((key) => key !== "token") || !isWellFormedToken(body.token)) {
    throw new ApiError("VALIDATION_FAILED", { message: INVALID_LINK }, { reason: "malformed-token" });
  }

  let pulseId: string | null;
  try {
    pulseId = await getVerificationStore().redeem(hashToken(body.token), new Date());
  } catch (error) {
    logRouteError("pulse-email-confirm", requestId, error, { reason: "verification-store-failed" });
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "Please try the link again in a few minutes." }, {
      reason: "verification-store-failed",
    });
  }
  if (!pulseId) throw new ApiError("VALIDATION_FAILED", { message: INVALID_LINK }, { reason: "token-not-redeemable" });

  let direction;
  try {
    direction = await getDirection(pulseId);
  } catch (error) {
    logRouteError("pulse-email-confirm", requestId, error, { reason: "direction-read-failed" });
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "Please try the link again in a few minutes." }, {
      reason: "direction-read-failed",
    });
  }

  const recipient = validateRecipient(direction?.lead.contact);
  if (!direction || !recipient) {
    throw new ApiError("VALIDATION_FAILED", { message: INVALID_LINK }, { reason: "direction-unavailable" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    throw new ApiError("SERVICE_UNAVAILABLE", { message: "Email delivery is not configured right now." }, {
      reason: "email-not-configured",
    });
  }

  const { subject, text } = renderBlueprintEmail(direction);
  const { error } = await new Resend(apiKey).emails.send({
    from: fromEmail,
    to: recipient,
    subject: sanitizeHeaderValue(subject),
    text,
  });
  if (error) {
    console.error(`[pulse-email-confirm][${requestId}] Resend rejection`, { name: error.name });
    throw new ApiError("UPSTREAM_ERROR", { message: "We could not send that email just now." }, { reason: "resend-rejected" });
  }

  return apiSuccess({ sent: true });
});

export const GET = methodNotAllowedHandler(["POST"]);
export const HEAD = methodNotAllowedHandler(["POST"]);
export const OPTIONS = optionsHandler(["POST"]);
