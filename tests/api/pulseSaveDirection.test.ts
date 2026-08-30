import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { POST } from "@/app/api/pulse/save-direction/route";

function createSaveDirectionRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/pulse/save-direction", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const validPayload = {
  pulseId: "PLS-260826-883",
  lead: {
    name: "Jordan Ellis",
    contact: "jordan@example.com",
    method: "Email",
  },
  context: {
    intent: "Automate something",
    industry: "Logistics",
    business: "Distributed operation",
    friction: ["Dispatch visibility"],
    goals: ["Live operations"],
  },
  recommendedModules: ["Dispatch control tower", "Fleet tracking & visibility"],
};

describe("POST /api/pulse/save-direction Route Handler", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("CONTACT_TO_EMAIL", "acevatech.official@gmail.com");
    send.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  it("submits direction successfully and emails ACEVA team", async () => {
    const response = await POST(createSaveDirectionRequest(validPayload));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.pulseId).toBe("PLS-260826-883");
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "acevatechnology@gmail.com",
        subject: expect.stringContaining("Jordan Ellis"),
        replyTo: "jordan@example.com",
      })
    );
  });

  it("rejects request missing lead name or contact", async () => {
    const response = await POST(
      createSaveDirectionRequest({ ...validPayload, lead: { name: "", contact: "" } })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain("Please check your details");
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects disposable email addresses", async () => {
    const response = await POST(
      createSaveDirectionRequest({
        ...validPayload,
        lead: { ...validPayload.lead, contact: "fake@mailinator.com" },
      })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.ok).toBe(false);
    expect(data.message).toContain("Please use your real work email address");
    expect(send).not.toHaveBeenCalled();
  });
});
