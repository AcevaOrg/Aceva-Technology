/**
 * Host-name helpers for the admin host lock (`ADMIN_ALLOWED_HOSTS`).
 *
 * Pure on purpose: strings in, strings out, no `process.env`, no Node modules. `proxy.ts` imports
 * it through `config.ts`, and it is unit tested without any environment set up.
 *
 * Everything here fails closed. A value that is not clearly a host name or an IP literal becomes
 * `null`, and `null` never matches an allow-list entry, so a malformed `Host` header can never be
 * "close enough" to a real one.
 */

/** Anything longer than this cannot be a host[:port]; refusing it early bounds the work done on hostile headers. */
const MAX_HOST_INPUT_LENGTH = 300;
/** DNS limits (RFC 1035): 253 characters in all, 63 per label. */
const MAX_HOSTNAME_LENGTH = 253;

/**
 * The only characters that may appear in `host[:port]` or `[ipv6]:port`. Checked on the raw text,
 * BEFORE lower-casing, because a few non-ASCII characters (the Kelvin sign, for one) lower-case
 * into plain ASCII and would otherwise be mistaken for a real letter.
 * This also rejects whitespace, `/`, `@`, `%`, `*`, `,` and quotes outright, so a URL, a userinfo
 * part, a wildcard or a zone id is never misread as a host.
 */
const HOST_CHARACTERS = /^[A-Za-z0-9.:[\]-]+$/;

const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
// Strict dotted quad with no leading zeros: "0177.0.0.1" is read as octal by some resolvers.
const IPV4_OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^(?:${IPV4_OCTET}\\.){3}${IPV4_OCTET}$`);
const NUMERIC_LABEL = /^\d+$/;
const IPV6_CHARACTERS = /^[0-9a-f:.]+$/;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/;
const BRACKETED = /^\[([^\]]*)\](?::(\d*))?$/;

/** Hosts that always reach the console when `allowLoopback` is on (development only). */
export const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** The slice of `Headers` this module needs, so tests can pass a plain object-backed reader. */
export interface HeaderReader {
  get(name: string): string | null;
}

function isValidPort(port: string): boolean {
  if (port === "") return true; // "host:" is legal URI syntax and means "no port".
  return /^\d{1,5}$/.test(port) && Number(port) <= 65535;
}

/** Plausibility check for an IPv6 literal (no brackets, no zone id). Not a full RFC 4291 parser. */
function isPlausibleIpv6(address: string): boolean {
  if (address.length < 2 || address.length > 45 || !IPV6_CHARACTERS.test(address)) return false;

  const compressionAt = address.indexOf("::");
  // Two "::" (":::" counts as two overlapping ones) can never be a valid address.
  if (compressionAt !== address.lastIndexOf("::")) return false;

  const head = compressionAt === -1 ? address : address.slice(0, compressionAt);
  const tail = compressionAt === -1 ? "" : address.slice(compressionAt + 2);
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = tail === "" ? [] : tail.split(":");
  const groups = [...headGroups, ...tailGroups];

  let width = 0;
  for (const [index, group] of groups.entries()) {
    if (group.includes(".")) {
      // An embedded IPv4 tail (::ffff:1.2.3.4) is only legal as the very last group, and counts for two.
      const isLast = index === groups.length - 1;
      const afterCompression = compressionAt === -1 || index >= headGroups.length;
      if (!isLast || !afterCompression || !IPV4.test(group)) return false;
      width += 2;
    } else {
      if (!IPV6_GROUP.test(group)) return false;
      width += 1;
    }
  }
  // "::" stands for at least one zero group, so an explicit eight leaves no room for it.
  return compressionAt === -1 ? width === 8 : width <= 7;
}

/** A DNS name or IPv4 literal, lower-case, one trailing dot removed; null when it is neither. */
function normalizeName(name: string): string | null {
  const bare = name.endsWith(".") ? name.slice(0, -1) : name;
  if (bare === "" || bare.length > MAX_HOSTNAME_LENGTH) return null;

  const labels = bare.split(".");
  if (!labels.every((label) => HOST_LABEL.test(label))) return null;

  // A purely numeric last label means "this is meant to be an IP address". Only a strict dotted
  // quad passes; "127.1", "2130706433" and "0x7f.0.0.1" are all spellings of 127.0.0.1 that some
  // resolvers accept, and none of them may be treated as a different, "unlisted" host.
  if (NUMERIC_LABEL.test(labels[labels.length - 1])) return IPV4.test(bare) ? bare : null;
  return bare;
}

/**
 * Reduces a Host header value or an allow-list entry to a canonical host:
 * lower-case, port removed, one trailing dot removed, IPv6 literals kept in `[brackets]`.
 * Returns null for anything that is not a plausible host name or IP literal.
 */
export function normalizeHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (text === "" || text.length > MAX_HOST_INPUT_LENGTH || !HOST_CHARACTERS.test(text)) return null;
  const lower = text.toLowerCase();

  if (lower.startsWith("[")) {
    const match = BRACKETED.exec(lower);
    if (!match || !isPlausibleIpv6(match[1]) || !isValidPort(match[2] ?? "")) return null;
    return `[${match[1]}]`;
  }

  const firstColon = lower.indexOf(":");
  if (firstColon === -1) return normalizeName(lower);

  // Two or more colons without brackets can only be a bare IPv6 literal (there is no port syntax
  // for it); one colon is host:port.
  if (lower.indexOf(":", firstColon + 1) !== -1) return isPlausibleIpv6(lower) ? `[${lower}]` : null;
  return isValidPort(lower.slice(firstColon + 1)) ? normalizeName(lower.slice(0, firstColon)) : null;
}

/**
 * Parses the comma-separated `ADMIN_ALLOWED_HOSTS` value into canonical hosts. Entries that are
 * not plausible hosts (a URL with a scheme, a path, a wildcard, a typo) are dropped, and
 * duplicates are collapsed. May return an empty list; see `getAllowedAdminHosts` for what that means.
 */
export function parseHostList(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const hosts = new Set<string>();
  for (const entry of raw.split(",")) {
    const host = normalizeHost(entry);
    if (host !== null) hosts.add(host);
  }
  return [...hosts];
}

/**
 * The host the client asked for. The `Host` header is authoritative; `X-Forwarded-Host` is only
 * consulted when `Host` is absent altogether, because anything that can set one header can set the
 * other and a lock that trusted the forwarded value first would be no lock.
 *
 * A `Host` that is present but malformed yields null (and so is denied) instead of falling through
 * to the forwarded header.
 */
export function readRequestHost(headers: HeaderReader): string | null {
  const direct = headers.get("host");
  if (direct !== null && direct.trim() !== "") return normalizeHost(direct);

  const forwarded = headers.get("x-forwarded-host");
  if (forwarded === null) return null;
  // A proxy chain appends; the first entry is the host the original client used.
  return normalizeHost(forwarded.split(",", 1)[0]);
}

/**
 * Whether `host` may reach the console under `allowedHosts`.
 *
 * - `allowedHosts === null`: no restriction was configured, everything is allowed.
 * - otherwise the host must be listed. An empty list therefore allows nobody, which is deliberate:
 *   a value that was set but contained no valid entry is a typo, and a typo must lock the console
 *   rather than silently open it to every host.
 * - `allowLoopback` (development only) additionally admits localhost, 127.0.0.1 and [::1].
 */
export function isHostAllowed(
  host: string | null,
  allowedHosts: readonly string[] | null,
  options: { allowLoopback: boolean },
): boolean {
  if (allowedHosts === null) return true;
  if (host === null) return false;
  if (options.allowLoopback && LOOPBACK_HOSTS.has(host)) return true;
  return allowedHosts.includes(host);
}
