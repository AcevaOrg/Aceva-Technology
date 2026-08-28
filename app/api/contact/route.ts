import { NextResponse } from "next/server";
import { Resend } from "resend";
import { CONTACT_LIMITS, validateContact, errorSummary, type ContactFormValues } from "@/lib/validateContact";
import { getClientIp, checkRateLimit, createRateLimitResponse, cleanupRateLimitStore } from "@/lib/rateLimit";
import { checkSpamContent, isDisposableEmail } from "@/lib/spamFilter";

const MAX_BODY_BYTES = 16_384;
const TURNSTILE_TIMEOUT_MS = 5_000;

interface TurnstileResult {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

interface TurnstileDebug {
  success?: boolean;
  errorCodes?: string[];
  hostname?: string;
  expectedHostname?: string;
  action?: string;
  expectedAction?: string;
}

interface TurnstileOutcome {
  valid: boolean;
  // Populated only on failure; surfaced to the client when CONTACT_DEBUG is enabled.
  debug: TurnstileDebug | null;
}

async function verifyTurnstile(token: string, ip: string): Promise<TurnstileOutcome> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const required = process.env.CONTACT_REQUIRE_TURNSTILE === "true";
  if (!secretKey) return { valid: !required, debug: null };
  if (!token) return { valid: false, debug: { errorCodes: ["missing-input-response"] } };

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token, remoteip: ip }),
      cache: "no-store",
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    });
    if (!res.ok) return { valid: false, debug: { errorCodes: [`siteverify-http-${res.status}`] } };

    const data = (await res.json()) as TurnstileResult;
    const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    const expectedAction = process.env.TURNSTILE_EXPECTED_ACTION;
    const valid = data.success === true
      && (!expectedHostname || data.hostname === expectedHostname)
      && (!expectedAction || data.action === expectedAction);
    if (!valid) {
      const debug: TurnstileDebug = {
        success: data.success,
        errorCodes: data["error-codes"],
        hostname: data.hostname,
        expectedHostname,
        action: data.action,
        expectedAction,
      };
      console.error("[contact] Turnstile rejected", debug);
      return { valid: false, debug };
    }
    return { valid: true, debug: null };
  } catch {
    return { valid: false, debug: { errorCodes: ["siteverify-request-failed"] } };
  }
}

const SITUATION_LABEL: Record<ContactFormValues["situation"], string> = {
  new: "Starting something new",
  improve: "Improving my business",
  help: "Already built something, needs help",
};

const SERVICE_LABEL: Record<ContactFormValues["service"], string> = {
  unsure: "Not sure yet",
  digital: "Digital Experiences",
  software: "Custom Software",
  mobile: "Mobile Products",
  intelligence: "Intelligence & Automation",
  rescue: "Product Rescue & Reliability",
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string";
}

export async function POST(request: Request) {
  if (
    process.env.CONTACT_REQUIRE_TURNSTILE === "true"
    && (!process.env.TURNSTILE_SECRET_KEY || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
  ) {
    console.error("[contact] Turnstile is required but its key pair is incomplete");
    return NextResponse.json(
      { ok: false, message: "The contact form is temporarily unavailable. Please email us directly." },
      { status: 503 },
    );
  }

  // Rate limiting by IP
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetAt);
  }
  // Periodic cleanup of old rate limit entries
  if (Math.random() < 0.01) cleanupRateLimitStore();

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, message: "Content-Type must be application/json." }, { status: 415 });
  }

  const expectedOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (expectedOrigin && origin) {
    try {
      if (new URL(origin).origin !== new URL(expectedOrigin).origin) {
        return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ ok: false, message: "Invalid request origin." }, { status: 403 });
    }
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, message: "Request is too large." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, message: "Request is too large." }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  // Honeypot — real visitors never fill this hidden field.
  if (isNonEmptyString(body._gotcha) && body._gotcha.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = isNonEmptyString(body.name) ? body.name.trim() : "";
  const email = isNonEmptyString(body.email) ? body.email.trim().toLowerCase() : "";
  const company = isNonEmptyString(body.company) ? body.company.trim() : "";
  const details = isNonEmptyString(body.details) ? body.details.trim() : "";
  const situation: ContactFormValues["situation"] = ["new", "improve", "help"].includes(body.situation as string)
    ? (body.situation as ContactFormValues["situation"])
    : "new";
  const service: ContactFormValues["service"] = ["unsure", "digital", "software", "mobile", "intelligence", "rescue"].includes(body.service as string)
    ? (body.service as ContactFormValues["service"])
    : "unsure";
  const budgetValues: ContactFormValues["budget"][] = ["", "sprint", "small", "mid", "ongoing"];
  const budget = budgetValues.includes(body.budget as ContactFormValues["budget"])
    ? (body.budget as ContactFormValues["budget"])
    : "";

  const errors = validateContact({ name, email, details });
  if (company.length > CONTACT_LIMITS.company) errors.company = true;
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors, message: errorSummary(errors) }, { status: 400 });
  }

  // Disposable email check
  if (isDisposableEmail(email)) {
    return NextResponse.json(
      { ok: false, message: "Please use a permanent email address." },
      { status: 400 }
    );
  }

  // Spam content filtering
  const spamCheck = checkSpamContent(details);
  if (spamCheck.isSpam) {
    console.warn("[contact] Spam rejected", { score: spamCheck.score, reasons: spamCheck.reasons });
    return NextResponse.json(
      { ok: false, message: "Your message appears to be automated. Please email us directly at acevatech.official@gmail.com." },
      { status: 400 }
    );
  }

  // Cloudflare Turnstile verification
  const turnstileToken = isNonEmptyString(body["cf-turnstile-response"]) ? body["cf-turnstile-response"] : "";
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.valid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Verification failed. Please try again.",
        ...(process.env.CONTACT_DEBUG === "true" && turnstile.debug
          ? { debug: turnstile.debug }
          : {}),
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not set");
    return NextResponse.json(
      { ok: false, message: "We could not send that just now. Email us directly at acevatech.official@gmail.com." },
      { status: 500 },
    );
  }

  const toEmail = process.env.CONTACT_TO_EMAIL || "acevatech.official@gmail.com";
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Aceva Website <onboarding@resend.dev>";

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: `New project inquiry — ${SITUATION_LABEL[situation]}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${company || "—"}`,
        `Situation: ${SITUATION_LABEL[situation]}`,
        `Capability of interest: ${SERVICE_LABEL[service]}`,
        `Budget range: ${budget || "Prefer not to say"}`,
        "",
        "What is the problem, in their own words:",
        details,
      ].join("\n"),
    });
    if (error) {
      console.error("[contact] Resend rejected the request", { name: error.name, message: error.message });
      return NextResponse.json(
        { ok: false, message: "We could not send that just now. Email us directly at acevatech.official@gmail.com." },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[contact] Resend send failed", err);
    return NextResponse.json(
      { ok: false, message: "We could not send that just now. Email us directly at acevatech.official@gmail.com." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
