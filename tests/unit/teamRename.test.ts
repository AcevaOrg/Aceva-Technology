import { describe, expect, it } from "vitest";
import { resolveCategoryParam } from "@/components/admin/editor/editorModel";
import { describeEmptyList, parseListQuery } from "@/components/admin/pages/listQuery";
import { EMPTY_BODY, LISTED_CATEGORIES } from "@/components/documents/content";
import { CATEGORIES, CATEGORY_LIST, categoryFromSlug, isDocumentCategory } from "@/lib/documents/categories";
import { EXPIRING_SOON_DAYS } from "@/lib/documents/store";

/**
 * "Interns, team & programs" became "Team". The key `program_record` is stored in the database and
 * in printed QR codes, so it stays; the words and the URL slug changed, and the old slug is
 * deliberately not kept as an alias. These tests keep the old wording from creeping back.
 */

const RETIRED_WORDING = /Interns, team|People (?:&|&amp;|and) program|people-programs/i;

/** Every user-visible string a category spec carries. */
function wordsOf(key: keyof typeof CATEGORIES): string[] {
  const spec = CATEGORIES[key];
  const words = [spec.label, spec.plural, spec.slug, spec.eyebrow, spec.blurb, spec.adminHelp];
  for (const base of Object.values(spec.base)) words.push(base.label, base.placeholder ?? "", base.help ?? "");
  for (const field of spec.fields) {
    words.push(field.label, field.group, field.placeholder ?? "", field.help ?? "");
    for (const option of field.options ?? []) words.push(option.label);
  }
  return words;
}

describe("the Team rename", () => {
  it("leaves no trace of the old wording or slug in any category", () => {
    for (const spec of CATEGORY_LIST) {
      for (const word of wordsOf(spec.key)) expect(word, `${spec.key}: ${word}`).not.toMatch(RETIRED_WORDING);
    }
  });

  it("keeps the internal key, so existing rows and printed QR codes are unaffected", () => {
    expect(isDocumentCategory("program_record")).toBe(true);
    expect(CATEGORIES.program_record.plural).toBe("Team");
    expect(CATEGORIES.program_record.referencePrefix).toBe("ACV/PRG");
  });

  it("does not keep the old slug as an alias anywhere", () => {
    expect(categoryFromSlug("people-programs")).toBeUndefined();
    expect(resolveCategoryParam("people-programs")).toBeUndefined();
    expect(resolveCategoryParam("team")?.key).toBe("program_record");
  });

  it("treats a stale admin link to the old slug as no category filter, never as an error", () => {
    const query = parseListQuery({ category: "people-programs", status: "draft" });
    expect(query.category).toBeNull();
    expect(query.status).toBe("draft");
    expect(describeEmptyList(parseListQuery({ category: "team" }), EXPIRING_SOON_DAYS).title).toBe("No team yet");
  });

  it("explains an empty Team section in the agreed words", () => {
    expect(LISTED_CATEGORIES).toContain("program_record");
    expect(EMPTY_BODY.program_record).toBe("People appear here only with their written consent. Nobody is listed until they have agreed.");
    expect(EMPTY_BODY.program_record).not.toMatch(RETIRED_WORDING);
  });

  it("leaves experience letters and certifications as two separate categories in the admin", () => {
    expect(CATEGORIES.certification.plural).toBe("Certifications");
    expect(CATEGORIES.experience_letter.plural).toBe("Experience letters");
    expect(CATEGORY_LIST.map((spec) => spec.key)).toEqual(["financial_report", "company_identity", "certification", "program_record", "experience_letter"]);
    expect(CATEGORIES.experience_letter.allowedVisibility).toEqual(["unlisted", "private"]);
  });
});
