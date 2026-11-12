import { describe, expect, it } from "vitest";
import {
  ACTION_FILTER_OPTIONS,
  actionOptionsFor,
  activityHref,
  activityPagination,
  describeAuditEvent,
  humanizeAction,
  parseActivityQuery,
  summaryText,
} from "@/components/admin/pages/auditSummary";

/**
 * The activity page turns machine-named audit rows into sentences. The trail is the record of who
 * did what to the registry, so the wording has to be accurate (a revoke must not read as a delete)
 * and the URL filter must never let a stray value reach the query.
 */

const ID = "0a1b2c3d-1111-4222-8333-444455556666";
const event = (action: string, detail: Record<string, unknown> | null = null, entityType: string | null = "document", entityId: string | null = ID) => ({
  action,
  entityType,
  entityId,
  detail,
});

describe("describeAuditEvent", () => {
  it("reads a publish as a sentence with the record's title", () => {
    const summary = describeAuditEvent(event("document.publish", { title: "FY 2025-26 Statements", category: "financial_report" }));
    expect(summaryText(summary)).toBe("Published “FY 2025-26 Statements”");
    expect(summary.tone).toBe("success");
    expect(summary.notes).toEqual(["Financial report"]);
    expect(summary.href).toBe(`/admin/documents/${ID}`);
  });

  it("has a verb for every document action", () => {
    const expected: Record<string, string> = {
      "document.create": "Created",
      "document.update": "Edited",
      "document.delete": "Deleted",
      "document.publish": "Published",
      "document.unpublish": "Unpublished",
      "document.archive": "Archived",
      "document.restore": "Restored",
      "document.revoke": "Revoked",
      "document.reinstate": "Reinstated",
      "document.regenerate_code": "Replaced the verification code of",
      "document.duplicate": "Duplicated",
    };
    for (const [action, verb] of Object.entries(expected)) {
      expect(describeAuditEvent(event(action, { title: "T" })).verb).toBe(verb);
    }
  });

  it("does not link to a record that has been deleted", () => {
    expect(describeAuditEvent(event("document.delete", { title: "Gone" })).href).toBeNull();
    expect(describeAuditEvent(event("document.update", { title: "Here" })).href).not.toBeNull();
  });

  it("shows a revoke reason and marks the event as serious", () => {
    const summary = describeAuditEvent(event("document.revoke", { title: "Experience letter", reason: "Left the company" }));
    expect(summary.tone).toBe("danger");
    expect(summary.notes).toContain("Reason: Left the company");
  });

  it("describes sign-in activity without any record", () => {
    expect(summaryText(describeAuditEvent(event("login.success", null, null, null)))).toBe("Signed in");
    expect(summaryText(describeAuditEvent(event("login.failure", null, null, null)))).toBe("Failed sign-in attempt");
    expect(summaryText(describeAuditEvent(event("logout", null, null, null)))).toBe("Signed out");
    const locked = describeAuditEvent(event("login.locked", { retryAfter: 900 }, null, null));
    expect(locked.tone).toBe("danger");
    expect(locked.notes).toEqual(["Locked for 15m"]);
    expect(locked.subject).toBeNull();
    expect(locked.href).toBeNull();
  });

  it("falls back gracefully when the title is missing or not text", () => {
    expect(summaryText(describeAuditEvent(event("document.update", null)))).toBe("Edited “a document”");
    expect(summaryText(describeAuditEvent(event("document.update", { title: 42 })))).toBe("Edited “a document”");
    expect(summaryText(describeAuditEvent(event("document.update", { title: "   " })))).toBe("Edited “a document”");
  });

  it("clips a very long title and collapses its whitespace", () => {
    const summary = describeAuditEvent(event("document.create", { title: `${"Long ".repeat(100)}\n\tend` }));
    expect(summary.subject?.length).toBeLessThanOrEqual(120);
    expect(summary.subject).not.toMatch(/[\n\t]/);
  });

  it("ignores a category it does not know instead of printing it", () => {
    expect(describeAuditEvent(event("document.create", { title: "T", category: "<script>" })).notes).toEqual([]);
  });

  it("humanises an action it has not met", () => {
    const summary = describeAuditEvent(event("document.export_pdf", { title: "T" }, "document", null));
    expect(summary.verb).toBe("Document export pdf");
    expect(summary.href).toBeNull();
    expect(humanizeAction("")).toBe("Unknown action");
  });
});

describe("parseActivityQuery", () => {
  it("defaults to everything on the first page", () => {
    expect(parseActivityQuery({})).toEqual({ action: null, entity: null, page: 1 });
  });

  it("reads an action, a record and a page", () => {
    expect(parseActivityQuery({ action: "document.publish", entity: ID.toUpperCase(), page: "3" })).toEqual({
      action: "document.publish",
      entity: ID,
      page: 3,
    });
  });

  it("drops anything that is not shaped like an action name or a record id", () => {
    for (const action of ["DROP TABLE", "a b", "../x", "x'--", "1abc", "a".repeat(80)]) {
      expect(parseActivityQuery({ action }).action).toBeNull();
    }
    expect(parseActivityQuery({ entity: "not-an-id" }).entity).toBeNull();
    expect(parseActivityQuery({ page: "-1" }).page).toBe(1);
    expect(parseActivityQuery({ page: "abc" }).page).toBe(1);
  });
});

describe("activityHref", () => {
  it("is the bare page when nothing is filtered", () => {
    expect(activityHref({ action: null, entity: null, page: 1 })).toBe("/admin/activity");
  });

  it("writes filters and resets the page when a filter changes", () => {
    const query = { action: "login.failure", entity: null, page: 4 };
    expect(activityHref(query, { action: "logout" })).toBe("/admin/activity?action=logout");
    expect(activityHref(query, { page: 5 })).toBe("/admin/activity?action=login.failure&page=5");
    expect(activityHref(query, { action: null })).toBe("/admin/activity");
  });

  it("round-trips through parseActivityQuery", () => {
    const query = { action: "document.revoke", entity: ID, page: 2 };
    const params = Object.fromEntries(new URL(activityHref(query), "https://x.test").searchParams);
    expect(parseActivityQuery(params)).toEqual(query);
  });
});

describe("actionOptionsFor", () => {
  it("starts with everything and lists the known actions", () => {
    const options = actionOptionsFor(null);
    expect(options[0]).toEqual({ value: "", label: "All activity" });
    expect(options.length).toBe(ACTION_FILTER_OPTIONS.length + 1);
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
  });

  it("keeps an unfamiliar filter visible so the menu never contradicts the URL", () => {
    const options = actionOptionsFor("document.export_pdf");
    expect(options.at(-1)).toEqual({ value: "document.export_pdf", label: "Document export pdf" });
    expect(actionOptionsFor("logout").filter((option) => option.value === "logout")).toHaveLength(1);
  });
});

describe("activityPagination", () => {
  it("pages 25 at a time", () => {
    expect(activityPagination(60, 3)).toMatchObject({ pages: 3, from: 51, to: 60 });
  });
});
