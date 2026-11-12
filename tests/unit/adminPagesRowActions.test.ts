import { describe, expect, it } from "vitest";
import {
  DELETE_PHRASE,
  availableActionIds,
  buildActionGroups,
  buildActionRequest,
  cardHref,
  confirmCopy,
  describeActionFailure,
  destinationAfter,
  documentIdFromResponse,
  isWorkflowAction,
  publicPagePath,
  qrDownloadHref,
  successMessage,
  validateRevokeReason,
  type MenuActionId,
  type RowActionsTarget,
} from "@/components/admin/pages/actionRules";
import { MENU_WIDTH, estimateMenuHeight, placeMenu } from "@/components/admin/pages/menuPlacement";

/**
 * The per-row actions menu decides what an admin may do to a record in each state, and what the
 * confirmation says. Offering the wrong action (publish on something already live, reinstate on
 * something that was never revoked) would be a trap, so the availability table is pinned down here.
 */

const CODE = "ACV-7K3M-9QXD-4TRH";
const ID = "0a1b2c3d-1111-4222-8333-444455556666";

function target(overrides: Partial<RowActionsTarget> = {}): RowActionsTarget {
  return {
    id: ID,
    title: "Certificate of Incorporation",
    category: "company_identity",
    status: "draft",
    visibility: "public",
    revoked: false,
    verifyUrl: null,
    publicPath: null,
    ...overrides,
  };
}

describe("buildActionGroups", () => {
  it("offers a draft without a QR code the basics", () => {
    expect(availableActionIds(target())).toEqual(["edit", "publish", "archive", "duplicate", "delete"]);
  });

  it("offers a published record Unpublish instead of Publish", () => {
    const ids = availableActionIds(target({ status: "published" }));
    expect(ids).toContain("unpublish");
    expect(ids).not.toContain("publish");
    expect(ids).toContain("archive");
  });

  it("offers an archived record Restore and nothing that publishes or archives", () => {
    const ids = availableActionIds(target({ status: "archived" }));
    expect(ids).toContain("restore");
    expect(ids).not.toContain("publish");
    expect(ids).not.toContain("archive");
    expect(ids).not.toContain("unpublish");
  });

  it("shows QR shortcuts only when the record has a verification link", () => {
    const without = availableActionIds(target());
    expect(without).not.toContain("copy_link");
    expect(without).not.toContain("download_qr");
    const withLink = availableActionIds(target({ verifyUrl: `https://example.test/verify/${CODE}` }));
    expect(withLink).toContain("copy_link");
    expect(withLink).toContain("download_qr");
  });

  it("shows View public page only when there is somewhere public to go", () => {
    expect(availableActionIds(target())).not.toContain("view_public");
    expect(availableActionIds(target({ status: "published", publicPath: "/documents#certifications" }))).toContain("view_public");
  });

  it("offers Revoke where it has an effect and Reinstate once revoked, never both", () => {
    expect(availableActionIds(target())).not.toContain("revoke"); // an unpublished record with no code has nothing to withdraw
    expect(availableActionIds(target({ status: "published" }))).toContain("revoke");
    expect(availableActionIds(target({ verifyUrl: "https://example.test/verify/x" }))).toContain("revoke");

    const revoked = availableActionIds(target({ status: "published", revoked: true, verifyUrl: "https://example.test/verify/x" }));
    expect(revoked).toContain("reinstate");
    expect(revoked).not.toContain("revoke");
  });

  it("offers Print QR labels for any record that has a QR code to print, and for none that has not", () => {
    for (const category of ["certification", "program_record", "experience_letter", "company_identity"] as const) {
      expect(availableActionIds(target({ category, verifyUrl: "https://example.test/verify/x" })), category).toContain("print_card");
      expect(availableActionIds(target({ category })), category).not.toContain("print_card");
    }
    const print = buildActionGroups(target({ verifyUrl: "https://example.test/verify/x" })).flat().find((action) => action.id === "print_card");
    expect(print?.label).toBe("Print QR labels");
  });

  it("puts Delete alone in its own last group, marked dangerous", () => {
    const groups = buildActionGroups(target({ status: "published", revoked: false }));
    const last = groups[groups.length - 1];
    expect(last).toEqual([{ id: "delete", label: "Delete", tone: "danger" }]);
    const danger = groups.flat().filter((action) => action.tone === "danger").map((action) => action.id);
    expect(danger).toEqual(["revoke", "delete"]);
  });

  it("always offers Edit first and Duplicate", () => {
    for (const status of ["draft", "published", "archived"] as const) {
      const ids = availableActionIds(target({ status }));
      expect(ids[0]).toBe("edit");
      expect(ids).toContain("duplicate");
    }
  });
});

describe("publicPagePath", () => {
  const base = { category: "certification" as const, status: "published" as const, visibility: "public" as const, verificationCode: CODE };

  it("sends a record with a code to its verify page", () => {
    expect(publicPagePath(base)).toBe(`/verify/${CODE}`);
    expect(publicPagePath({ ...base, visibility: "unlisted" })).toBe(`/verify/${CODE}`);
  });

  it("sends a public record without a code to its section of the listing", () => {
    expect(publicPagePath({ ...base, verificationCode: null })).toBe("/documents#certifications");
    expect(publicPagePath({ ...base, category: "financial_report", verificationCode: null })).toBe("/documents#financial-reports");
  });

  it("has no public page for anything that is not live and reachable", () => {
    expect(publicPagePath({ ...base, status: "draft" })).toBeNull();
    expect(publicPagePath({ ...base, status: "archived" })).toBeNull();
    expect(publicPagePath({ ...base, visibility: "private" })).toBeNull();
    expect(publicPagePath({ ...base, visibility: "unlisted", verificationCode: null })).toBeNull();
  });
});

describe("links", () => {
  it("builds the QR download and card URLs from the id", () => {
    expect(qrDownloadHref(ID)).toBe(`/api/admin/documents/${ID}/qr?format=png&size=768&download=1`);
    expect(qrDownloadHref(ID, "svg", 512)).toBe(`/api/admin/documents/${ID}/qr?format=svg&size=512&download=1`);
    expect(cardHref(ID)).toBe(`/admin/documents/${ID}/card`);
  });

  it("encodes an id so it cannot add path segments or parameters", () => {
    expect(qrDownloadHref("a/../b?x=1")).toContain("a%2F..%2Fb%3Fx%3D1");
  });
});

describe("confirmCopy", () => {
  it("asks before every consequential action", () => {
    const needing: MenuActionId[] = ["publish", "unpublish", "archive", "revoke", "reinstate", "delete"];
    for (const action of needing) expect(confirmCopy(action, { visibility: "public" })).not.toBeNull();
  });

  it("does not interrupt the harmless ones", () => {
    for (const action of ["restore", "duplicate", "edit", "copy_link", "download_qr"] as MenuActionId[]) {
      expect(confirmCopy(action, { visibility: "public" })).toBeNull();
    }
  });

  it("tells a publisher exactly who will see it", () => {
    expect(confirmCopy("publish", { visibility: "public" })?.trail).toContain("public Documents page");
    expect(confirmCopy("publish", { visibility: "unlisted" })?.trail).toContain("QR code or verification code");
    expect(confirmCopy("publish", { visibility: "private" })?.trail).toContain("admin-only");
  });

  it("makes revoke ask for a reason and delete require the typed word", () => {
    const revoke = confirmCopy("revoke", { visibility: "public" });
    expect(revoke).toMatchObject({ tone: "danger", needsReason: true });
    const del = confirmCopy("delete", { visibility: "public" });
    expect(del).toMatchObject({ tone: "danger", requireText: DELETE_PHRASE });
    expect(DELETE_PHRASE).toBe("DELETE");
    expect(del?.trail).toContain("cannot be undone");
  });
});

describe("validateRevokeReason", () => {
  it("rejects an empty, whitespace-only or one-word-too-short reason", () => {
    expect(validateRevokeReason("")).not.toBeNull();
    expect(validateRevokeReason("   ")).not.toBeNull();
    expect(validateRevokeReason("ab")).not.toBeNull();
  });

  it("accepts a real reason and rejects an essay", () => {
    expect(validateRevokeReason("Issued in error")).toBeNull();
    expect(validateRevokeReason("x".repeat(500))).toBeNull();
    expect(validateRevokeReason("x".repeat(501))).not.toBeNull();
  });
});

describe("buildActionRequest", () => {
  it("posts workflow actions as JSON to the actions endpoint", () => {
    const request = buildActionRequest(ID, "publish");
    expect(request.method).toBe("POST");
    expect(request.url).toBe(`/api/admin/documents/${ID}/actions`);
    expect(JSON.parse(request.body ?? "")).toEqual({ action: "publish" });
  });

  it("sends a trimmed reason with a revoke and with nothing else", () => {
    expect(JSON.parse(buildActionRequest(ID, "revoke", "  Issued in error  ").body ?? "")).toEqual({ action: "revoke", reason: "Issued in error" });
    expect(JSON.parse(buildActionRequest(ID, "archive", "ignored").body ?? "")).toEqual({ action: "archive" });
  });

  it("deletes with DELETE and no body", () => {
    expect(buildActionRequest(ID, "delete")).toEqual({ url: `/api/admin/documents/${ID}`, method: "DELETE", body: undefined });
  });

  it("recognises exactly the workflow actions the API serves", () => {
    const workflow: MenuActionId[] = ["publish", "unpublish", "archive", "restore", "revoke", "reinstate", "duplicate"];
    for (const action of workflow) expect(isWorkflowAction(action)).toBe(true);
    for (const action of ["delete", "edit", "copy_link"] as MenuActionId[]) expect(isWorkflowAction(action)).toBe(false);
  });
});

describe("successMessage", () => {
  it("names the record in curly quotes", () => {
    expect(successMessage("publish", "Annual report")).toBe("Published “Annual report”");
    expect(successMessage("unpublish", "X")).toBe("“X” moved back to draft");
    expect(successMessage("delete", "X")).toBe("Deleted “X”");
  });

  it("clips a very long title so the toast stays readable", () => {
    const message = successMessage("archive", "T".repeat(300));
    expect(message.length).toBeLessThan(90);
    expect(message).toContain("…");
  });
});

describe("describeActionFailure", () => {
  const envelope = (code: string, extra: Record<string, unknown> = {}) => ({ ok: false, error: "Display copy", code, retryable: false, requestId: "req_1", ...extra });

  it("lists why a publish was refused, so the person knows what to fix", () => {
    const notice = describeActionFailure(
      "publish",
      400,
      envelope("VALIDATION_FAILED", { fieldMessages: { file: "Attach the document file.", issuedOn: "Add the issue date." } }),
    );
    expect(notice.message).toBe("It cannot be published yet.");
    expect(notice.description).toBe("Attach the document file. Add the issue date.");
    expect(notice.signedOut).toBe(false);
  });

  it("caps the list of reasons", () => {
    const fieldMessages = { a: "One.", b: "Two.", c: "Three.", d: "Four.", e: "Five." };
    const notice = describeActionFailure("publish", 400, envelope("VALIDATION_FAILED", { fieldMessages }));
    expect(notice.description).toBe("One. Two. Three. And 2 more.");
  });

  it("falls back to the server's copy when a validation failure names no field", () => {
    expect(describeActionFailure("archive", 400, envelope("VALIDATION_FAILED")).description).toBe("Display copy");
  });

  it("recognises an ended session so the page can refresh into the login screen", () => {
    expect(describeActionFailure("publish", 401, envelope("UNAUTHENTICATED")).signedOut).toBe(true);
    expect(describeActionFailure("publish", 401, null).signedOut).toBe(true);
  });

  it("explains a vanished record and a concurrent edit", () => {
    expect(describeActionFailure("delete", 404, envelope("NOT_FOUND")).message).toBe("That document no longer exists.");
    expect(describeActionFailure("archive", 409, envelope("CONFLICT")).message).toBe("The document changed in the meantime.");
  });

  it("never echoes unknown server text for other failures", () => {
    const notice = describeActionFailure("archive", 500, envelope("INTERNAL_ERROR", { error: "connection refused at 10.0.0.1" }));
    expect(`${notice.message} ${notice.description}`).not.toContain("10.0.0.1");
    const html = describeActionFailure("archive", 502, "<html>Bad gateway</html>");
    expect(html.message).toBe("Something went wrong.");
  });
});

describe("destinationAfter", () => {
  it("opens the new copy after a duplicate and stays put otherwise", () => {
    const body = { ok: true, document: { id: ID } };
    expect(destinationAfter("duplicate", body)).toBe(`/admin/documents/${ID}`);
    expect(destinationAfter("publish", body)).toBeNull();
    expect(destinationAfter("duplicate", { ok: true })).toBeNull();
    expect(destinationAfter("duplicate", { ok: true, document: { id: "../../evil" } })).toBeNull();
  });

  it("only trusts a well-formed id in a response", () => {
    expect(documentIdFromResponse({ document: { id: ID } })).toBe(ID);
    expect(documentIdFromResponse({ document: { id: 7 } })).toBeNull();
    expect(documentIdFromResponse(null)).toBeNull();
    expect(documentIdFromResponse("text")).toBeNull();
  });
});

describe("placeMenu", () => {
  const viewport = { width: 1280, height: 800 };
  const trigger = (top: number, right = 1200) => ({ top, bottom: top + 44, left: right - 44, right });

  it("opens downwards, right-aligned to the button, when it fits", () => {
    const placement = placeMenu(trigger(100), viewport, 6, 3);
    expect(placement.above).toBe(false);
    expect(placement.top).toBe(150);
    expect(placement.left).toBe(1200 - MENU_WIDTH);
    expect(placement.bottom).toBeUndefined();
  });

  it("flips upwards near the bottom of the screen when there is more room above", () => {
    const placement = placeMenu(trigger(700), viewport, 8, 3);
    expect(placement.above).toBe(true);
    expect(placement.bottom).toBe(800 - 700 + 6);
    expect(placement.top).toBeUndefined();
  });

  it("stays on screen on a phone", () => {
    const phone = { width: 360, height: 640 };
    const placement = placeMenu({ top: 300, bottom: 344, left: 290, right: 334 }, phone, 8, 3);
    expect(placement.left).toBeGreaterThanOrEqual(8);
    expect(placement.left + MENU_WIDTH).toBeLessThanOrEqual(360 - 8 + 1);
  });

  it("scrolls inside the menu when neither side has room for it", () => {
    const short = { width: 800, height: 400 };
    const placement = placeMenu(trigger(180), short, 12, 3);
    expect(placement.maxHeight).toBeGreaterThanOrEqual(160);
    expect(placement.maxHeight).toBeLessThan(estimateMenuHeight(12, 3));
  });

  it("estimates height from items and separators", () => {
    expect(estimateMenuHeight(1, 1)).toBeLessThan(estimateMenuHeight(2, 1));
    expect(estimateMenuHeight(4, 2)).toBeGreaterThan(estimateMenuHeight(4, 1));
  });
});
