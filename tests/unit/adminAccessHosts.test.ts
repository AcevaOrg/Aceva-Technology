import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_PASSKEY_LENGTH, getAllowedAdminHosts, isAdminRequestHostAllowed, isCanonicalAdminPath } from "@/lib/admin/config";
import {
  LOOPBACK_HOSTS,
  isHostAllowed,
  normalizeHost,
  parseHostList,
  readRequestHost,
  type HeaderReader,
} from "@/lib/admin/hosts";

function headers(values: Record<string, string>): HeaderReader {
  const lower = new Map(Object.entries(values).map(([name, value]) => [name.toLowerCase(), value]));
  return { get: (name) => lower.get(name.toLowerCase()) ?? null };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pass key floor", () => {
  it("is eight characters", () => {
    expect(MIN_PASSKEY_LENGTH).toBe(8);
  });
});

describe("normalizeHost", () => {
  it.each([
    ["acevatech.com", "acevatech.com"],
    ["ACEVATECH.COM", "acevatech.com"],
    ["WwW.AcevaTech.Com", "www.acevatech.com"],
    ["acevatech.com:443", "acevatech.com"],
    ["acevatech.com:3000", "acevatech.com"],
    ["acevatech.com.", "acevatech.com"],
    ["ACEVATECH.COM.:8080", "acevatech.com"],
    ["  acevatech.com  ", "acevatech.com"],
    ["acevatech.com\n", "acevatech.com"], // a pasted env value often ends in a newline
    ["acevatech.com:", "acevatech.com"],
    ["localhost", "localhost"],
    ["localhost:3000", "localhost"],
    ["intranet", "intranet"],
    ["xn--bcher-kva.example", "xn--bcher-kva.example"],
    ["a-b.c-d.example", "a-b.c-d.example"],
    ["127.0.0.1", "127.0.0.1"],
    ["127.0.0.1:3000", "127.0.0.1"],
    ["203.0.113.7.", "203.0.113.7"],
    ["[::1]", "[::1]"],
    ["[::1]:3000", "[::1]"],
    ["[::1]:", "[::1]"],
    ["[2001:DB8::1]:8443", "[2001:db8::1]"],
    ["[::ffff:192.0.2.1]", "[::ffff:192.0.2.1]"],
    ["[1:2:3:4:5:6:7:8]", "[1:2:3:4:5:6:7:8]"],
    ["::1", "[::1]"],
    ["2001:db8::1", "[2001:db8::1]"],
  ])("accepts %j as %j", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    ".",
    "..",
    "acevatech..com",
    "acevatech.com..",
    ".acevatech.com",
    "-bad.com",
    "bad-.com",
    "under_score.com",
    "a".repeat(64) + ".com",
    `${"a.".repeat(130)}com`,
    "https://acevatech.com",
    "acevatech.com/",
    "acevatech.com/admin",
    "user@acevatech.com",
    "acevatech.com@evil.example",
    "evil.example\\acevatech.com",
    "*.acevatech.com",
    "acevatech.com, evil.example",
    "acevatech.com evil.example",
    "acevatech.com;evil.example",
    "acevatech.com?x=1",
    "acevatech.com#x",
    "acevatech.com%2eevil",
    "acevatech.com:abc",
    "acevatech.com:99999",
    "acevatech.com:80:80",
    "acevatech.com:-1",
    "acevatech\u0000.com",
    "acevatech.com\r\nX-Injected: 1",
    "bücher.example",
    "Kevin.example", // Kelvin sign: lower-cases into a plain ASCII "k"
    "ａcevatech.com", // fullwidth letter
    // IP spellings that resolvers read as 127.0.0.1 but that are not a strict dotted quad.
    "127.1",
    "2130706433",
    "0x7f.0.0.1",
    "0177.0.0.1",
    "127.000.000.001",
    "256.0.0.1",
    "1.2.3",
    "1.2.3.4.5",
    "123",
    // Broken IPv6.
    "[::1",
    "::1]",
    "[]",
    "[:::1]",
    "[1::2::3]",
    "[1:2:3:4:5:6:7:8:9]",
    "[1:2:3:4:5:6:7::8]",
    "[12345::1]",
    "[g::1]",
    "[::1%25eth0]",
    "[1.2.3.4::]",
    "[::1.2.3.4:5]",
    "[::1]:99999",
    "[::1]x",
    ":::",
    ":",
    "1:2",
  ])("rejects %j", (input) => {
    expect(normalizeHost(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    for (const value of [undefined, null, 0, 1, true, {}, [], ["acevatech.com"], Symbol("x")]) {
      expect(normalizeHost(value)).toBeNull();
    }
  });

  it("refuses absurdly long input without trouble", () => {
    expect(normalizeHost("a".repeat(100_000))).toBeNull();
    expect(normalizeHost(`${"a".repeat(299)}.com`)).toBeNull();
  });
});

describe("parseHostList", () => {
  it("splits on commas, trims, lower-cases, strips ports and collapses duplicates", () => {
    expect(parseHostList("acevatech.com,www.acevatech.com")).toEqual(["acevatech.com", "www.acevatech.com"]);
    expect(parseHostList(" ACEVATECH.com , www.acevatech.com:443 ,acevatech.com.,")).toEqual(["acevatech.com", "www.acevatech.com"]);
  });

  it("ignores garbage entries and keeps the valid ones", () => {
    expect(parseHostList("https://acevatech.com, www.acevatech.com, *.vercel.app, ,under_score, localhost")).toEqual([
      "www.acevatech.com",
      "localhost",
    ]);
  });

  it("returns an empty list for unusable input", () => {
    expect(parseHostList("")).toEqual([]);
    expect(parseHostList(" , ,, ")).toEqual([]);
    expect(parseHostList("https://acevatech.com")).toEqual([]);
    expect(parseHostList(undefined)).toEqual([]);
    expect(parseHostList(null)).toEqual([]);
    expect(parseHostList(42)).toEqual([]);
  });

  it("accepts IP literals, bracketed or not", () => {
    expect(parseHostList("203.0.113.7, ::1, [2001:db8::1]:8443")).toEqual(["203.0.113.7", "[::1]", "[2001:db8::1]"]);
  });

  it("does not treat spaces as separators", () => {
    expect(parseHostList("acevatech.com www.acevatech.com")).toEqual([]);
  });
});

describe("readRequestHost", () => {
  it("normalises the Host header", () => {
    expect(readRequestHost(headers({ host: "AcevaTech.com:443" }))).toBe("acevatech.com");
    expect(readRequestHost(headers({ Host: "acevatech.com." }))).toBe("acevatech.com");
  });

  it("uses X-Forwarded-Host only when Host is missing or blank", () => {
    expect(readRequestHost(headers({ "x-forwarded-host": "acevatech.com" }))).toBe("acevatech.com");
    expect(readRequestHost(headers({ host: "", "x-forwarded-host": "acevatech.com" }))).toBe("acevatech.com");
    expect(readRequestHost(headers({ host: "   ", "x-forwarded-host": "acevatech.com" }))).toBe("acevatech.com");
  });

  it("never lets X-Forwarded-Host override a Host header, valid or not", () => {
    expect(readRequestHost(headers({ host: "preview.vercel.app", "x-forwarded-host": "acevatech.com" }))).toBe("preview.vercel.app");
    // A malformed Host is a denial, not a reason to go looking at the forwarded value.
    expect(readRequestHost(headers({ host: "bad host", "x-forwarded-host": "acevatech.com" }))).toBeNull();
    expect(readRequestHost(headers({ host: "a.com, b.com", "x-forwarded-host": "acevatech.com" }))).toBeNull();
  });

  it("takes the first entry of a forwarded chain", () => {
    expect(readRequestHost(headers({ "x-forwarded-host": "acevatech.com, proxy.internal" }))).toBe("acevatech.com");
    expect(readRequestHost(headers({ "x-forwarded-host": "evil.example, acevatech.com" }))).toBe("evil.example");
  });

  it("is null with no usable header at all", () => {
    expect(readRequestHost(headers({}))).toBeNull();
    expect(readRequestHost(headers({ "x-forwarded-host": "" }))).toBeNull();
    expect(readRequestHost(headers({ "x-forwarded-host": "not a host" }))).toBeNull();
  });
});

describe("isHostAllowed", () => {
  const list = ["acevatech.com", "www.acevatech.com"];

  it("allows everything when no list is configured, even a missing host", () => {
    expect(isHostAllowed("anything.example", null, { allowLoopback: false })).toBe(true);
    expect(isHostAllowed(null, null, { allowLoopback: false })).toBe(true);
  });

  it("allows only listed hosts, and never a missing one", () => {
    expect(isHostAllowed("acevatech.com", list, { allowLoopback: false })).toBe(true);
    expect(isHostAllowed("www.acevatech.com", list, { allowLoopback: false })).toBe(true);
    expect(isHostAllowed("preview-abc.vercel.app", list, { allowLoopback: false })).toBe(false);
    expect(isHostAllowed("acevatech.com.evil.example", list, { allowLoopback: false })).toBe(false);
    expect(isHostAllowed("evilacevatech.com", list, { allowLoopback: false })).toBe(false);
    expect(isHostAllowed(null, list, { allowLoopback: false })).toBe(false);
  });

  it("allows nobody for an empty list", () => {
    expect(isHostAllowed("acevatech.com", [], { allowLoopback: false })).toBe(false);
    expect(isHostAllowed(null, [], { allowLoopback: true })).toBe(false);
  });

  it("admits exactly localhost, 127.0.0.1 and [::1] when loopback is allowed", () => {
    expect([...LOOPBACK_HOSTS].sort()).toEqual(["127.0.0.1", "[::1]", "localhost"]);
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(isHostAllowed(host, list, { allowLoopback: true }), host).toBe(true);
      expect(isHostAllowed(host, list, { allowLoopback: false }), host).toBe(false);
    }
    for (const host of ["127.0.0.2", "foo.localhost", "[::2]", "0.0.0.0"]) {
      expect(isHostAllowed(host, list, { allowLoopback: true }), host).toBe(false);
    }
  });
});

describe("getAllowedAdminHosts", () => {
  it("is null (no restriction) when ADMIN_ALLOWED_HOSTS is unset, empty or blank", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", undefined);
    expect(getAllowedAdminHosts()).toBeNull();
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "");
    expect(getAllowedAdminHosts()).toBeNull();
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "  \n ");
    expect(getAllowedAdminHosts()).toBeNull();
  });

  it("returns the canonical list", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "AcevaTech.com, www.acevatech.com:443");
    expect(getAllowedAdminHosts()).toEqual(["acevatech.com", "www.acevatech.com"]);
  });

  it("is an empty list, not null, when the variable holds nothing valid, so a typo locks instead of opening", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "https://acevatech.com/");
    expect(getAllowedAdminHosts()).toEqual([]);
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "*.acevatech.com");
    expect(getAllowedAdminHosts()).toEqual([]);
  });
});

describe("isAdminRequestHostAllowed", () => {
  it("allows every host when the variable is unset, in production too", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", undefined);
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminRequestHostAllowed(headers({ host: "anything.vercel.app" }))).toBe(true);
    expect(isAdminRequestHostAllowed(headers({}))).toBe(true);
  });

  it("allows listed hosts in any spelling the HTTP layer may deliver", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com,www.acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    for (const host of ["acevatech.com", "ACEVATECH.COM", "acevatech.com:443", "acevatech.com.", "Www.AcevaTech.com:8443"]) {
      expect(isAdminRequestHostAllowed(headers({ host })), host).toBe(true);
    }
  });

  it("refuses unlisted, garbage and missing hosts", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    for (const host of ["aceva-git-main-org.vercel.app", "acevatech.com.evil.example", "evil.example", "bad host", ""]) {
      expect(isAdminRequestHostAllowed(headers({ host })), host).toBe(false);
    }
    expect(isAdminRequestHostAllowed(headers({}))).toBe(false);
  });

  it("falls back to X-Forwarded-Host only without a Host header", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminRequestHostAllowed(headers({ "x-forwarded-host": "acevatech.com" }))).toBe(true);
    expect(isAdminRequestHostAllowed(headers({ host: "preview.vercel.app", "x-forwarded-host": "acevatech.com" }))).toBe(false);
    expect(isAdminRequestHostAllowed(headers({ host: "acevatech.com", "x-forwarded-host": "preview.vercel.app" }))).toBe(true);
  });

  it("always allows loopback hosts outside production", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com");
    for (const env of ["development", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      for (const host of ["localhost", "localhost:3000", "127.0.0.1:3000", "[::1]:3000", "LOCALHOST"]) {
        expect(isAdminRequestHostAllowed(headers({ host })), `${env} ${host}`).toBe(true);
      }
      expect(isAdminRequestHostAllowed(headers({ host: "preview.vercel.app" })), env).toBe(false);
    }
  });

  it("denies loopback hosts in production unless they are listed", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "[::1]:3000"]) {
      expect(isAdminRequestHostAllowed(headers({ host })), host).toBe(false);
    }
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "acevatech.com,localhost");
    expect(isAdminRequestHostAllowed(headers({ host: "localhost:3000" }))).toBe(true);
  });

  it("ignores garbage entries but still enforces the valid ones", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "https://nope.example, ,*.vercel.app,acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminRequestHostAllowed(headers({ host: "acevatech.com" }))).toBe(true);
    expect(isAdminRequestHostAllowed(headers({ host: "nope.example" }))).toBe(false);
    expect(isAdminRequestHostAllowed(headers({ host: "x.vercel.app" }))).toBe(false);
  });

  it("locks every host when the variable holds only garbage", () => {
    vi.stubEnv("ADMIN_ALLOWED_HOSTS", "https://acevatech.com");
    vi.stubEnv("NODE_ENV", "production");
    expect(isAdminRequestHostAllowed(headers({ host: "acevatech.com" }))).toBe(false);
  });
});

describe("isCanonicalAdminPath", () => {
  it.each([
    "/admin",
    "/admin/",
    "/admin/login",
    "/admin/login/",
    "/admin/documents",
    "/admin/documents/new",
    "/admin/documents/0b9d4c1e-7a52-4c3a-9d60-2f7f9f1c5b21",
    "/admin/documents/0b9d4c1e-7a52-4c3a-9d60-2f7f9f1c5b21/card",
    "/admin/verification",
    "/api/admin",
    "/api/admin/",
    "/api/admin/login",
    "/api/admin/documents/next-reference",
    "/api/admin/documents/0b9d4c1e-7a52-4c3a-9d60-2f7f9f1c5b21/qr",
    "/admin/login.json",
    "/admin/documents.segments/_tree.segment",
  ])("accepts %s", (path) => {
    expect(isCanonicalAdminPath(path)).toBe(true);
  });

  it.each([
    "",
    "/",
    "/Admin",
    "/ADMIN",
    "/ADMIN/",
    "/Admin/login",
    "/admin/Login",
    "/admin/LOGIN/",
    "/API/admin",
    "/api/Admin/x",
    "/admin//",
    "/admin//login",
    "/admin/login//",
    "//admin",
    "//admin/login",
    "/api//admin",
    "/admin%2flogin",
    "/admin%2Flogin",
    "/admin/%6Cogin",
    "/admin/login%2F",
    "/admin/%2e%2e/x",
    "/admin/%00",
    "/admin;x",
    "/admin/login;x",
    "/admin/login;jsessionid=1",
    "/administrator",
    "/admin-panel",
    "/adminx/login",
    "/admin.php",
    "/admin/.",
    "/admin/..",
    "/admin/login/..",
    "/admin/./login",
    "/admin/ login",
    "/admin/login\\x",
    "/admin\\login",
    "/admin/lögin",
    "/admin/login?x=1",
    "/admin/login#x",
    "/x/admin/login",
    "/wp-admin",
    "/login",
    "/dashboard",
    "/api/administrator",
    "/api/admin%2Flogin",
    "admin/login",
  ])("rejects %j", (path) => {
    expect(isCanonicalAdminPath(path)).toBe(false);
  });
});
