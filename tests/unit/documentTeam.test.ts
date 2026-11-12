import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryFromSlug, publicFieldKeys } from "@/lib/documents/categories";
import type { PublicDocument } from "@/lib/documents/public";
import {
  MIN_DEPARTMENTS_FOR_FILTER,
  TEAM_TIER_HEADINGS,
  countPeople,
  departmentCounts,
  departmentOf,
  describeDepartmentSelection,
  foldText,
  groupTeamByLevel,
  isHierarchyLevel,
  matchesDepartment,
  reportsToLabel,
  summariseTierFilter,
  teamLevel,
} from "@/lib/documents/team";
import { HIERARCHY_LEVELS } from "@/lib/documents/types";
import type { FieldValue } from "@/lib/documents/types";

let counter = 0;

/** A listed team member as the public projection would hand it over. */
function person(name: string, fields: Record<string, FieldValue> = {}, overrides: Partial<PublicDocument> = {}): PublicDocument {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    category: "program_record",
    title: `${name} headline`,
    summary: "",
    holderName: name,
    referenceNo: "",
    issuedOn: null,
    expiresOn: null,
    state: "valid",
    verificationCode: null,
    allowDownload: false,
    hasFile: false,
    hasPhoto: false,
    file: null,
    featured: false,
    publishedAt: null,
    revokedAt: null,
    fields,
    ...overrides,
  };
}

const names = (docs: readonly PublicDocument[]) => docs.map((doc) => doc.holderName);

describe("the hierarchy levels", () => {
  it("are ranked leadership, management, team lead, member, trainee", () => {
    expect([...HIERARCHY_LEVELS]).toEqual(["leadership", "management", "team_lead", "member", "trainee"]);
  });

  it("are offered by the admin select in exactly that order, with the agreed labels", () => {
    const field = CATEGORIES.program_record.fields.find((candidate) => candidate.key === "hierarchy_level");
    expect(field?.options?.map((option) => option.value)).toEqual([...HIERARCHY_LEVELS]);
    expect(field?.options?.map((option) => option.label)).toEqual(["Leadership", "Management", "Team lead", "Team member", "Intern / trainee"]);
  });

  it("each have a public tier heading", () => {
    expect(Object.keys(TEAM_TIER_HEADINGS)).toEqual([...HIERARCHY_LEVELS]);
    expect(Object.values(TEAM_TIER_HEADINGS)).toEqual(["Leadership", "Management", "Team leads", "Team members", "Interns & trainees"]);
  });

  it("are recognised by isHierarchyLevel and nothing else is", () => {
    for (const level of HIERARCHY_LEVELS) expect(isHierarchyLevel(level)).toBe(true);
    for (const other of ["", "Leadership", "wizard", null, undefined, 3, ["member"]]) expect(isHierarchyLevel(other)).toBe(false);
  });
});

describe("teamLevel", () => {
  it("reads a known level", () => {
    expect(teamLevel({ hierarchy_level: "management" })).toBe("management");
  });

  it("treats a missing level (a profile saved before levels existed) as a team member", () => {
    expect(teamLevel({})).toBe("member");
    expect(teamLevel({ role_title: "Engineer" })).toBe("member");
  });

  it("treats an unknown or malformed level as a team member rather than failing", () => {
    expect(teamLevel({ hierarchy_level: "wizard" })).toBe("member");
    expect(teamLevel({ hierarchy_level: "" })).toBe("member");
    expect(teamLevel({ hierarchy_level: 4 })).toBe("member");
    expect(teamLevel({ hierarchy_level: ["leadership"] })).toBe("member");
    expect(teamLevel({ hierarchy_level: null })).toBe("member");
  });
});

describe("groupTeamByLevel", () => {
  it("returns the tiers in rank order whatever order the people arrive in", () => {
    const tiers = groupTeamByLevel([
      person("Tia Trainee", { hierarchy_level: "trainee" }),
      person("Lena Lead", { hierarchy_level: "team_lead" }),
      person("Mo Member", { hierarchy_level: "member" }),
      person("Gina Manager", { hierarchy_level: "management" }),
      person("Lou Leader", { hierarchy_level: "leadership" }),
    ]);
    expect(tiers.map((tier) => tier.level)).toEqual(["leadership", "management", "team_lead", "member", "trainee"]);
    expect(tiers.map((tier) => tier.heading)).toEqual(["Leadership", "Management", "Team leads", "Team members", "Interns & trainees"]);
  });

  it("drops tiers nobody belongs to, and returns nothing for an empty team", () => {
    const tiers = groupTeamByLevel([person("Lou", { hierarchy_level: "leadership" }), person("Tia", { hierarchy_level: "trainee" })]);
    expect(tiers.map((tier) => tier.level)).toEqual(["leadership", "trainee"]);
    expect(groupTeamByLevel([])).toEqual([]);
  });

  it("puts a person with no level, or an unknown one, in the team members tier", () => {
    const tiers = groupTeamByLevel([
      person("Old Record", {}),
      person("Odd Record", { hierarchy_level: "wizard" }),
      person("Real Member", { hierarchy_level: "member" }),
    ]);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].level).toBe("member");
    expect(names(tiers[0].docs).sort()).toEqual(["Odd Record", "Old Record", "Real Member"]);
  });

  it("orders a tier by featured first, then the admin's sort order, then name", () => {
    const a = person("Zoe", { hierarchy_level: "member" });
    const b = person("Amy", { hierarchy_level: "member" });
    const c = person("Bea", { hierarchy_level: "member" });
    const d = person("Dan", { hierarchy_level: "member" });
    const star = person("Wes", { hierarchy_level: "member" }, { featured: true });
    const sortOrders = new Map([
      [a.id, 0],
      [b.id, 5],
      [c.id, 5],
      [d.id, -3],
      [star.id, 99],
    ]);
    const [tier] = groupTeamByLevel([a, b, c, d, star], sortOrders);
    // star is featured so it leads despite the highest sort order; Dan (-3) before Zoe (0); Amy and Bea tie on 5 and fall back to name
    expect(names(tier.docs)).toEqual(["Wes", "Dan", "Zoe", "Amy", "Bea"]);
  });

  it("falls back to name order when no sort orders are given, ignoring case and accents", () => {
    const [tier] = groupTeamByLevel([
      person("charlie", { hierarchy_level: "member" }),
      person("Bob", { hierarchy_level: "member" }),
      person("Álvaro", { hierarchy_level: "member" }),
    ]);
    expect(names(tier.docs)).toEqual(["Álvaro", "Bob", "charlie"]);
  });

  it("ranks two featured people by sort order, and keeps equal names in a stable order", () => {
    const first = person("Same Name", { hierarchy_level: "member" }, { featured: true });
    const second = person("Same Name", { hierarchy_level: "member" }, { featured: true });
    const [tier] = groupTeamByLevel([second, first], new Map([[first.id, 1], [second.id, 1]]));
    expect(tier.docs.map((doc) => doc.id)).toEqual([first.id, second.id]);
  });

  it("does not reorder or modify the list it was given", () => {
    const input = [person("Zed", { hierarchy_level: "member" }), person("Abe", { hierarchy_level: "member" })];
    const before = names(input);
    groupTeamByLevel(input);
    expect(names(input)).toEqual(before);
  });
});

describe("departments", () => {
  it("counts each distinct department once, A to Z, keeping the first spelling", () => {
    const choices = departmentCounts([
      person("A", { department: "Engineering" }),
      person("B", { department: "  engineering " }),
      person("C", { department: "Design" }),
      person("D", { department: "Product   Design" }),
      person("E", { department: "product design" }),
      person("F", {}),
      person("G", { department: "   " }),
    ]);
    expect(choices).toEqual([
      { key: "design", label: "Design", count: 1 },
      { key: "engineering", label: "Engineering", count: 2 },
      { key: "product design", label: "Product Design", count: 2 },
    ]);
  });

  it("has none when nobody names a department, and the filter needs two", () => {
    expect(departmentCounts([person("A", {}), person("B", {})])).toEqual([]);
    expect(MIN_DEPARTMENTS_FOR_FILTER).toBe(2);
  });

  it("shows a department tidily and folds spellings together", () => {
    expect(departmentOf(person("A", { department: "  Platform   Team " }))).toBe("Platform Team");
    expect(departmentOf(person("A", {}))).toBe("");
    expect(foldText("  Platform   TEAM ")).toBe("platform team");
  });

  it("matches the All chip to everyone and a department chip to its own people", () => {
    expect(matchesDepartment("design", "")).toBe(true);
    expect(matchesDepartment("", "")).toBe(true);
    expect(matchesDepartment("design", "design")).toBe(true);
    expect(matchesDepartment("engineering", "design")).toBe(false);
    expect(matchesDepartment("", "design")).toBe(false);
  });

  it("recounts every tier for a department, and lists the tiers that still have somebody", () => {
    const tiers = [
      { level: "leadership" as const, people: [{ department: "executive" }] },
      { level: "management" as const, people: [{ department: "engineering" }, { department: "design" }] },
      { level: "member" as const, people: [{ department: "engineering" }, { department: "engineering" }, { department: "" }] },
    ];
    expect(summariseTierFilter(tiers, "")).toEqual({ counts: [1, 2, 3], visibleLevels: ["leadership", "management", "member"] });
    expect(summariseTierFilter(tiers, "engineering")).toEqual({ counts: [0, 1, 2], visibleLevels: ["management", "member"] });
    expect(summariseTierFilter(tiers, "design")).toEqual({ counts: [0, 1, 0], visibleLevels: ["management"] });
    expect(summariseTierFilter(tiers, "nonexistent")).toEqual({ counts: [0, 0, 0], visibleLevels: [] });
  });

  it("announces the selection in words, singular and plural", () => {
    const choices = departmentCounts([person("A", { department: "Design" }), person("B", { department: "Engineering" }), person("C", { department: "Engineering" })]);
    expect(describeDepartmentSelection("", choices, 3)).toBe("Showing everyone: 3 people.");
    expect(describeDepartmentSelection("design", choices, 3)).toBe("Showing 1 person in Design.");
    expect(describeDepartmentSelection("engineering", choices, 3)).toBe("Showing 2 people in Engineering.");
    expect(describeDepartmentSelection("gone", choices, 3)).toBe("");
    expect(countPeople(1)).toBe("1 person");
    expect(countPeople(0)).toBe("0 people");
  });
});

describe("reportsToLabel", () => {
  const boss = person("Hira Malik", { hierarchy_level: "leadership" });
  const everyone = [boss, person("Sana Ali", { reports_to: "hira malik" })];

  it("uses the listed manager's own spelling when the typed name matches (trimmed, any case)", () => {
    expect(reportsToLabel(everyone[1], everyone)).toBe("Hira Malik");
    expect(reportsToLabel(person("X", { reports_to: "  HIRA   MALIK  " }), everyone)).toBe("Hira Malik");
  });

  it("keeps a manager who is not on the listed team exactly as typed", () => {
    expect(reportsToLabel(person("X", { reports_to: "Someone  Outside" }), everyone)).toBe("Someone Outside");
  });

  it("shows nothing when there is no reporting line, or a person is named as their own manager", () => {
    expect(reportsToLabel(person("X", {}), everyone)).toBe("");
    expect(reportsToLabel(person("X", { reports_to: "   " }), everyone)).toBe("");
    expect(reportsToLabel(boss, [boss])).toBe("");
    const selfie = person("Dana Self", { reports_to: "dana self" });
    expect(reportsToLabel(selfie, [selfie])).toBe("");
  });

  it("only resolves one step: it never walks up a chain", () => {
    const top = person("Top", { hierarchy_level: "leadership" });
    const middle = person("Middle", { reports_to: "Top" });
    const bottom = person("Bottom", { reports_to: "Middle" });
    expect(reportsToLabel(bottom, [top, middle, bottom])).toBe("Middle");
  });
});

describe("the Team category spec", () => {
  const spec = CATEGORIES.program_record;
  const field = (key: string) => spec.fields.find((candidate) => candidate.key === key);

  it("keeps its internal key and is now called Team", () => {
    expect(spec.key).toBe("program_record");
    expect(spec.label).toBe("Team member");
    expect(spec.plural).toBe("Team");
    expect(spec.slug).toBe("team");
    expect(spec.eyebrow).toBe("Team");
    expect(spec.blurb).toBe(
      "The people behind ACEVA, from leadership to interns, shown with who they report to. Listed only with their consent.",
    );
    expect(spec.cardMeta).toEqual(["hierarchy_level", "role_title", "department"]);
    expect(categoryFromSlug("team")?.key).toBe("program_record");
    expect(categoryFromSlug("people-programs")).toBeUndefined();
  });

  it("words the base fields for a profile", () => {
    expect(spec.base.title).toMatchObject({ label: "Profile headline", required: true });
    expect(spec.base.holderName).toMatchObject({ label: "Full name", required: true });
    expect(spec.base.referenceNo.label).toBe("Staff / person ID");
    expect(spec.base.issuedOn).toMatchObject({ label: "Profile created on", required: false });
    expect(spec.base.expiresOn.hidden).toBe(true);
  });

  it("puts the position fields first, in a Position group", () => {
    expect(spec.fields.slice(0, 4).map((candidate) => candidate.key)).toEqual(["hierarchy_level", "reports_to", "role_title", "department"]);
    expect(spec.fields.slice(0, 4).every((candidate) => candidate.group === "Position")).toBe(true);
  });

  it("requires a level and a job title, and makes the program optional", () => {
    expect(field("hierarchy_level")).toMatchObject({ type: "select", required: true, public: true });
    expect(field("role_title")).toMatchObject({ label: "Role / job title", required: true, public: true });
    expect(field("department")?.label).toBe("Department / team");
    expect(field("program_name")).toMatchObject({ label: "Program (interns and fellows)", public: true });
    expect(field("program_name")?.required).not.toBe(true);
    expect(field("record_kind")).toMatchObject({ label: "Relationship", required: true });
  });

  it("adds a reports-to line with the agreed limits and wording", () => {
    expect(field("reports_to")).toMatchObject({
      type: "text",
      label: "Reports to",
      maxLength: 120,
      placeholder: "Their manager's full name",
      help: "Used to show reporting lines.",
      public: true,
    });
  });

  it("keeps every private field private, so the public projection can never carry them", () => {
    for (const key of ["contact_email", "internal_notes", "consent_to_publish", "show_photo"]) {
      expect(field(key)?.public, key).toBe(false);
      expect(publicFieldKeys("program_record")).not.toContain(key);
    }
    expect(publicFieldKeys("program_record")).toEqual(
      expect.arrayContaining(["hierarchy_level", "reports_to", "role_title", "department", "program_name", "cohort", "bio", "skills", "linkedin_url"]),
    );
  });
});
