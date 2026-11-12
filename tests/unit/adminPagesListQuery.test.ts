import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  LIST_PAGE_SIZE,
  SORT_OPTIONS,
  activeFilterCount,
  cleanSearch,
  clearedQuery,
  describeEmptyList,
  listHref,
  pageItems,
  paginate,
  parseListQuery,
  toListFilters,
  type ListQuery,
} from "@/components/admin/pages/listQuery";

/**
 * /admin/documents is URL-driven, so these functions are the contract between the address bar, the
 * filter chips and the database query: a mistake here would show the wrong records or pass a hostile
 * value to the store.
 */

const EMPTY: ListQuery = { category: null, status: null, visibility: null, q: "", expiring: false, sort: DEFAULT_SORT, page: 1 };

describe("parseListQuery", () => {
  it("returns an unfiltered first page for an empty URL", () => {
    expect(parseListQuery({})).toEqual(EMPTY);
  });

  it("reads every filter", () => {
    const query = parseListQuery({
      category: "certifications",
      status: "published",
      visibility: "unlisted",
      q: "  iso  27001 ",
      expiring: "1",
      sort: "title",
      page: "3",
    });
    expect(query).toEqual({
      category: "certification",
      status: "published",
      visibility: "unlisted",
      q: "iso 27001",
      expiring: true,
      sort: "title",
      page: 3,
    });
  });

  it("accepts the raw category key as well as the slug", () => {
    expect(parseListQuery({ category: "experience_letter" }).category).toBe("experience_letter");
    expect(parseListQuery({ category: "experience-letters" }).category).toBe("experience_letter");
    expect(parseListQuery({ category: "team" }).category).toBe("program_record");
  });

  it("ignores values that are not real options instead of passing them on", () => {
    const query = parseListQuery({ category: "payroll", status: "deleted", visibility: "secret", sort: "random", expiring: "yes" });
    expect(query).toEqual(EMPTY);
  });

  it("repairs a hostile or mangled page number", () => {
    for (const page of ["0", "-4", "abc", "1.5", "", "9999999999", "1e3", " 2"]) {
      const parsed = parseListQuery({ page }).page;
      expect(Number.isInteger(parsed)).toBe(true);
      expect(parsed).toBeGreaterThanOrEqual(1);
    }
    expect(parseListQuery({ page: "0" }).page).toBe(1);
    expect(parseListQuery({ page: "7" }).page).toBe(7);
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseListQuery({ status: ["draft", "published"] }).status).toBe("draft");
    expect(parseListQuery({ q: ["a", "b"] }).q).toBe("a");
  });

  it("cleans the search term: no control characters, collapsed spaces, capped length", () => {
    expect(cleanSearch("a\u0000b\tc\nd")).toBe("a b c d");
    expect(cleanSearch("x".repeat(500))).toHaveLength(100);
    expect(parseListQuery({ q: "\u0007\u0007" }).q).toBe("");
  });
});

describe("listHref", () => {
  it("is the bare list for an unfiltered query, so default URLs stay short", () => {
    expect(listHref(EMPTY)).toBe("/admin/documents");
  });

  it("writes only the filters that are set, using category slugs", () => {
    const href = listHref({ ...EMPTY, category: "financial_report", status: "draft", q: "fy 2025", expiring: true, sort: "issued", page: 2 });
    const url = new URL(href, "https://x.test");
    expect(url.pathname).toBe("/admin/documents");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: "financial-reports",
      status: "draft",
      q: "fy 2025",
      expiring: "1",
      sort: "issued",
      page: "2",
    });
  });

  it("returns to page 1 whenever a filter changes", () => {
    const base: ListQuery = { ...EMPTY, status: "draft", page: 4 };
    expect(listHref(base, { visibility: "public" })).not.toContain("page=");
    expect(listHref(base, { page: 5 })).toContain("page=5");
  });

  it("encodes the search term so it cannot break out of the query string", () => {
    const href = listHref({ ...EMPTY, q: 'a&b=c#d "quoted"' });
    const url = new URL(href, "https://x.test");
    expect(url.searchParams.get("q")).toBe('a&b=c#d "quoted"');
    expect(url.searchParams.get("b")).toBeNull();
    expect(url.hash).toBe("");
  });

  it("round-trips through parseListQuery", () => {
    const query: ListQuery = { category: "program_record", status: "published", visibility: "unlisted", q: "sara", expiring: true, sort: "title", page: 6 };
    const params = Object.fromEntries(new URL(listHref(query), "https://x.test").searchParams);
    expect(parseListQuery(params)).toEqual(query);
  });

  it("every sort option can be addressed", () => {
    for (const option of SORT_OPTIONS) {
      expect(parseListQuery({ sort: option.value }).sort).toBe(option.value);
    }
  });
});

describe("toListFilters", () => {
  it("maps a query onto the store filters with the page size and offset", () => {
    const filters = toListFilters({ ...EMPTY, category: "certification", status: "published", q: "iso", expiring: true, sort: "title", page: 3 }, 60);
    expect(filters).toEqual({
      category: "certification",
      status: "published",
      visibility: undefined,
      q: "iso",
      expiringWithinDays: 60,
      sort: "title",
      limit: LIST_PAGE_SIZE,
      offset: 2 * LIST_PAGE_SIZE,
    });
  });

  it("leaves unset filters undefined so the store does not narrow by them", () => {
    const filters = toListFilters(EMPTY, 60);
    expect(filters.category).toBeUndefined();
    expect(filters.q).toBeUndefined();
    expect(filters.expiringWithinDays).toBeUndefined();
    expect(filters.offset).toBe(0);
  });
});

describe("activeFilterCount and clearedQuery", () => {
  it("counts narrowing filters but not sort or page", () => {
    expect(activeFilterCount(EMPTY)).toBe(0);
    expect(activeFilterCount({ ...EMPTY, sort: "title", page: 9 })).toBe(0);
    expect(activeFilterCount({ ...EMPTY, category: "program_record", status: "draft", q: "x", expiring: true, visibility: "private" })).toBe(5);
  });

  it("clears the filters and keeps the sort", () => {
    const cleared = clearedQuery({ ...EMPTY, category: "program_record", status: "draft", q: "x", sort: "title", page: 4 });
    expect(cleared).toEqual({ ...EMPTY, sort: "title" });
  });
});

describe("paginate", () => {
  it("computes the window for a middle page", () => {
    expect(paginate(112, 2)).toMatchObject({ page: 2, pages: 5, offset: 25, from: 26, to: 50, hasPrev: true, hasNext: true, clamped: false });
  });

  it("handles the last, partial page", () => {
    expect(paginate(112, 5)).toMatchObject({ page: 5, from: 101, to: 112, hasNext: false });
  });

  it("treats an empty list as one empty page", () => {
    expect(paginate(0, 1)).toMatchObject({ page: 1, pages: 1, from: 0, to: 0, hasPrev: false, hasNext: false, clamped: false });
  });

  it("pulls an out-of-range page back and says so", () => {
    expect(paginate(30, 9)).toMatchObject({ page: 2, pages: 2, clamped: true });
    expect(paginate(30, 0)).toMatchObject({ page: 1, clamped: true });
  });

  it("is exact at the boundary", () => {
    expect(paginate(25, 1).pages).toBe(1);
    expect(paginate(26, 1).pages).toBe(2);
  });

  it("survives nonsense totals", () => {
    expect(paginate(Number.NaN, 1).total).toBe(0);
    expect(paginate(-5, 1).total).toBe(0);
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("keeps the ends and the neighbours, with a gap for a skipped run", () => {
    expect(pageItems(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageItems(1, 20)).toEqual([1, 2, "gap", 20]);
    expect(pageItems(20, 20)).toEqual([1, "gap", 19, 20]);
  });

  it("shows a single skipped page as the page itself", () => {
    expect(pageItems(4, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
    expect(pageItems(5, 8)).toEqual([1, "gap", 4, 5, 6, 7, 8]);
  });
});

describe("describeEmptyList", () => {
  it("invites the first document when nothing is filtered", () => {
    const copy = describeEmptyList(EMPTY, 60);
    expect(copy.title).toBe("No documents yet");
    expect(copy.action).toEqual({ label: "Add a document", href: "/admin/documents/new" });
  });

  it("offers the category's own editor when only a category is chosen", () => {
    const copy = describeEmptyList({ ...EMPTY, category: "experience_letter" }, 60);
    expect(copy.title).toBe("No experience letters yet");
    expect(copy.action?.href).toBe("/admin/documents/new?category=experience-letters");
  });

  it("says what was searched for and offers to clear it", () => {
    const copy = describeEmptyList({ ...EMPTY, q: "zzz", status: "draft" }, 60);
    expect(copy.title).toContain("zzz");
    expect(copy.action?.href).toBe("/admin/documents?status=draft");
  });

  it("treats an empty expiring list as good news", () => {
    const copy = describeEmptyList({ ...EMPTY, expiring: true }, 60);
    expect(copy.title).toBe("Nothing expires in the next 60 days");
    expect(copy.action?.href).toBe("/admin/documents");
  });

  it("names the status and visibility filters and clears them together", () => {
    const copy = describeEmptyList({ ...EMPTY, category: "certification", status: "archived", visibility: "private", sort: "title" }, 60);
    expect(copy.title).toBe("No archived, private documents in Certifications");
    expect(copy.action?.href).toBe("/admin/documents?sort=title");
  });
});
