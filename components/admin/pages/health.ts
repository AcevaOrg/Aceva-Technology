import { formatBytes } from "@/components/admin/utils";
import { MAX_REQUEST_BYTES } from "@/lib/documents/types";
import { formatCount, plural } from "./format";

/**
 * The Settings page's health checklist, as pure functions over plain facts. The page gathers the
 * facts (environment, a database probe); this module decides what each one means and how to word it.
 *
 * Nothing secret is ever an input: the pass key arrives as a LENGTH only, never as text, so no code
 * path in this module could render it.
 */

export type CheckStatus = "ok" | "warn" | "fail" | "info";

export interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  /** One more sentence of advice or context. */
  detail?: string;
}

/* ------------------------------------------------------------------ *
 * Pass key                                                             *
 * ------------------------------------------------------------------ */

/** Below this the pass key is flagged. The server still accepts a shorter one down to its own floor. */
export const RECOMMENDED_PASSKEY_LENGTH = 12;
export const STRONG_PASSKEY_LENGTH = 20;

export type PasskeyClass = "missing" | "short" | "good" | "strong";

/** A length class, never the length itself: "12 to 19 characters" says less than "14". */
export function classifyPasskey(length: number | null): PasskeyClass {
  if (length === null || length <= 0) return "missing";
  if (length < RECOMMENDED_PASSKEY_LENGTH) return "short";
  if (length < STRONG_PASSKEY_LENGTH) return "good";
  return "strong";
}

function passkeyCheck(length: number | null, minimum: number): HealthCheck {
  const level = classifyPasskey(length);
  switch (level) {
    case "missing":
      return {
        id: "passkey",
        label: "Pass key",
        status: "fail",
        summary: "Not configured",
        detail: `Set ADMIN_PASSKEY to at least ${minimum} characters. Until then every console URL answers 404.`,
      };
    case "short":
      return {
        id: "passkey",
        label: "Pass key",
        status: "warn",
        summary: `Configured, but short (under ${RECOMMENDED_PASSKEY_LENGTH} characters)`,
        detail: "A short key is easier to guess. Run `npm run admin:passkey` for a 24-character key, set it as ADMIN_PASSKEY and redeploy. Changing it signs everyone out.",
      };
    case "good":
      return {
        id: "passkey",
        label: "Pass key",
        status: "ok",
        summary: `Configured (${RECOMMENDED_PASSKEY_LENGTH} to ${STRONG_PASSKEY_LENGTH - 1} characters)`,
        detail: "Long enough. A random 24-character key from `npm run admin:passkey` is stronger still.",
      };
    default:
      return {
        id: "passkey",
        label: "Pass key",
        status: "ok",
        summary: `Configured and strong (${STRONG_PASSKEY_LENGTH} or more characters)`,
      };
  }
}

/* ------------------------------------------------------------------ *
 * Host lock                                                            *
 * ------------------------------------------------------------------ */

/**
 * "Host lock: on/off". With the lock on, the console answers 404 on any host not in ADMIN_ALLOWED_HOSTS
 * (preview deployments, raw *.vercel.app URLs), so only the real domain can serve the sign-in page. The
 * host names are configuration rather than secrets, so they are listed to make a typo easy to spot.
 */
export function hostLockCheck(allowedHosts: readonly string[] | null, production: boolean): HealthCheck {
  if (allowedHosts === null) {
    return {
      id: "host-lock",
      label: "Host lock",
      status: production ? "warn" : "info",
      summary: "Off: any address that reaches this site can serve the console",
      detail: production
        ? "Set ADMIN_ALLOWED_HOSTS to your real domain (for example acevatech.com,www.acevatech.com) and redeploy, so preview and raw platform addresses answer 404."
        : "Fine for development. Set ADMIN_ALLOWED_HOSTS in production so only the real domain can serve the console.",
    };
  }
  if (allowedHosts.length === 0) {
    return {
      id: "host-lock",
      label: "Host lock",
      status: "fail",
      summary: "On, but no valid host is listed: every address is locked out",
      detail: "ADMIN_ALLOWED_HOSTS is set but contains nothing usable. List bare host names such as acevatech.com, without https:// or paths.",
    };
  }
  return {
    id: "host-lock",
    label: "Host lock",
    status: "ok",
    summary: `On: ${allowedHosts.join(", ")}`,
    detail: production ? "Any other address answers 404, even with a valid session." : "Localhost is always allowed outside production.",
  };
}

/* ------------------------------------------------------------------ *
 * Session, uploads                                                     *
 * ------------------------------------------------------------------ */

/** "8 hours", "1 hour", "2 days". */
export function describeSessionLength(seconds: number): string {
  const hours = Math.max(1, Math.round(seconds / 3600));
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`;
  return `${hours} ${plural(hours, "hour")}`;
}

/* ------------------------------------------------------------------ *
 * Site URL                                                             *
 * ------------------------------------------------------------------ */

const LOCAL_HOSTS = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?)$/i;

export interface SiteUrlAssessment {
  status: CheckStatus;
  summary: string;
  detail?: string;
}

/**
 * The address printed inside every QR code. A QR that points at localhost works only on the machine
 * that made it, and a QR over plain http is flagged by phones, so both are warnings in production.
 */
export function assessSiteUrl(siteUrl: string, production: boolean, fromEnvironment: boolean): SiteUrlAssessment {
  let parsed: URL;
  try {
    parsed = new URL(siteUrl);
  } catch {
    return {
      status: "fail",
      summary: "Not a valid address",
      detail: "Set NEXT_PUBLIC_SITE_URL to the full address of the site, for example https://acevatech.com.",
    };
  }

  const origin = parsed.origin;
  if (LOCAL_HOSTS.test(parsed.hostname) || parsed.hostname.endsWith(".local")) {
    return {
      status: "warn",
      summary: `${origin} (local address)`,
      detail: production
        ? "Printed QR codes would point at a machine only you can reach. Set NEXT_PUBLIC_SITE_URL to the public address and redeploy."
        : "Fine for development. Before printing anything, set NEXT_PUBLIC_SITE_URL to the public address.",
    };
  }
  if (parsed.protocol !== "https:") {
    return {
      status: production ? "warn" : "info",
      summary: `${origin} (not HTTPS)`,
      detail: production
        ? "Phones warn when a scanned link is not HTTPS. Set NEXT_PUBLIC_SITE_URL to an https:// address and redeploy."
        : "Use an https:// address in production.",
    };
  }
  if (production && !fromEnvironment) {
    return {
      status: "info",
      summary: `${origin} (built-in default)`,
      detail: "NEXT_PUBLIC_SITE_URL is not set, so the default address is used. Set it explicitly if the site lives somewhere else.",
    };
  }
  return { status: "ok", summary: origin };
}

/* ------------------------------------------------------------------ *
 * The checklist                                                        *
 * ------------------------------------------------------------------ */

export interface DatabaseFacts {
  configured: boolean;
  /** The embedded development database (ACEVA_LOCAL_DB=1) rather than Neon. */
  embedded: boolean;
  /** Null when the probe was not attempted (not configured). */
  reachable: boolean | null;
  /** Tables that did not exist before this visit and were created. Null when unknown. */
  tablesCreated: string[] | null;
  /** Tables still missing after trying to create them. Null when unknown. */
  tablesMissing: string[] | null;
  documents: number | null;
  files: { count: number; bytes: number } | null;
}

export interface HealthFacts {
  /** Length of the configured pass key, or null when none. NEVER the key itself. */
  passkeyLength: number | null;
  minPasskeyLength: number;
  sessionSeconds: number;
  /** A dedicated ADMIN_SESSION_SECRET is set. */
  sessionSecretConfigured: boolean;
  /**
   * ADMIN_ALLOWED_HOSTS as parsed by getAllowedAdminHosts(): null means unrestricted, an empty list means the
   * variable is set but holds nothing usable (every host is locked out), otherwise the hosts that may serve the console.
   */
  allowedHosts: readonly string[] | null;
  uploadBytes: number;
  database: DatabaseFacts;
  siteUrl: string;
  siteUrlFromEnvironment: boolean;
  production: boolean;
}

function databaseChecks(facts: DatabaseFacts): HealthCheck[] {
  if (!facts.configured) {
    return [
      {
        id: "database",
        label: "Database",
        status: "fail",
        summary: "Not configured",
        detail: "Set DATABASE_URL (Neon), or ACEVA_LOCAL_DB=1 for the embedded development database, then run `npm run migrate:documents`.",
      },
    ];
  }

  const checks: HealthCheck[] = [
    {
      id: "database",
      label: "Database",
      status: "ok",
      summary: facts.embedded ? "Embedded development database" : "Configured",
      detail: facts.embedded
        ? "Records live in .local-db on this machine. They do not exist in production, which always uses DATABASE_URL."
        : undefined,
    },
  ];

  if (facts.reachable === false) {
    checks.push({
      id: "reachable",
      label: "Connection",
      status: "fail",
      summary: "Could not reach the database",
      detail: "Check that the database is running and DATABASE_URL is correct. Nothing is lost; the console recovers when the connection does.",
    });
    return checks;
  }
  checks.push({ id: "reachable", label: "Connection", status: "ok", summary: "Reachable" });

  if (facts.tablesMissing && facts.tablesMissing.length > 0) {
    checks.push({
      id: "tables",
      label: "Tables",
      status: "fail",
      summary: `Missing: ${facts.tablesMissing.join(", ")}`,
      detail: "Run `npm run migrate:documents` against this database.",
    });
  } else if (facts.tablesCreated && facts.tablesCreated.length > 0) {
    checks.push({
      id: "tables",
      label: "Tables",
      status: "info",
      summary: `Created just now: ${facts.tablesCreated.join(", ")}`,
      detail: "They were missing and have been created. Run `npm run migrate:documents` at deploy time to do this ahead of the first visitor.",
    });
  } else {
    checks.push({ id: "tables", label: "Tables", status: "ok", summary: "All present" });
  }

  if (facts.files) {
    const documents = facts.documents ?? 0;
    checks.push({
      id: "storage",
      label: "Stored files",
      status: "info",
      summary: `${formatCount(documents)} ${plural(documents, "document")}, ${formatCount(facts.files.count)} ${plural(facts.files.count, "file")}, ${formatBytes(facts.files.bytes)}`,
      detail: "Files are kept in the database itself, so this counts towards its storage allowance.",
    });
  }
  return checks;
}

export function buildHealthChecks(facts: HealthFacts): HealthCheck[] {
  const site = assessSiteUrl(facts.siteUrl, facts.production, facts.siteUrlFromEnvironment);

  return [
    passkeyCheck(facts.passkeyLength, facts.minPasskeyLength),
    hostLockCheck(facts.allowedHosts, facts.production),
    {
      id: "session",
      label: "Session length",
      status: "ok",
      summary: `${describeSessionLength(facts.sessionSeconds)} per sign-in`,
      detail: facts.sessionSecretConfigured
        ? "Sessions are signed with ADMIN_SESSION_SECRET. Rotating it signs everyone out."
        : "Sessions are signed from the pass key. Changing the pass key signs everyone out. Set ADMIN_SESSION_HOURS to change the length (1 to 72).",
    },
    {
      id: "uploads",
      label: "Upload limit",
      status: "ok",
      summary: `${formatBytes(facts.uploadBytes)} per file`,
      detail: "Set ADMIN_MAX_UPLOAD_MB (1 to 4) to lower it.",
    },
    ...databaseChecks(facts.database),
    { id: "site-url", label: "Address inside QR codes", status: site.status, summary: site.summary, detail: site.detail },
    {
      id: "platform",
      label: "Hosting body limit",
      status: "info",
      summary: `Vercel rejects requests over 4.5 MB`,
      detail: `A save with a document and a photo must stay under ${formatBytes(MAX_REQUEST_BYTES)} in total. Larger files need external storage rather than a bigger number here.`,
    },
    {
      id: "cookie",
      label: "Session cookie",
      status: "info",
      summary: facts.production ? "HttpOnly, SameSite Strict, Secure, host-locked" : "HttpOnly, SameSite Strict",
      detail: facts.production ? undefined : "Secure and host-locked in production; relaxed here so plain-http development works.",
    },
  ];
}

export interface InlinePart {
  text: string;
  code: boolean;
}

/**
 * Splits advice text on `backticks` so commands render as <code> by plain React text nodes. The text
 * is never parsed as HTML, so nothing in it can become markup. An unmatched backtick stays literal.
 */
export function splitInlineCode(text: string): InlinePart[] {
  const segments = text.split("`");
  if (segments.length % 2 === 0) return [{ text, code: false }];
  return segments.map((segment, index) => ({ text: segment, code: index % 2 === 1 })).filter((part) => part.text !== "");
}

export interface HealthSummary {
  failures: number;
  warnings: number;
  /** A short verdict for the page header. */
  headline: string;
  tone: "success" | "warning" | "danger";
}

export function summarizeHealth(checks: readonly HealthCheck[]): HealthSummary {
  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn").length;
  if (failures > 0) {
    return { failures, warnings, headline: `${failures} ${plural(failures, "problem")} to fix`, tone: "danger" };
  }
  if (warnings > 0) {
    return { failures, warnings, headline: `${warnings} ${plural(warnings, "warning")}`, tone: "warning" };
  }
  return { failures, warnings, headline: "All checks passed", tone: "success" };
}
