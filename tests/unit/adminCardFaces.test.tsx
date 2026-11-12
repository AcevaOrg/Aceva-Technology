import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QrLabel } from "@/components/admin/card/LabelFaces";
import { PrintSheets } from "@/components/admin/card/PrintSheets";
import { SheetDiagram } from "@/components/admin/card/SheetDiagram";
import { ReadinessBanner, ReadinessChecklist } from "@/components/admin/card/Readiness";
import { QrPanel } from "@/components/admin/card/QrPanel";
import type { CardData, Readiness } from "@/components/admin/card/cardData";
import { LABEL_LIST, PAPERS, marksPath, planLabelSheet } from "@/components/admin/card/cardLayout";

const ID = "0b9d4f1e-6c1a-4f36-9a41-2f3c7d8e9a10";
const CODE = "ACV-7K3M-9QXD-4TRH";

function cardData(overrides: Partial<CardData> = {}): CardData {
  return {
    id: ID,
    category: "certification",
    categoryLabel: "Certification",
    title: "ISO 27001 Certificate",
    holderName: "ACEVA Technology",
    referenceNo: "ACV/CERT/2026/0042",
    qrSrc: `/api/admin/documents/${ID}/qr?format=svg`,
    verifyUrl: `https://acevatech.com/verify/${CODE}`,
    verifyShort: `acevatech.com/verify/${CODE}`,
    code: CODE,
    ...overrides,
  };
}

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("QrLabel", () => {
  it("renders every design with the QR", () => {
    for (const label of LABEL_LIST) {
      const html = render(<QrLabel data={cardData({ title: "ISO 27001", referenceNo: "ACV/CERT/2026/0042" })} kind={label.id} idPrefix="t" />);
      expect(html).toContain(`src="/api/admin/documents/${ID}/qr?format=svg"`);
      expect(html).toContain(`data-label="${label.id}"`);
    }
  });

  it("sizes each label from its millimetre dimensions", () => {
    expect(render(<QrLabel data={cardData()} kind="strip" idPrefix="t" />)).toContain("--w:90");
    expect(render(<QrLabel data={cardData()} kind="strip" idPrefix="t" />)).toContain("--h:40");
    expect(render(<QrLabel data={cardData()} kind="square25" idPrefix="t" />)).toContain("--w:25");
  });

  it("prints the right text on the right size", () => {
    const data = cardData({ title: "ISO 27001 Certificate", referenceNo: "ACV/CERT/2026/0042" });
    const small = render(<QrLabel data={data} kind="square25" idPrefix="t" />);
    expect(small).not.toContain("Scan to verify");
    expect(small).not.toContain("ACV/CERT");

    const medium = render(<QrLabel data={data} kind="square35" idPrefix="t" />);
    expect(medium).toContain("Scan to verify");

    const large = render(<QrLabel data={data} kind="square50" idPrefix="t" />);
    expect(large).toContain("Verified by ACEVA");
    expect(large).toContain("ACV/CERT/2026/0042");

    const strip = render(<QrLabel data={data} kind="strip" idPrefix="t" />);
    expect(strip).toContain("Verified by ACEVA");
    expect(strip).toContain("ISO 27001 Certificate");
    expect(strip).toContain("ACV/CERT/2026/0042");
    expect(strip).toContain(`acevatech.com/verify/${CODE}`);
  });

  it("gives each logo copy its own gradient id", () => {
    const first = render(<QrLabel data={cardData()} kind="strip" idPrefix="aa" />);
    const second = render(<QrLabel data={cardData()} kind="strip" idPrefix="bb" />);
    expect(first).toContain('id="aa-mark"');
    expect(second).toContain('id="bb-mark"');
    expect(first).toContain("url(#aa-mark)");
  });

  it("keeps the QR whole: one image, not cropped by object-fit", () => {
    // The sizing classes come from the CSS module; this guards the markup, not the stylesheet.
    for (const label of LABEL_LIST) {
      const html = render(<QrLabel data={cardData()} kind={label.id} idPrefix="t" />);
      expect(html).not.toContain("object-fit");
      expect(html.match(/<img/g)?.length).toBe(1);
    }
  });

  it("prints no personal details: only what the label design names", () => {
    const html = render(<QrLabel data={cardData({ holderName: "Hidden Holder" })} kind="strip" idPrefix="t" />);
    expect(html).not.toContain("Hidden Holder");
  });

  it("escapes the title and shows a placeholder without a QR", () => {
    const html = render(<QrLabel data={cardData({ title: "<b>x</b>", qrSrc: null })} kind="strip" idPrefix="t" />);
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<img");
    expect(html).toContain("QR appears once verification is on");
  });
});

describe("SheetDiagram", () => {
  it("draws the paper, each label and the marks of the page", () => {
    const plan = planLabelSheet({ label: "square50", paper: "a4", copies: "fill" });
    const html = render(<SheetDiagram paper={plan.paper} pages={plan.pages} />);
    expect(html.match(/<svg/g)?.length).toBe(1);
    // 1 paper rect + one rect per label
    expect(html.match(/<rect/g)?.length).toBe(1 + plan.count);
    expect(html).toContain('viewBox="0 0 210 297"');
    expect(html).toContain(marksPath(plan.pages[0].marks));
  });

  it("draws a single label in its slot when only one is asked for", () => {
    const plan = planLabelSheet({ label: "strip", paper: "a4", copies: "one" });
    const html = render(<SheetDiagram paper={plan.paper} pages={plan.pages} />);
    expect(html.match(/<rect/g)?.length).toBe(2);
    expect(html).toContain("One label");
  });

  it("describes each sheet for screen readers", () => {
    const plan = planLabelSheet({ label: "strip", paper: "letter", copies: "fill" });
    const html = render(<SheetDiagram paper={plan.paper} pages={plan.pages} />);
    expect(html).toContain("Sheet 1 of 1, Letter");
    expect(html).toContain('viewBox="0 0 215.9 279.4"');
  });
});

describe("PrintSheets", () => {
  it("renders nothing during server render, because the portal needs the document", () => {
    const plan = planLabelSheet({ label: "strip", paper: "a4", copies: "fill" });
    const html = render(<PrintSheets paper={PAPERS.a4} pages={plan.pages} renderCell={() => <i />} />);
    expect(html).toBe("");
  });
});

describe("readiness UI", () => {
  const item = (id: string, ok: boolean, severity: "blocker" | "warning" | "info", label = id) => ({ id, label, ok, severity, detail: `${label} detail` });

  function readinessOf(items: ReturnType<typeof item>[]): Readiness {
    const blockers = items.filter((entry) => !entry.ok && entry.severity === "blocker");
    const warnings = items.filter((entry) => !entry.ok && entry.severity === "warning");
    return { items, blockers, warnings, ready: blockers.length === 0, complete: blockers.length === 0 && warnings.length === 0 };
  }

  it("shows a banner naming each blocker, linking to the editor", () => {
    const readiness = readinessOf([item("code", false, "blocker", "Verification code"), item("title", false, "blocker", "Title"), item("x", true, "warning")]);
    const html = render(<ReadinessBanner readiness={readiness} editorHref={`/admin/documents/${ID}`} />);
    expect(html).toContain("Not ready to print");
    expect(html).toContain("2 things need fixing");
    expect(html).toContain("Verification code.");
    expect(html).toContain("Title detail");
    expect(html).toContain(`href="/admin/documents/${ID}"`);
  });

  it("uses singular wording for one blocker", () => {
    const html = render(<ReadinessBanner readiness={readinessOf([item("code", false, "blocker")])} editorHref="/admin/documents/x" />);
    expect(html).toContain("1 thing needs fixing");
  });

  it("shows a calmer banner for warnings only", () => {
    const html = render(<ReadinessBanner readiness={readinessOf([item("published", false, "warning", "Published")])} editorHref="/admin/documents/x" />);
    expect(html).toContain("Ready to print, with notes");
    expect(html).not.toContain("Not ready");
  });

  it("shows nothing when everything is in order", () => {
    expect(render(<ReadinessBanner readiness={readinessOf([item("code", true, "blocker")])} editorHref="/admin/documents/x" />)).toBe("");
  });

  it("lists every checklist item with a state a screen reader can hear", () => {
    const readiness = readinessOf([item("a", true, "blocker", "Alpha"), item("b", false, "blocker", "Bravo"), item("c", false, "info", "Charlie")]);
    const html = render(<ReadinessChecklist readiness={readiness} />);
    expect(html).toContain("Done: ");
    expect(html).toContain("Needs attention: ");
    expect(html).toContain("Optional: ");
    expect(html).toContain("Alpha");
    expect(html).toContain("Bravo");
    expect(html).toContain("Charlie");
  });
});

describe("QrPanel", () => {
  it("offers downloads and a copy button when there is a code", () => {
    const html = render(<QrPanel data={cardData()} />);
    expect(html).toContain(`href="/api/admin/documents/${ID}/qr?format=svg&amp;download=1"`);
    expect(html).toContain(`href="/api/admin/documents/${ID}/qr?format=png&amp;size=1024&amp;download=1"`);
    expect(html).toContain("Download SVG");
    expect(html).toContain("Download PNG");
    expect(html).toContain("Copy link");
    expect(html).toContain(`acevatech.com/verify/${CODE}`);
  });

  it("does not link to the public verify page, which would count as a scan", () => {
    const html = render(<QrPanel data={cardData()} />);
    expect(html).not.toContain('href="https://acevatech.com/verify');
    expect(html).not.toContain('href="/verify');
  });

  it("offers nothing to download without a code", () => {
    const html = render(<QrPanel data={cardData({ qrSrc: null, verifyUrl: null, verifyShort: "", code: null })} />);
    expect(html).not.toContain("Download");
    expect(html).not.toContain("<img");
    expect(html).toContain("no QR yet");
  });
});
