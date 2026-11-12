import { CATEGORIES } from "@/lib/documents/categories";
import { computeVerificationState } from "@/lib/documents/public";
import type { DocumentRecord } from "@/lib/documents/types";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";
import { describeExpiry, formatDate } from "./format";

/**
 * The "Needs attention" rules for the dashboard. Pure functions over records the store already
 * returned, so each rule can be tested with plain objects.
 *
 * Three things deserve a person's attention:
 *  - a record about to expire (a certificate that lapses silently is the usual failure),
 *  - a draft that cannot be published because its required file or photo is missing,
 *  - a record that has expired but is still published (the public still sees it).
 */

export type AttentionKind = "expiring" | "missing_file" | "expired_published";

export interface AttentionItem {
  id: string;
  title: string;
  /** Singular category label, "Certification". */
  category: string;
  /** The reason it is listed: "Expires in 12 days", "Missing its document file". */
  detail: string;
  /** Colours the marker beside the item. */
  tone: "warning" | "danger";
  href: string;
}

export interface AttentionGroup {
  kind: AttentionKind;
  title: string;
  /** Every record the rule matched, which can exceed the number of items listed. */
  total: number;
  /** The rule only saw the most recent records, so `total` may be a lower bound. */
  partial: boolean;
  items: AttentionItem[];
  /** The filtered list that shows all of them. */
  moreHref: string;
}

export type MissingFile = "file" | "photo";

/**
 * Which required uploads a record lacks. A category either insists on a primary file, a photo, both
 * or neither (lib/documents/categories.ts); a record with none of the required roles cannot publish.
 */
export function missingRequiredFiles(record: Pick<DocumentRecord, "category" | "files">): MissingFile[] {
  const spec = CATEGORIES[record.category];
  if (!spec) return [];
  const roles = new Set(record.files.map((file) => file.role));
  const missing: MissingFile[] = [];
  if (spec.fileRequired && !roles.has("primary")) missing.push("file");
  if (spec.photoRequired && !roles.has("photo")) missing.push("photo");
  return missing;
}

export function describeMissing(missing: readonly MissingFile[]): string {
  const parts = missing.map((part) => (part === "file" ? "its document file" : "a photo"));
  return `Missing ${parts.join(" and ")}`;
}

/** Drafts that cannot be published yet because an upload is missing. Revoked drafts are left out. */
export function draftsMissingFiles(records: readonly DocumentRecord[]): DocumentRecord[] {
  return records.filter((record) => record.status === "draft" && !record.revokedAt && missingRequiredFiles(record).length > 0);
}

/** Published records whose expiry date has passed but which the public can still reach. */
export function expiredButPublished(records: readonly DocumentRecord[], now: Date): DocumentRecord[] {
  return records.filter(
    (record) =>
      record.status === "published" &&
      record.visibility !== "private" &&
      computeVerificationState(record, now) === "expired",
  );
}

function item(record: DocumentRecord, detail: string, tone: AttentionItem["tone"]): AttentionItem {
  return {
    id: record.id,
    title: record.title,
    category: CATEGORIES[record.category].label,
    detail,
    tone,
    href: adminDocumentRoute(record.id),
  };
}

export interface AttentionInput {
  /** Soonest-expiring records (the store's own list), earliest first. */
  soonestExpiring: readonly DocumentRecord[];
  /** The store's count of everything inside the expiring-soon window. */
  expiringTotal: number;
  /** Draft records the caller loaded, or null when that query failed. */
  drafts: { items: readonly DocumentRecord[]; total: number } | null;
  /** Published records the caller loaded, or null when that query failed. */
  published: { items: readonly DocumentRecord[]; total: number } | null;
  now: Date;
  soonDays: number;
  /** At most this many items per group; the rest are behind `moreHref`. */
  perGroup?: number;
}

/** Builds the dashboard's attention groups; a group with nothing to report is omitted. */
export function buildAttention(input: AttentionInput): AttentionGroup[] {
  const limit = input.perGroup ?? 5;
  const groups: AttentionGroup[] = [];

  // The store's "soonest" list is the next six expiries whatever their distance, so records beyond the
  // window are dropped here: a certificate that lapses in a year is not something to act on today.
  const expiring = input.soonestExpiring
    .filter((record) => describeExpiry(record.expiresOn, input.now, input.soonDays).tone === "soon")
    .slice(0, limit)
    .map((record) => {
      const { relative } = describeExpiry(record.expiresOn, input.now, input.soonDays);
      return item(record, `Expires ${formatDate(record.expiresOn)}, ${relative}`, "warning");
    });
  if (input.expiringTotal > 0 && expiring.length > 0) {
    groups.push({
      kind: "expiring",
      title: "Expiring soon",
      total: input.expiringTotal,
      partial: false,
      items: expiring,
      moreHref: `${ADMIN_ROUTES.documents}?expiring=1`,
    });
  }

  if (input.drafts) {
    const matches = draftsMissingFiles(input.drafts.items);
    if (matches.length > 0) {
      groups.push({
        kind: "missing_file",
        title: "Drafts missing a required file",
        total: matches.length,
        partial: input.drafts.total > input.drafts.items.length,
        items: matches.slice(0, limit).map((record) => item(record, describeMissing(missingRequiredFiles(record)), "warning")),
        moreHref: `${ADMIN_ROUTES.documents}?status=draft`,
      });
    }
  }

  if (input.published) {
    const matches = expiredButPublished(input.published.items, input.now);
    if (matches.length > 0) {
      groups.push({
        kind: "expired_published",
        title: "Expired but still published",
        total: matches.length,
        partial: input.published.total > input.published.items.length,
        items: matches.slice(0, limit).map((record) => {
          const { relative } = describeExpiry(record.expiresOn, input.now, input.soonDays);
          const reach = record.visibility === "public" ? "still public" : "still reachable by its code";
          return item(record, `Expired ${relative}, ${reach}`, "danger");
        }),
        moreHref: `${ADMIN_ROUTES.documents}?status=published`,
      });
    }
  }

  return groups;
}

export function attentionTotal(groups: readonly AttentionGroup[]): number {
  return groups.reduce((sum, group) => sum + group.total, 0);
}
