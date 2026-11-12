import type { PublicDocument } from "@/lib/documents/public";
import { CERTS_LETTERS_FILTER, LETTERS_ANCHOR_ID } from "./content";

/**
 * The pure rules behind the "Certifications & letters" filter. The component only holds state and
 * toggles visibility; what the chips count, what the hash selects and what the status line says are
 * decided here, so each can be tested without a browser.
 */

export const SECTION_VIEWS = ["all", "certifications", "letters"] as const;
export type SectionView = (typeof SECTION_VIEWS)[number];

export const DIRECTION_FILTERS = ["all", "held", "issued"] as const;
export type DirectionFilter = (typeof DIRECTION_FILTERS)[number];

export interface DirectionCounts {
  held: number;
  issued: number;
}

/** How many listed certificates ACEVA holds and how many it issues. Anything else counts toward neither. */
export function countDirections(docs: readonly Pick<PublicDocument, "fields">[]): DirectionCounts {
  const counts: DirectionCounts = { held: 0, issued: 0 };
  for (const doc of docs) {
    const direction = doc.fields.direction;
    if (direction === "held") counts.held += 1;
    else if (direction === "issued") counts.issued += 1;
  }
  return counts;
}

/** The second chip row only earns its place when there are two kinds of certificate to tell apart. */
export function showsDirectionFilter(counts: DirectionCounts): boolean {
  return counts.held > 0 && counts.issued > 0;
}

/**
 * The view an in-page link asks for. Only `#experience-letters` selects one: `#certifications` is the
 * section itself and must not undo a choice the reader has already made.
 */
export function viewFromHash(hash: string): SectionView | null {
  return hash === `#${LETTERS_ANCHOR_ID}` ? "letters" : null;
}

function certificates(count: number): string {
  return `${count} ${count === 1 ? "certification" : "certifications"}`;
}

/**
 * The status line shown (and announced to screen readers) after a chip is pressed.
 * `total` is null when the registry could not be reached: then no number is claimed at all.
 */
export function describeSelection(
  view: SectionView,
  direction: DirectionFilter,
  total: number | null,
  counts: DirectionCounts,
): string {
  const letters = "Experience letters are never listed. Verify one by its QR code.";
  if (view === "letters") return `Showing experience letters. ${letters}`;

  let certs: string;
  if (total === null) certs = "Showing certifications.";
  else if (total === 0) certs = "No certifications published yet.";
  else if (direction === "all" || !showsDirectionFilter(counts)) certs = `Showing ${certificates(total)}.`;
  else certs = `Showing ${certificates(counts[direction])} ${direction === "held" ? "held" : "issued"} by ACEVA.`;

  return view === "certifications" ? certs : `${certs} ${letters}`;
}

/** Text for the chip rows: the visible label of each option, from one place. */
export const VIEW_LABELS = CERTS_LETTERS_FILTER.views;
export const DIRECTION_LABELS = CERTS_LETTERS_FILTER.directions;
