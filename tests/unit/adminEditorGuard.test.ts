import { describe, expect, it } from "vitest";
import { guardedDestination, type ClickFacts, type CurrentLocation } from "@/components/admin/editor/editorGuard";

const here: CurrentLocation = { origin: "https://admin.example.test", pathname: "/admin/documents/abc", search: "" };

function click(overrides: Partial<ClickFacts> = {}): ClickFacts {
  return { href: "/admin/documents", target: null, download: false, button: 0, modified: false, defaultPrevented: false, ...overrides };
}

describe("guardedDestination", () => {
  it("holds back a plain click on an in-app link and returns where it points", () => {
    expect(guardedDestination(click(), here)).toBe("/admin/documents");
    expect(guardedDestination(click({ href: "/admin/documents?category=ids#top" }), here)).toBe("/admin/documents?category=ids#top");
  });

  it("accepts an absolute link to the same origin", () => {
    expect(guardedDestination(click({ href: "https://admin.example.test/admin" }), here)).toBe("/admin");
  });

  it("leaves modified, non-primary and already handled clicks alone", () => {
    expect(guardedDestination(click({ modified: true }), here)).toBeNull();
    expect(guardedDestination(click({ button: 1 }), here)).toBeNull();
    expect(guardedDestination(click({ button: 2 }), here)).toBeNull();
    expect(guardedDestination(click({ defaultPrevented: true }), here)).toBeNull();
  });

  it("leaves new tabs and downloads to the browser", () => {
    expect(guardedDestination(click({ target: "_blank" }), here)).toBeNull();
    expect(guardedDestination(click({ target: "_self" }), here)).toBe("/admin/documents");
    expect(guardedDestination(click({ download: true }), here)).toBeNull();
  });

  it("does not hold a link that goes nowhere", () => {
    expect(guardedDestination(click({ href: null }), here)).toBeNull();
    expect(guardedDestination(click({ href: "" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "#section" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "/admin/documents/abc#section" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "/admin/documents/abc" }), here)).toBeNull();
  });

  it("treats a different query string as a different page", () => {
    expect(guardedDestination(click({ href: "/admin/documents/abc?x=1" }), here)).toBe("/admin/documents/abc?x=1");
  });

  it("leaves other sites and non-web links to beforeunload and the browser", () => {
    expect(guardedDestination(click({ href: "https://example.com/" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "//example.com/path" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "mailto:hello@example.com" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "javascript:alert(1)" }), here)).toBeNull();
    expect(guardedDestination(click({ href: "tel:+123" }), here)).toBeNull();
  });

  it("never returns a destination outside the current origin", () => {
    for (const href of ["//evil.test/admin", "https://evil.test/admin", "http://admin.example.test/admin", "/\\evil.test"]) {
      const destination = guardedDestination(click({ href }), here);
      if (destination !== null) expect(destination.startsWith("/")).toBe(true);
      if (destination !== null) expect(destination.startsWith("//")).toBe(false);
    }
  });

  it("copes with a malformed href", () => {
    expect(() => guardedDestination(click({ href: "http://[bad" }), here)).not.toThrow();
    expect(guardedDestination(click({ href: "http://[bad" }), here)).toBeNull();
  });
});
