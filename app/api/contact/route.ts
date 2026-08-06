import { NextResponse } from "next/server";
import { Resend } from "resend";
import { validateContact, errorSummary, type ContactFormValues } from "@/lib/validateContact";

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
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  // Honeypot — real visitors never fill this hidden field.
  if (isNonEmptyString(body._gotcha) && body._gotcha.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = isNonEmptyString(body.name) ? body.name : "";
  const email = isNonEmptyString(body.email) ? body.email : "";
  const company = isNonEmptyString(body.company) ? body.company : "";
  const details = isNonEmptyString(body.details) ? body.details : "";
  const situation: ContactFormValues["situation"] = ["new", "improve", "help"].includes(body.situation as string)
    ? (body.situation as ContactFormValues["situation"])
    : "new";
  const service: ContactFormValues["service"] = ["unsure", "digital", "software", "mobile", "intelligence", "rescue"].includes(body.service as string)
    ? (body.service as ContactFormValues["service"])
    : "unsure";
  const budget = isNonEmptyString(body.budget) ? body.budget : "";

  const errors = validateContact({ name, email, details });
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors, message: errorSummary(errors) }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not set");
    return NextResponse.json(
      { ok: false, message: "We could not send that just now. Email us directly at acevatechnology@gmail.com." },
      { status: 500 },
    );
  }

  const toEmail = process.env.CONTACT_TO_EMAIL || "acevatechnology@gmail.com";
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "Aceva Website <onboarding@resend.dev>";

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
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
  } catch (err) {
    console.error("[contact] Resend send failed", err);
    return NextResponse.json(
      { ok: false, message: "We could not send that just now. Email us directly at acevatechnology@gmail.com." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
