import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  MAX_SESSION_SECONDS,
  MIN_PASSKEY_LENGTH,
  getAdminCookieName,
  getAdminCookieOptions,
  getAdminPasskey,
  getMaxUploadBytes,
  getSessionSecret,
  getSessionTtlSeconds,
  isAdminEnabled,
  isAdminSurfacePath,
  isOpenAdminPath,
  normalizeAdminPath,
} from "@/lib/admin/config";
import { MAX_PRIMARY_BYTES } from "@/lib/documents/types";

const KEY = "k".repeat(MIN_PASSKEY_LENGTH);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pass key", () => {
  it("is null when unset, empty or whitespace", () => {
    vi.stubEnv("ADMIN_PASSKEY", "");
    expect(getAdminPasskey()).toBeNull();
    expect(isAdminEnabled()).toBe(false);
    vi.stubEnv("ADMIN_PASSKEY", "   \n ");
    expect(getAdminPasskey()).toBeNull();
  });

  it("requires at least 8 characters after trimming", () => {
    expect(MIN_PASSKEY_LENGTH).toBe(8);
    vi.stubEnv("ADMIN_PASSKEY", "k".repeat(MIN_PASSKEY_LENGTH - 1));
    expect(getAdminPasskey()).toBeNull();
    expect(isAdminEnabled()).toBe(false);

    vi.stubEnv("ADMIN_PASSKEY", `  ${"k".repeat(MIN_PASSKEY_LENGTH - 1)}  `);
    expect(isAdminEnabled()).toBe(false);

    vi.stubEnv("ADMIN_PASSKEY", KEY);
    expect(getAdminPasskey()).toBe(KEY);
    expect(isAdminEnabled()).toBe(true);
  });

  it("trims surrounding whitespace from the stored value", () => {
    vi.stubEnv("ADMIN_PASSKEY", `\n  ${KEY}  \n`);
    expect(getAdminPasskey()).toBe(KEY);
  });
});

describe("session secret", () => {
  it("is ignored unless it has at least 32 characters", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(31));
    expect(getSessionSecret()).toBeNull();
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(32));
    expect(getSessionSecret()).toBe("s".repeat(32));
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(getSessionSecret()).toBeNull();
  });
});

describe("getSessionTtlSeconds", () => {
  it.each([
    [undefined, 8 * 3600],
    ["", 8 * 3600],
    ["abc", 8 * 3600],
    ["NaN", 8 * 3600],
    ["Infinity", 8 * 3600],
    ["1", 3600],
    ["12", 12 * 3600],
    ["72", 72 * 3600],
    ["0", 3600],
    ["-5", 3600],
    ["73", 72 * 3600],
    ["100000", 72 * 3600],
    ["2.9", 2 * 3600],
    [" 6 ", 6 * 3600],
  ])("ADMIN_SESSION_HOURS=%j gives %j seconds", (raw, expected) => {
    if (raw === undefined) vi.stubEnv("ADMIN_SESSION_HOURS", undefined);
    else vi.stubEnv("ADMIN_SESSION_HOURS", raw);
    expect(getSessionTtlSeconds()).toBe(expected);
  });

  it("never exceeds the maximum session length", () => {
    vi.stubEnv("ADMIN_SESSION_HOURS", "9999");
    expect(getSessionTtlSeconds()).toBeLessThanOrEqual(MAX_SESSION_SECONDS);
  });
});

describe("getMaxUploadBytes", () => {
  it("defaults to the primary file cap", () => {
    vi.stubEnv("ADMIN_MAX_UPLOAD_MB", undefined);
    expect(getMaxUploadBytes()).toBe(MAX_PRIMARY_BYTES);
  });

  it.each([
    ["1", 1024 * 1024],
    ["2", 2 * 1024 * 1024],
    ["3", 3 * 1024 * 1024],
    ["0", 1024 * 1024],
    ["-1", 1024 * 1024],
    ["abc", MAX_PRIMARY_BYTES],
    ["", MAX_PRIMARY_BYTES],
  ])("ADMIN_MAX_UPLOAD_MB=%j gives %j bytes", (raw, expected) => {
    vi.stubEnv("ADMIN_MAX_UPLOAD_MB", raw);
    expect(getMaxUploadBytes()).toBe(expected);
  });

  it.each(["4", "5", "10", "1000", "Infinity"])("never goes above MAX_PRIMARY_BYTES (ADMIN_MAX_UPLOAD_MB=%s)", (raw) => {
    vi.stubEnv("ADMIN_MAX_UPLOAD_MB", raw);
    expect(getMaxUploadBytes()).toBeLessThanOrEqual(MAX_PRIMARY_BYTES);
    expect(getMaxUploadBytes()).toBeGreaterThanOrEqual(1024 * 1024);
  });
});

describe("cookie", () => {
  it("uses the __Host- prefix only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getAdminCookieName()).toBe("__Host-aceva_admin_session");
    vi.stubEnv("NODE_ENV", "development");
    expect(getAdminCookieName()).toBe("aceva_admin_session");
    vi.stubEnv("NODE_ENV", "test");
    expect(getAdminCookieName()).toBe("aceva_admin_session");
    // Frozen at import; under vitest NODE_ENV is "test".
    expect(ADMIN_COOKIE_NAME).toBe("aceva_admin_session");
  });

  it("sets HttpOnly, SameSite=strict and Path=/ always, Secure only in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(getAdminCookieOptions(120)).toEqual({ httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 120 });
    vi.stubEnv("NODE_ENV", "development");
    expect(getAdminCookieOptions(120)).toEqual({ httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 120 });
  });

  it("defaults maxAge to the configured session lifetime", () => {
    vi.stubEnv("ADMIN_SESSION_HOURS", "3");
    expect(getAdminCookieOptions().maxAge).toBe(3 * 3600);
  });
});

describe("admin paths", () => {
  it("normalises case and exactly one trailing slash", () => {
    expect(normalizeAdminPath("/Admin/Login/")).toBe("/admin/login");
    expect(normalizeAdminPath("/admin/login//")).toBe("/admin/login/");
    expect(normalizeAdminPath("/")).toBe("/");
  });

  it("recognises the admin surface in any letter case", () => {
    for (const path of ["/admin", "/ADMIN", "/admin/", "/admin/x", "/api/admin", "/API/Admin/x"]) {
      expect(isAdminSurfacePath(path), path).toBe(true);
    }
    for (const path of ["/", "/administrator", "/adminx", "/api/administrator", "/mobile", "/about/admin"]) {
      expect(isAdminSurfacePath(path), path).toBe(false);
    }
  });

  it("opens exactly four paths", () => {
    for (const path of ["/admin/login", "/admin/login/", "/ADMIN/LOGIN", "/api/admin/login", "/api/admin/logout", "/api/admin/session/"]) {
      expect(isOpenAdminPath(path), path).toBe(true);
    }
    for (const path of [
      "/admin",
      "/admin/",
      "/admin/documents",
      "/admin/login//",
      "/admin//login",
      "/admin/login/x",
      "/admin/loginx",
      "/admin/login.json",
      "/admin/%6Cogin",
      "/admin/login%2F",
      "/api/admin",
      "/api/admin/logins",
      "/api/admin/login/x",
      "/api/admin/documents",
      "//admin/login",
      "/x/admin/login",
    ]) {
      expect(isOpenAdminPath(path), path).toBe(false);
    }
  });
});
