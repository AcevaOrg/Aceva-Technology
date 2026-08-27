import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getClientIp, checkRateLimit, createRateLimitResponse } from "@/lib/rateLimit";
import { isDisposableEmail } from "@/lib/spamFilter";
import { saveDirection } from "@/lib/pulse/directionStore";

interface PulseLeadPayload {
  pulseId: string;
  lead: {
    name: string;
    contact: string;
    method: "Email" | "Phone" | "Text";
  };
  context?: {
    intent?: string;
    industry?: string;
    business?: string;
    current?: string;
    scale?: string;
    market?: string;
    friction?: string[];
    goals?: string[];
    timeline?: string;
  };
  answers?: string[];
  recommendedModules?: string[];
}

export async function POST(request: Request) {
  // Rate limiting by IP (5 submissions per minute)
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`pulse-${ip}`);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetAt);
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, message: "Content-Type must be application/json." }, { status: 415 });
  }

  let payload: PulseLeadPayload;
  try {
    const rawBody = await request.text();
    payload = JSON.parse(rawBody) as PulseLeadPayload;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const { pulseId, lead, context, recommendedModules } = payload;

  if (!pulseId || typeof pulseId !== "string") {
    return NextResponse.json({ ok: false, message: "Missing or invalid 'pulseId'." }, { status: 400 });
  }

  if (!lead || typeof lead !== "object" || !lead.name?.trim() || !lead.contact?.trim()) {
    return NextResponse.json(
      { ok: false, message: "Name and contact information are required." },
      { status: 400 }
    );
  }

  const name = lead.name.trim();
  const contact = lead.contact.trim();
  const method = lead.method || "Email";

  // Check if contact looks like an email and validate disposable emails
  const isEmail = contact.includes("@") && contact.includes(".");
  if (isEmail && isDisposableEmail(contact.toLowerCase())) {
    return NextResponse.json(
      { ok: false, message: "Please provide a permanent email address or phone number." },
      { status: 400 }
    );
  }

  // Persist direction to directionStore for lookup via pulseId
  saveDirection({
    pulseId,
    lead: { name, contact, method },
    context,
    answers: payload.answers,
    recommendedModules,
    createdAt: new Date().toISOString(),
  });

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL || "acevatechnology@gmail.com";
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "ACEVA PULSE <onboarding@resend.dev>";

  // Format email content
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
    `Target Goals: ${context?.goals || "None listed"}`,
    `Timeline: ${context?.timeline || "Flexible"}`,
    ``,
    `--- RECOMMENDED SYSTEM ARCHITECTURE ---`,
  ];

  if (recommendedModules && recommendedModules.length > 0) {
    recommendedModules.forEach((mod, idx) => {
      emailLines.push(`  ${idx + 1}. ${mod}`);
    });
  } else {
    emailLines.push(`  - Custom ACEVA Digital System Solution`);
  }

  emailLines.push(
    ``,
    `==================================================`,
    `Submitted via official PULSE AI Assistant on ACEVA Technology platform.`
  );

  const fullEmailBody = emailLines.join("\n");

  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({
        from: fromEmail,
        to: toEmail,
        replyTo: isEmail ? contact : undefined,
        subject: `[PULSE Lead ${pulseId}] New Project Direction from ${name}`,
        text: fullEmailBody,
      });

      if (error) {
        console.error("[pulse-save-direction] Resend rejection:", error);
      } else {
        console.log(`[pulse-save-direction] Successfully sent lead ${pulseId} to ${toEmail}`);
      }
    } catch (err) {
      console.error("[pulse-save-direction] Exception sending email:", err);
    }
  } else {
    console.log(`[pulse-save-direction] RESEND_API_KEY unconfigured. Outputting direction log:\n${fullEmailBody}`);
  }

  return NextResponse.json({
    ok: true,
    pulseId,
    message: "Project direction successfully saved and submitted to ACEVA Technology.",
  });
}
