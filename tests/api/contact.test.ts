import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { POST } from "@/app/api/contact/route";

const validBody = {
  name: "Jordan Ellis",
  email: "jordan@example.com",
  company: "Example Co",
  situation: "new",
  service: "software",
  budget: "mid",
  details: "We need help rebuilding our customer portal this quarter.",
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID(), ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("CONTACT_REQUIRE_TURNSTILE", "false");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_FROM_EMAIL", "Aceva <website@example.com>");
    vi.stubEnv("CONTACT_TO_EMAIL", "team@example.com");
    send.mockReset();
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  it("sends a valid enquiry", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: validBody.email }));
  });

  it("rejects invalid input without sending email", async () => {
    const response = await POST(request({ ...validBody, email: "not-an-email" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain("Please check your details");
    expect(send).not.toHaveBeenCalled();
  });

  it("accepts honeypot submissions silently", async () => {
    const response = await POST(request({ ...validBody, _gotcha: "bot value" }));
    expect(response.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects unsupported content types", async () => {
    const response = await POST(new Request("https://example.com/api/contact", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-forwarded-for": crypto.randomUUID() },
      body: "hello",
    }));
    expect(response.status).toBe(415);
  });

  it("accepts the deployed request origin even when the canonical URL differs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const response = await POST(request(validBody, { origin: "https://example.com" }));
    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects a cross-origin submission", async () => {
    const response = await POST(request(validBody, { origin: "https://attacker.example" }));
    expect(response.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("reports an email-provider rejection", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "Rejected" } });
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });
});
