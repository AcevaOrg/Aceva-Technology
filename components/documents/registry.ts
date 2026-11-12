import { isDatabaseConfigured } from "@/lib/db";
import type { PublicDocument } from "@/lib/documents/public";
import { listPublicListing } from "@/lib/documents/store";
import { LISTED_CATEGORIES, isListedCategory, type ListedCategory } from "./content";

/**
 * Loads what /documents lists. The page must render calmly with no database, so every failure
 * becomes `{ status: "unavailable" }` rather than an error; "unavailable" is never presented as
 * "nothing published", because telling a reader there are no financial reports when we merely
 * could not ask would be a false statement.
 */

export type RegistrySnapshot =
  | { status: "ok"; byCategory: Record<ListedCategory, PublicDocument[]>; sortOrders: ReadonlyMap<string, number> }
  | { status: "unavailable" };

/** Buckets projected records by category and drops any category that is never listed publicly. */
export function groupListed(documents: readonly PublicDocument[]): Record<ListedCategory, PublicDocument[]> {
  const byCategory = Object.fromEntries(LISTED_CATEGORIES.map((key) => [key, [] as PublicDocument[]])) as Record<
    ListedCategory,
    PublicDocument[]
  >;
  for (const document of documents) {
    // Experience letters are unlisted by design: even a mis-set record never appears.
    if (isListedCategory(document.category)) byCategory[document.category].push(document);
  }
  return byCategory;
}

export async function loadRegistry(): Promise<RegistrySnapshot> {
  if (!isDatabaseConfigured()) return { status: "unavailable" };
  try {
    const { documents, sortOrders } = await listPublicListing();
    return { status: "ok", byCategory: groupListed(documents), sortOrders };
  } catch (error) {
    // Only the class of failure is logged: the message of a driver error can carry connection detail.
    console.error("[documents] could not load the public listing", error instanceof Error ? error.name : typeof error);
    return { status: "unavailable" };
  }
}
