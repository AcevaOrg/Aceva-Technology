import type { PublicDocument } from "./public";
import { HIERARCHY_LEVELS, type FieldValue, type HierarchyLevel } from "./types";

/**
 * Pure helpers for the public Team section: which tier a person belongs to, how the tiers are
 * ordered, and the department filter. They take already-projected `PublicDocument`s, so nothing in
 * here can reach a private field.
 */

/** The heading of each tier on /documents. Keyed by level so a new level cannot be forgotten. */
export const TEAM_TIER_HEADINGS: Record<HierarchyLevel, string> = {
  leadership: "Leadership",
  management: "Management",
  team_lead: "Team leads",
  member: "Team members",
  trainee: "Interns & trainees",
};

/** The department filter is only worth showing when there is something to choose between. */
export const MIN_DEPARTMENTS_FOR_FILTER = 2;

export function isHierarchyLevel(value: unknown): value is HierarchyLevel {
  return typeof value === "string" && (HIERARCHY_LEVELS as readonly string[]).includes(value);
}

function text(fields: Record<string, FieldValue>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The tier a profile belongs to. A record saved before levels existed has none, and a stored value
 * that is no longer a known level (a retired option, a hand-edited row) is just as unusable, so both
 * fall back to "member": the person is still listed, in the broadest tier, rather than dropped or
 * crashing the page.
 */
export function teamLevel(fields: Record<string, FieldValue>): HierarchyLevel {
  const stored = fields.hierarchy_level;
  return isHierarchyLevel(stored) ? stored : "member";
}

export interface TeamTier {
  level: HierarchyLevel;
  /** Plural heading, e.g. "Team leads". */
  heading: string;
  /** Already ordered: featured first, then the admin's sort order, then name. */
  docs: PublicDocument[];
}

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** The admin's display-order number for each listed id (see `PublicListing`). A missing id counts as 0. */
export type SortOrders = ReadonlyMap<string, number>;

function compareWithinTier(a: PublicDocument, b: PublicDocument, sortOrders: SortOrders): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  const orderA = sortOrders.get(a.id) ?? 0;
  const orderB = sortOrders.get(b.id) ?? 0;
  if (orderA !== orderB) return orderA - orderB;
  const byName = NAME_COLLATOR.compare(a.holderName, b.holderName);
  if (byName !== 0) return byName;
  // Two people with the same name still need a stable order, or the page would reshuffle between renders.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Groups the listed team into tiers, highest rank first, and drops tiers nobody belongs to.
 * Within a tier: featured people first, then the admin's sort order (lower first), then by name.
 * `sortOrders` comes from the store, because the public projection deliberately does not carry it.
 */
export function groupTeamByLevel(docs: readonly PublicDocument[], sortOrders: SortOrders = new Map()): TeamTier[] {
  const buckets = new Map<HierarchyLevel, PublicDocument[]>(HIERARCHY_LEVELS.map((level) => [level, []]));
  for (const doc of docs) buckets.get(teamLevel(doc.fields))?.push(doc);

  const tiers: TeamTier[] = [];
  for (const level of HIERARCHY_LEVELS) {
    const members = buckets.get(level) ?? [];
    if (members.length === 0) continue;
    tiers.push({ level, heading: TEAM_TIER_HEADINGS[level], docs: [...members].sort((a, b) => compareWithinTier(a, b, sortOrders)) });
  }
  return tiers;
}

/* ------------------------------------------------------------------ *
 * Departments                                                          *
 * ------------------------------------------------------------------ */

/** "  Product   Design " → "product design": what two spellings of one department or name share. */
export function foldText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The person's department as it should be shown ("" when none), with stray whitespace collapsed. */
export function departmentOf(doc: PublicDocument): string {
  return text(doc.fields, "department").replace(/\s+/g, " ");
}

export interface DepartmentChoice {
  /** Normalised: what a card's department is compared with. */
  key: string;
  /** The first spelling seen, so "Engineering" is never shown as "engineering". */
  label: string;
  count: number;
}

/** Each distinct department and how many listed people are in it, A to Z. People without one are in none. */
export function departmentCounts(docs: readonly PublicDocument[]): DepartmentChoice[] {
  const byKey = new Map<string, DepartmentChoice>();
  for (const doc of docs) {
    const label = departmentOf(doc);
    if (!label) continue;
    const key = foldText(label);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { key, label, count: 1 });
  }
  return [...byKey.values()].sort((a, b) => NAME_COLLATOR.compare(a.label, b.label));
}

/* ------------------------------------------------------------------ *
 * Reporting lines                                                      *
 * ------------------------------------------------------------------ */

/**
 * The manager's name as the card should print it, or "" when nothing should be shown.
 *
 * If `reports_to` matches (trimmed, case-insensitive) another listed person, that person's own
 * spelling is used, so a hand-typed "aisha khan" reads "Aisha Khan". Otherwise the typed text is
 * kept: a manager outside the listed team is still a true statement. A person never reports to
 * themselves. This is a label only, never a link and never a tree.
 */
export function reportsToLabel(doc: PublicDocument, everyone: readonly PublicDocument[]): string {
  const typed = text(doc.fields, "reports_to").replace(/\s+/g, " ");
  if (!typed) return "";
  const wanted = foldText(typed);
  if (wanted === foldText(doc.holderName)) return "";
  const match = everyone.find((other) => other.id !== doc.id && foldText(other.holderName) === wanted);
  return match ? match.holderName : typed;
}

/* ------------------------------------------------------------------ *
 * The department filter's rules                                        *
 * ------------------------------------------------------------------ */

/** "" is the All chip. */
export function matchesDepartment(personDepartment: string, selected: string): boolean {
  return selected === "" || personDepartment === selected;
}

export function countPeople(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

export interface TierFilterSummary {
  /** How many people of each tier match, in the order the tiers were given. */
  counts: number[];
  /** The tiers that still have somebody showing, in order: the connector is drawn between these only. */
  visibleLevels: HierarchyLevel[];
}

export function summariseTierFilter(
  tiers: ReadonlyArray<{ level: HierarchyLevel; people: ReadonlyArray<{ department: string }> }>,
  selected: string,
): TierFilterSummary {
  const counts = tiers.map((tier) => tier.people.filter((person) => matchesDepartment(person.department, selected)).length);
  const visibleLevels = tiers.filter((_, index) => counts[index] > 0).map((tier) => tier.level);
  return { counts, visibleLevels };
}

/** The status line announced after a department chip is pressed. */
export function describeDepartmentSelection(selected: string, choices: readonly DepartmentChoice[], total: number): string {
  if (selected === "") return `Showing everyone: ${countPeople(total)}.`;
  const choice = choices.find((candidate) => candidate.key === selected);
  return choice ? `Showing ${countPeople(choice.count)} in ${choice.label}.` : "";
}
