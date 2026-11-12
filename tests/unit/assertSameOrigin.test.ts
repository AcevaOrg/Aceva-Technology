import { describe, expect, it } from "vitest";
import { ApiError, assertSameOrigin } from "@/lib/api/response";

/**
 * The origin guard stops other sites from posting to our routes with a visitor's cookies. It compares the
 * Origin header with the request's own address, and also accepts an Origin that matches the Host header,
 * because `next dev --hostname 127.0.0.1` rebuilds `request.url` as "localhost" while the browser keeps
 * sending the address it actually typed.
 */

function post(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers });
}

function refusal(request: Request): ApiError | null {
  try {
    assertSameOrigin(request);
    return null;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
}

describe("assertSameOrigin", () => {
  it("allows requests with no Origin header (non-browser clients)", () => {
    expect(refusal(post("https://aceva.test/api/x", {}))).toBeNull();
  });

  it("allows an Origin equal to the request address", () => {
    expect(refusal(post("https://aceva.test/api/x", { origin: "https://aceva.test" }))).toBeNull();
  });

  it("refuses another site, even when it names itself in Host", () => {
    expect(refusal(post("https://aceva.test/api/x", { origin: "https://evil.example", host: "aceva.test" }))?.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("refuses the same host name on another scheme or port", () => {
    expect(refusal(post("https://aceva.test/api/x", { origin: "http://aceva.test", host: "aceva.test" }))?.code).toBe("FORBIDDEN_ORIGIN");
    expect(refusal(post("https://aceva.test/api/x", { origin: "https://aceva.test:8443", host: "aceva.test" }))?.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("allows an Origin that matches Host when request.url was rebuilt with another host name", () => {
    // What `next dev --hostname 127.0.0.1` produces: url says localhost, the browser is on 127.0.0.1.
    const request = post("http://localhost:3100/api/x", { origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" });
    expect(refusal(request)).toBeNull();
  });

  it("still refuses a foreign Origin on that loopback setup", () => {
    const request = post("http://localhost:3100/api/x", { origin: "https://evil.example", host: "127.0.0.1:3100" });
    expect(refusal(request)?.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("refuses an unparsable Origin", () => {
    expect(refusal(post("https://aceva.test/api/x", { origin: "not a url" }))?.code).toBe("FORBIDDEN_ORIGIN");
  });
});
