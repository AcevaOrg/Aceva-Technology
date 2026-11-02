/**
 * Which database this process is allowed to use, checked before any query.
 *
 * The audit (30 October 2026) found the Neon integration injects one
 * DATABASE_URL into both preview and production on Vercel, and `.env.local`
 * points local development at the same production database. Anything a
 * preview or a developer did, test saves and analytics included, landed among
 * real customer records.
 *
 * This guard makes the target explicit. The process must be told which Neon
 * endpoint it is approved to use, and must be able to prove it is not on the
 * production database unless it is the production deployment:
 *
 *   PULSE_DB_ENDPOINT             the endpoint id this deployment may use, e.g.
 *                                 "ep-quiet-sky-a1b2c3d4" (an identifier from
 *                                 the host name, not a credential). Required
 *                                 everywhere a database is used.
 *   PULSE_DB_PRODUCTION_ENDPOINT  the production endpoint id. Required outside
 *                                 production, which then refuses to use it.
 *                                 In production, if set, the endpoint must match.
 *   PULSE_DB_ALLOW_PRODUCTION=1   operator escape hatch for a deliberate script
 *                                 run against production from a workstation.
 *                                 Ignored on Vercel.
 *
 * Under Vitest only placeholder hosts ending in ".invalid" are accepted, so no
 * test can reach a real database whatever `.env.local` contains.
 *
 * Every refusal is a DatabaseUnavailableError carrying a reason code; neither
 * the connection string nor the host is ever logged or returned.
 */

export type DatabaseTargetRefusal =
  | "invalid-url"
  | "test-runner"
  | "endpoint-unconfigured"
  | "endpoint-mismatch"
  | "production-endpoint-unknown"
  | "production-database-outside-production";

export type DatabaseTargetCheck =
  | { ok: true; runtime: string; endpoint: string }
  | { ok: false; runtime: string; reason: DatabaseTargetRefusal };

/** "production", "preview" or "development" on Vercel; "local" anywhere else. */
export function runtimeEnvironment(): string {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  return vercelEnv || "local";
}

/**
 * The Neon endpoint id from a connection host, or the whole first label for
 * any other host. Neon hosts look like "ep-name-123456-pooler.region.aws.neon.tech";
 * the pooled and direct hosts of one endpoint share the id.
 */
export function endpointIdFromHost(host: string): string {
  const firstLabel = host.toLowerCase().split(".")[0] ?? "";
  return firstLabel.replace(/-pooler$/, "");
}

export function checkDatabaseTarget(connectionString: string): DatabaseTargetCheck {
  const runtime = runtimeEnvironment();

  let host: string;
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    return { ok: false, runtime, reason: "invalid-url" };
  }
  if (!host) return { ok: false, runtime, reason: "invalid-url" };

  if (process.env.VITEST) {
    return host.endsWith(".invalid")
      ? { ok: true, runtime: "test", endpoint: endpointIdFromHost(host) }
      : { ok: false, runtime: "test", reason: "test-runner" };
  }

  const endpoint = endpointIdFromHost(host);
  const approved = process.env.PULSE_DB_ENDPOINT?.trim().toLowerCase();
  const production = process.env.PULSE_DB_PRODUCTION_ENDPOINT?.trim().toLowerCase();

  if (!approved) return { ok: false, runtime, reason: "endpoint-unconfigured" };
  if (endpoint !== approved) return { ok: false, runtime, reason: "endpoint-mismatch" };

  if (runtime === "production") {
    if (production && endpoint !== production) return { ok: false, runtime, reason: "endpoint-mismatch" };
    return { ok: true, runtime, endpoint };
  }

  if (!production) return { ok: false, runtime, reason: "production-endpoint-unknown" };
  if (endpoint === production) {
    const operatorOverride = runtime === "local" && !process.env.VERCEL && process.env.PULSE_DB_ALLOW_PRODUCTION === "1";
    if (!operatorOverride) return { ok: false, runtime, reason: "production-database-outside-production" };
  }
  return { ok: true, runtime, endpoint };
}
