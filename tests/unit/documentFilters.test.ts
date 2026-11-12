import { describe, expect, it } from "vitest";
import { CERTS_LETTERS_FILTER, CERTS_LETTERS_SECTION, LETTERS_ANCHOR_ID, PUBLIC_SECTIONS } from "@/components/documents/content";
import {
  DIRECTION_FILTERS,
  SECTION_VIEWS,
  countDirections,
  describeSelection,
  showsDirectionFilter,
  viewFromHash,
} from "@/components/documents/filters";
import { CATEGORIES } from "@/lib/documents/categories";
import type { PublicDocument } from "@/lib/documents/public";
import type { FieldValue } from "@/lib/documents/types";

const certs = (...directions: Array<string | undefined>): Array<Pick<PublicDocument, "fields">> =>
  directions.map((direction) => {
    const fields: Record<string, FieldValue> = {};
    if (direction !== undefined) fields.direction = direction;
    return { fields };
  });

describe("the filter vocabulary", () => {
  it("offers All, Certifications and Experience letters, then All, Held by ACEVA and Issued by ACEVA", () => {
    expect([...SECTION_VIEWS]).toEqual(["all", "certifications", "letters"]);
    expect(Object.values(CERTS_LETTERS_FILTER.views)).toEqual(["All", "Certifications", "Experience letters"]);
    expect([...DIRECTION_FILTERS]).toEqual(["all", "held", "issued"]);
    expect(Object.values(CERTS_LETTERS_FILTER.directions)).toEqual(["All", "Held by ACEVA", "Issued by ACEVA"]);
  });

  it("matches the certification field's own option values and labels, so the chips cannot drift from the data", () => {
    const direction = CATEGORIES.certification.fields.find((field) => field.key === "direction");
    expect(direction?.options?.map((option) => option.value)).toEqual(["held", "issued"]);
    expect(direction?.options?.map((option) => option.label)).toEqual([CERTS_LETTERS_FILTER.directions.held, CERTS_LETTERS_FILTER.directions.issued]);
  });

  it("keeps the old certifications id for the merged section, and numbers four sections", () => {
    expect(CERTS_LETTERS_SECTION.slug).toBe("certifications");
    expect(CERTS_LETTERS_SECTION.plural).toBe("Certifications & letters");
    expect(LETTERS_ANCHOR_ID).toBe("experience-letters");
    expect([...PUBLIC_SECTIONS]).toEqual(["financial_report", "company_identity", "certifications_letters", "program_record"]);
  });
});

describe("countDirections", () => {
  it("counts held and issued certificates", () => {
    expect(countDirections(certs("held", "held", "issued"))).toEqual({ held: 2, issued: 1 });
  });

  it("counts nothing for an empty list, a missing direction or one it does not know", () => {
    expect(countDirections([])).toEqual({ held: 0, issued: 0 });
    expect(countDirections(certs(undefined, "other", ""))).toEqual({ held: 0, issued: 0 });
  });
});

describe("showsDirectionFilter", () => {
  it("is shown only when both kinds exist", () => {
    expect(showsDirectionFilter({ held: 2, issued: 1 })).toBe(true);
    expect(showsDirectionFilter({ held: 3, issued: 0 })).toBe(false);
    expect(showsDirectionFilter({ held: 0, issued: 1 })).toBe(false);
    expect(showsDirectionFilter({ held: 0, issued: 0 })).toBe(false);
  });
});

describe("viewFromHash", () => {
  it("selects the Experience letters view for the old #experience-letters link", () => {
    expect(viewFromHash("#experience-letters")).toBe("letters");
  });

  it("leaves the reader's choice alone for the section's own link and for anything else", () => {
    expect(viewFromHash("#certifications")).toBeNull();
    expect(viewFromHash("#team")).toBeNull();
    expect(viewFromHash("")).toBeNull();
    expect(viewFromHash("#")).toBeNull();
    expect(viewFromHash("#experience-letters-extra")).toBeNull();
    expect(viewFromHash("experience-letters")).toBeNull();
  });
});

describe("describeSelection (the live status line)", () => {
  const both = { held: 2, issued: 1 };

  it("describes the letters view without any count, because letters are never listed", () => {
    const text = describeSelection("letters", "all", 3, both);
    expect(text).toMatch(/^Showing experience letters\./);
    expect(text).toContain("never listed");
    expect(text).not.toMatch(/\d/);
  });

  it("counts the certifications, singular and plural", () => {
    expect(describeSelection("certifications", "all", 3, both)).toBe("Showing 3 certifications.");
    expect(describeSelection("certifications", "all", 1, { held: 1, issued: 0 })).toBe("Showing 1 certification.");
  });

  it("narrows by direction when both exist", () => {
    expect(describeSelection("certifications", "held", 3, both)).toBe("Showing 2 certifications held by ACEVA.");
    expect(describeSelection("certifications", "issued", 3, both)).toBe("Showing 1 certification issued by ACEVA.");
  });

  it("ignores a leftover direction when there is only one kind to choose from", () => {
    expect(describeSelection("certifications", "issued", 3, { held: 3, issued: 0 })).toBe("Showing 3 certifications.");
  });

  it("adds the letters note to the All view", () => {
    const text = describeSelection("all", "held", 3, both);
    expect(text).toContain("Showing 2 certifications held by ACEVA.");
    expect(text).toContain("Experience letters are never listed.");
  });

  it("says so when there are none, and claims no number when the registry could not be reached", () => {
    expect(describeSelection("certifications", "all", 0, { held: 0, issued: 0 })).toBe("No certifications published yet.");
    expect(describeSelection("certifications", "all", null, { held: 0, issued: 0 })).toBe("Showing certifications.");
    expect(describeSelection("all", "all", null, { held: 0, issued: 0 })).not.toMatch(/\d/);
  });
});
