import { describe, expect, it } from "vitest";
import {
  RECOMMENDED_PASSKEY_LENGTH,
  STRONG_PASSKEY_LENGTH,
  assessSiteUrl,
  buildHealthChecks,
  classifyPasskey,
  describeSessionLength,
  splitInlineCode,
  summarizeHealth,
  type DatabaseFacts,
  type HealthFacts,
} from "@/components/admin/pages/health";

/**
 * The Settings checklist is the one place an owner learns that the console is weakly configured, so
 * the verdicts matter: a short pass key or a localhost QR address must be a visible warning, and
 * nothing here may ever carry the secret itself.
 */

const HEALTHY_DB: DatabaseFacts = {
  configured: true,
  embedded: false,
  reachable: true,
  tablesCreated: [],
  tablesMissing: [],
  documents: 12,
  files: { count: 9, bytes: 3_200_000 },
};

function facts(overrides: Partial<HealthFacts> = {}): HealthFacts {
  return {
    passkeyLength: 24,
    minPasskeyLength: 8,
    sessionSeconds: 8 * 3600,
    sessionSecretConfigured: false,
    allowedHosts: ["acevatech.com", "www.acevatech.com"],
    uploadBytes: 4_000_000,
    database: HEALTHY_DB,
    siteUrl: "https://acevatech.com",
    siteUrlFromEnvironment: true,
    production: true,
    ...overrides,
  };
}

const byId = (checks: ReturnType<typeof buildHealthChecks>, id: string) => {
  const found = checks.find((check) => check.id === id);
  if (!found) throw new Error(`no check ${id}`);
  return found;
};

describe("classifyPasskey", () => {
  it("classes by length without exposing it", () => {
    expect(classifyPasskey(null)).toBe("missing");
    expect(classifyPasskey(0)).toBe("missing");
    expect(classifyPasskey(8)).toBe("short");
    expect(classifyPasskey(RECOMMENDED_PASSKEY_LENGTH - 1)).toBe("short");
    expect(classifyPasskey(RECOMMENDED_PASSKEY_LENGTH)).toBe("good");
    expect(classifyPasskey(STRONG_PASSKEY_LENGTH - 1)).toBe("good");
    expect(classifyPasskey(STRONG_PASSKEY_LENGTH)).toBe("strong");
    expect(classifyPasskey(64)).toBe("strong");
  });
});

describe("pass key check", () => {
  it("warns when the key is under 12 characters, and says how to fix it", () => {
    const check = byId(buildHealthChecks(facts({ passkeyLength: 8 })), "passkey");
    expect(check.status).toBe("warn");
    expect(check.summary).toContain("short");
    expect(check.detail).toContain("npm run admin:passkey");
  });

  it("passes a 12-character key and a long one", () => {
    expect(byId(buildHealthChecks(facts({ passkeyLength: 12 })), "passkey").status).toBe("ok");
    expect(byId(buildHealthChecks(facts({ passkeyLength: 24 })), "passkey").status).toBe("ok");
  });

  it("fails when no key is configured and names the minimum", () => {
    const check = byId(buildHealthChecks(facts({ passkeyLength: null, minPasskeyLength: 8 })), "passkey");
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("at least 8 characters");
  });

  it("never carries the key or its exact length in any text", () => {
    const checks = buildHealthChecks(facts({ passkeyLength: 14 }));
    const text = JSON.stringify(checks);
    expect(text).not.toMatch(/\b14 characters\b/);
    expect(byId(checks, "passkey").summary).toBe("Configured (12 to 19 characters)");
  });
});

describe("describeSessionLength", () => {
  it("words hours and whole days", () => {
    expect(describeSessionLength(8 * 3600)).toBe("8 hours");
    expect(describeSessionLength(3600)).toBe("1 hour");
    expect(describeSessionLength(72 * 3600)).toBe("3 days");
    expect(describeSessionLength(24 * 3600)).toBe("24 hours");
  });
});

describe("assessSiteUrl", () => {
  it("accepts the public https address", () => {
    expect(assessSiteUrl("https://acevatech.com", true, true)).toEqual({ status: "ok", summary: "https://acevatech.com" });
  });

  it("warns about localhost in production and softens it in development", () => {
    for (const url of ["http://localhost:3000", "https://127.0.0.1", "http://0.0.0.0:3000", "http://[::1]:3000", "http://printer.local"]) {
      expect(assessSiteUrl(url, true, true).status).toBe("warn");
    }
    const dev = assessSiteUrl("http://localhost:3000", false, true);
    expect(dev.status).toBe("warn");
    expect(dev.detail).toContain("development");
  });

  it("warns about plain http in production only", () => {
    expect(assessSiteUrl("http://acevatech.com", true, true).status).toBe("warn");
    expect(assessSiteUrl("http://acevatech.com", false, true).status).toBe("info");
  });

  it("notes when production silently uses the built-in default", () => {
    const result = assessSiteUrl("https://acevatech.com", true, false);
    expect(result.status).toBe("info");
    expect(result.summary).toContain("built-in default");
    expect(assessSiteUrl("https://acevatech.com", false, false).status).toBe("ok");
  });

  it("fails on an address that is not a URL", () => {
    expect(assessSiteUrl("not a url", true, true).status).toBe("fail");
  });

  it("shows the origin only, dropping any path or credentials", () => {
    const result = assessSiteUrl("https://user:secret@acevatech.com/some/path?x=1", true, true);
    expect(result.summary).toBe("https://acevatech.com");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("database checks", () => {
  it("fails everything database-related when none is configured", () => {
    const checks = buildHealthChecks(facts({ database: { ...HEALTHY_DB, configured: false, reachable: null, tablesCreated: null, tablesMissing: null, documents: null, files: null } }));
    expect(byId(checks, "database").status).toBe("fail");
    expect(checks.some((check) => check.id === "reachable")).toBe(false);
  });

  it("reports an unreachable database and stops there", () => {
    const checks = buildHealthChecks(facts({ database: { ...HEALTHY_DB, reachable: false, tablesCreated: null, tablesMissing: null, documents: null, files: null } }));
    expect(byId(checks, "reachable").status).toBe("fail");
    expect(checks.some((check) => check.id === "tables")).toBe(false);
  });

  it("is happy when connected with every table present", () => {
    const checks = buildHealthChecks(facts());
    expect(byId(checks, "database").status).toBe("ok");
    expect(byId(checks, "reachable").status).toBe("ok");
    expect(byId(checks, "tables")).toMatchObject({ status: "ok", summary: "All present" });
    expect(byId(checks, "storage").summary).toBe("12 documents, 9 files, 3.2 MB");
  });

  it("fails on tables that are still missing and tells the owner how to create them", () => {
    const check = byId(buildHealthChecks(facts({ database: { ...HEALTHY_DB, tablesMissing: ["documents", "document_files"] } })), "tables");
    expect(check.status).toBe("fail");
    expect(check.summary).toContain("documents, document_files");
    expect(check.detail).toContain("npm run migrate:documents");
  });

  it("notes tables it created on this visit", () => {
    const check = byId(buildHealthChecks(facts({ database: { ...HEALTHY_DB, tablesCreated: ["verification_events"] } })), "tables");
    expect(check.status).toBe("info");
    expect(check.summary).toContain("verification_events");
  });

  it("labels the embedded development database as such", () => {
    const check = byId(buildHealthChecks(facts({ production: false, database: { ...HEALTHY_DB, embedded: true } })), "database");
    expect(check.summary).toBe("Embedded development database");
    expect(check.detail).toContain(".local-db");
  });

  it("pluralises the stored-file line", () => {
    const check = byId(buildHealthChecks(facts({ database: { ...HEALTHY_DB, documents: 1, files: { count: 1, bytes: 1200 } } })), "storage");
    expect(check.summary).toBe("1 document, 1 file, 1.2 KB");
  });
});

describe("other checks", () => {
  it("reports the upload limit and the Vercel body cap", () => {
    const checks = buildHealthChecks(facts({ uploadBytes: 2_097_152 }));
    expect(byId(checks, "uploads").summary).toBe("2.1 MB per file");
    expect(byId(checks, "platform").summary).toContain("4.5 MB");
    expect(byId(checks, "platform").status).toBe("info");
  });

  it("explains how sessions are signed", () => {
    expect(byId(buildHealthChecks(facts({ sessionSecretConfigured: true })), "session").detail).toContain("ADMIN_SESSION_SECRET");
    expect(byId(buildHealthChecks(facts({ sessionSecretConfigured: false })), "session").detail).toContain("pass key");
  });

  it("reports the host lock: on lists the hosts, off warns in production only, unusable locks everyone out", () => {
    const on = byId(buildHealthChecks(facts()), "host-lock");
    expect(on.status).toBe("ok");
    expect(on.summary).toBe("On: acevatech.com, www.acevatech.com");

    const offInProduction = byId(buildHealthChecks(facts({ allowedHosts: null, production: true })), "host-lock");
    expect(offInProduction.status).toBe("warn");
    expect(offInProduction.summary).toContain("Off");
    expect(offInProduction.detail).toContain("ADMIN_ALLOWED_HOSTS");

    expect(byId(buildHealthChecks(facts({ allowedHosts: null, production: false })), "host-lock").status).toBe("info");

    const unusable = byId(buildHealthChecks(facts({ allowedHosts: [] })), "host-lock");
    expect(unusable.status).toBe("fail");
    expect(unusable.summary).toContain("locked out");
  });

  it("describes the cookie by environment", () => {
    expect(byId(buildHealthChecks(facts({ production: true })), "cookie").summary).toContain("Secure");
    expect(byId(buildHealthChecks(facts({ production: false })), "cookie").summary).not.toContain("Secure");
  });
});

describe("summarizeHealth", () => {
  it("passes a healthy configuration", () => {
    expect(summarizeHealth(buildHealthChecks(facts()))).toMatchObject({ failures: 0, warnings: 0, headline: "All checks passed", tone: "success" });
  });

  it("counts warnings and failures, failures first", () => {
    const warned = summarizeHealth(buildHealthChecks(facts({ passkeyLength: 8 })));
    expect(warned).toMatchObject({ warnings: 1, headline: "1 warning", tone: "warning" });

    const broken = summarizeHealth(buildHealthChecks(facts({ passkeyLength: 8, database: { ...HEALTHY_DB, configured: false, reachable: null, tablesCreated: null, tablesMissing: null, documents: null, files: null } })));
    expect(broken.failures).toBe(1);
    expect(broken.tone).toBe("danger");
    expect(broken.headline).toBe("1 problem to fix");
  });
});

describe("splitInlineCode", () => {
  it("separates `code` spans from prose without producing markup", () => {
    expect(splitInlineCode("Run `npm run x` now")).toEqual([
      { text: "Run ", code: false },
      { text: "npm run x", code: true },
      { text: " now", code: false },
    ]);
  });

  it("leaves text with no backticks, or an unmatched one, as plain text", () => {
    expect(splitInlineCode("plain")).toEqual([{ text: "plain", code: false }]);
    expect(splitInlineCode("odd ` tick")).toEqual([{ text: "odd ` tick", code: false }]);
  });

  it("passes angle brackets through as text, for React to escape", () => {
    expect(splitInlineCode("a `<b>` c")[1]).toEqual({ text: "<b>", code: true });
  });
});
