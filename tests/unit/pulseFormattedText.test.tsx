import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import PulseFormattedText, { safeHref } from "@/components/pulse/PulseFormattedText";

/** The markup the component actually produces for a block of markdown. */
function render(content: string): string {
  return renderToStaticMarkup(React.createElement(PulseFormattedText, { content }));
}

describe("safeHref", () => {
  describe("accepts", () => {
    const allowed = [
      ["absolute https", "https://acevatech.com/services"],
      ["https with port and query", "https://example.com:8443/a?b=c#d"],
      ["root-relative path", "/contact"],
      ["path with query", "/services?tab=mobile"],
      ["fragment", "#pricing"],
      ["bare query", "?step=2"],
    ] as const;

    for (const [label, href] of allowed) {
      it(label, () => {
        expect(safeHref(href)).toBe(href);
      });
    }

    it("trims surrounding whitespace", () => {
      expect(safeHref("  /contact  ")).toBe("/contact");
    });
  });

  describe("rejects", () => {
    const blocked = [
      ["javascript URL", "javascript:alert(1)"],
      ["uppercased javascript URL", "JavaScript:alert(1)"],
      ["data URL", "data:text/html,<script>alert(1)</script>"],
      ["vbscript URL", "vbscript:msgbox(1)"],
      ["plain http", "http://example.com"],
      ["file URL", "file:///etc/passwd"],
      // Both of these leave the origin despite looking relative.
      ["protocol-relative", "//evil.example/steal"],
      ["backslash-relative", "/\\evil.example/steal"],
      ["empty", ""],
      ["whitespace only", "   "],
      ["bare word", "notaurl"],
      ["relative without a leading slash", "services/mobile"],
    ] as const;

    for (const [label, href] of blocked) {
      it(label, () => {
        expect(safeHref(href)).toBeNull();
      });
    }
  });
});


describe("PulseFormattedText rendering", () => {
  describe("ordered lists", () => {
    it("renders a numbered list as <ol>, keeping its numbering", () => {
      // Every list used to be flattened into a <ul>, so numbering was lost.
      const html = render("1. First thing\n2. Second thing\n3. Third thing");

      expect(html).toContain("<ol");
      expect(html).not.toContain("<ul");
      expect(html.match(/<li>/g)).toHaveLength(3);
      expect(html).toContain("First thing");
      expect(html).toContain("Third thing");
    });

    it("still renders bullets as <ul>", () => {
      const html = render("- one\n- two");
      expect(html).toContain("<ul");
      expect(html).not.toContain("<ol");
    });

    it("starts a new list when the marker style changes", () => {
      const html = render("1. numbered\n- bulleted");
      expect(html).toContain("<ol");
      expect(html).toContain("<ul");
    });

    it("accepts the 1) spelling", () => {
      expect(render("1) alpha\n2) beta")).toContain("<ol");
    });
  });

  describe("links", () => {
    it("renders a relative link without a target", () => {
      const html = render("See [contact us](/contact).");
      expect(html).toContain('href="/contact"');
      expect(html).toContain("contact us");
      expect(html).not.toContain('target="_blank"');
    });

    it("opens an https link in a new tab, safely", () => {
      const html = render("See [the site](https://acevatech.com).");
      expect(html).toContain('href="https://acevatech.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain("noopener");
      expect(html).toContain("noreferrer");
    });

    it("degrades an unsafe target to its label instead of a link", () => {
      for (const target of ["javascript:alert(1)", "//evil.example", "http://plain.example", "data:text/html,x"]) {
        const html = render(`Click [the label](${target}) now.`);

        expect(html).not.toContain("<a");
        expect(html).toContain("the label");
        expect(html).not.toContain("javascript:");
        expect(html).not.toContain("evil.example");
      }
    });

    it("renders links inside list items and table cells", () => {
      expect(render("- see [docs](/faq)")).toContain('href="/faq"');
      expect(render("| a |\n| --- |\n| [x](/contact) |")).toContain('href="/contact"');
    });
  });

  describe("code fences", () => {
    it("renders a fence as <pre><code> and leaves markdown inside it alone", () => {
      const html = render("```ts\nconst a = 1; // **not bold**\n```");

      expect(html).toContain("<pre");
      expect(html).toContain("<code");
      expect(html).toContain("**not bold**");
      expect(html).not.toContain("<strong>");
    });

    it("preserves blank lines and indentation inside a fence", () => {
      const html = render("```\nline one\n\n    indented\n```");
      expect(html).toContain("line one");
      expect(html).toContain("    indented");
    });

    it("records the language on the element", () => {
      expect(render("```python\nx = 1\n```")).toContain('data-language="python"');
    });

    it("renders an unterminated fence as code rather than dropping it", () => {
      const html = render("```\nnever closed");
      expect(html).toContain("<pre");
      expect(html).toContain("never closed");
    });
  });

  it("still renders bold, inline code and headings", () => {
    const html = render("## Heading\n\n**bold** and `code`");
    expect(html).toContain("<h4");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code");
  });

  it("escapes HTML in the source rather than rendering it", () => {
    const html = render('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});
