import { describe, expect, it } from "vitest";
import { resolveCategoryParam } from "@/components/admin/editor/editorModel";
import { describeEmptyList, listHref, parseListQuery, toListFilters, type ListQuery } from "@/components/admin/pages/listQuery";
import { CATEGORIES, CATEGORY_LIST, categoryFromSlug, isDocumentCategory } from "@/lib/documents/categories";
import { EXPIRING_SOON_DAYS } from "@/lib/documents/store";
import { DOCUMENT_CATEGORY_KEYS, type DocumentCategory } from "@/lib/documents/types";
import { validateDocumentInput } from "@/lib/documents/validate";

/**
 * The ID card category was removed from the product. These tests keep it removed: it must not come back
 * as a key, as an admin URL slug, as a form the editor opens, or as a filter that errors or silently
 * narrows a list. Three more pieces live beside the code they exercise, in files that already run an
 * in-memory Postgres: creating a record through the API (adminDocumentsCrud.test.ts), and the database's
 * own CHECK constraint and the list a stale link would show (both in documentStore.test.ts).
 */

describe("the category list", () => {
  it("is exactly the five remaining categories, in order", () => {
    expect([...DOCUMENT_CATEGORY_KEYS]).toEqual(["financial_report", "company_identity", "certification", "program_record", "experience_letter"]);
  });

  it("has a spec for each key and for nothing else", () => {
    expect(Object.keys(CATEGORIES).sort()).toEqual([...DOCUMENT_CATEGORY_KEYS].sort());
    expect(CATEGORY_LIST.map((spec) => spec.key)).toEqual([...DOCUMENT_CATEGORY_KEYS]);
    for (const spec of CATEGORY_LIST) expect(CATEGORIES[spec.key]).toBe(spec);
  });

  it("no longer recognises the retired key or its admin slug", () => {
    expect(isDocumentCategory("id_card")).toBe(false);
    expect(categoryFromSlug("ids")).toBeUndefined();
    expect(CATEGORY_LIST.map((spec) => spec.slug)).toEqual([
      "financial-reports",
      "company-identity",
      "certifications",
      "team",
      "experience-letters",
    ]);
  });

  it("keeps photo support for the category that still uses it, with no category requiring one", () => {
    expect(CATEGORIES.program_record.hasPhoto).toBe(true);
    expect(CATEGORIES.program_record.photoRequired).toBe(false);
    expect(CATEGORY_LIST.filter((spec) => spec.hasPhoto).map((spec) => spec.key)).toEqual(["program_record"]);
    expect(CATEGORY_LIST.filter((spec) => spec.photoRequired)).toEqual([]);
  });

  it("the validator rejects the retired key as a category", () => {
    const result = validateDocumentInput({ title: "Staff ID", data: {} }, { category: "id_card" as DocumentCategory });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.category).toBeTruthy();
  });
});

describe("the editor's category parameter", () => {
  it("resolves neither the old slug nor the old key", () => {
    expect(resolveCategoryParam("ids")).toBeUndefined();
    expect(resolveCategoryParam("id_card")).toBeUndefined();
  });

  it("still resolves every remaining slug and key", () => {
    for (const spec of CATEGORY_LIST) {
      expect(resolveCategoryParam(spec.slug)?.key).toBe(spec.key);
      expect(resolveCategoryParam(spec.key)?.key).toBe(spec.key);
    }
  });
});

describe("the admin list filter", () => {
  const EMPTY: ListQuery = { category: null, status: null, visibility: null, q: "", expiring: false, sort: "updated", page: 1 };

  it("treats the old slug and key as no category filter at all, never as an error", () => {
    for (const category of ["ids", "id_card"]) {
      const query = parseListQuery({ category });
      expect(query, category).toEqual(EMPTY);
      expect(toListFilters(query, EXPIRING_SOON_DAYS).category, category).toBeUndefined();
      // A link rebuilt from it carries no stale filter, and an empty view reads as the unfiltered one.
      expect(listHref(query), category).toBe("/admin/documents");
      expect(describeEmptyList(query, EXPIRING_SOON_DAYS).title, category).toBe("No documents yet");
    }
  });

  it("keeps the other filters of such a link", () => {
    const query = parseListQuery({ category: "ids", status: "draft", q: "sara" });
    expect(query).toEqual({ ...EMPTY, status: "draft", q: "sara" });
  });
});
