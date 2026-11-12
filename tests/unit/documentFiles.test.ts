import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  contentDisposition,
  inspectUpload,
  pdfHasActiveContent,
  sanitizeFilename,
  type InspectResult,
} from "@/lib/documents/files";
import { MAX_PHOTO_BYTES, MAX_PRIMARY_BYTES } from "@/lib/documents/types";

const char = (code: number) => String.fromCharCode(code);

const png = (extra = 32) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(extra, 1)]);
const jpeg = (extra = 32) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(extra, 2)]);
const webp = (extra = 20) =>
  Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x20, 0, 0, 0]), Buffer.from("WEBP"), Buffer.alloc(extra, 3)]);
const pdf = (body = "") => Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${body}\ntrailer\n%%EOF\n`, "latin1");

function expectOk(result: InspectResult) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

function expectRejected(result: InspectResult, code: string) {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a rejection");
  expect(result.code).toBe(code);
  expect(result.error.length).toBeGreaterThan(10);
  return result.error;
}

describe("inspectUpload: accepting real files", () => {
  const cases: Array<[string, Buffer, string, string, string]> = [
    ["a PDF", pdf(), "report.pdf", "application/pdf", "application/pdf"],
    ["a PNG", png(), "logo.png", "image/png", "image/png"],
    ["a JPEG named .jpg", jpeg(), "photo.jpg", "image/jpeg", "image/jpeg"],
    ["a JPEG named .jpeg", jpeg(), "photo.jpeg", "image/jpeg", "image/jpeg"],
    ["a JPEG named .JPG", jpeg(), "PHOTO.JPG", "image/jpeg", "image/jpeg"],
    ["a WEBP", webp(), "banner.webp", "image/webp", "image/webp"],
  ];

  it.each(cases)("accepts %s", (_label, bytes, name, declared, expectedMime) => {
    const file = expectOk(inspectUpload({ name, declaredType: declared, bytes }, "primary"));
    expect(file.mimeType).toBe(expectedMime);
    expect(file.sizeBytes).toBe(bytes.length);
    expect(file.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(file.bytes.equals(bytes)).toBe(true);
    expect(file.filename.length).toBeGreaterThan(3);
  });

  it("takes the type from the bytes, not from the client", () => {
    const file = expectOk(inspectUpload({ name: "scan.pdf", declaredType: "application/pdf", bytes: pdf() }, "primary"));
    expect(file.mimeType).toBe("application/pdf");
  });

  it("accepts PDFs whose header is preceded by a little junk (within 1 KiB)", () => {
    const bytes = Buffer.concat([Buffer.alloc(200, 0x20), pdf()]);
    expectOk(inspectUpload({ name: "x.pdf", bytes }, "primary"));
  });

  it("accepts a missing or generic declared type", () => {
    for (const declared of [undefined, "", "application/octet-stream", "binary/octet-stream"]) {
      expectOk(inspectUpload({ name: "x.png", declaredType: declared, bytes: png() }, "primary"));
    }
  });

  it("accepts spelling variants of the same type and ignores parameters", () => {
    expectOk(inspectUpload({ name: "x.jpg", declaredType: "image/jpg", bytes: jpeg() }, "primary"));
    expectOk(inspectUpload({ name: "x.jpg", declaredType: "image/pjpeg", bytes: jpeg() }, "primary"));
    expectOk(inspectUpload({ name: "x.pdf", declaredType: "Application/PDF; charset=binary", bytes: pdf() }, "primary"));
  });

  it("adds the right extension when the name has none", () => {
    expect(expectOk(inspectUpload({ name: "scan", bytes: pdf() }, "primary")).filename).toBe("scan.pdf");
    expect(expectOk(inspectUpload({ name: "scan", bytes: jpeg() }, "primary")).filename).toBe("scan.jpg");
    expect(expectOk(inspectUpload({ name: "scan", bytes: webp() }, "primary")).filename).toBe("scan.webp");
    expect(expectOk(inspectUpload({ name: "", bytes: png() }, "primary")).filename).toBe("document.png");
  });

  it("returns a private copy of the bytes", () => {
    const input = png();
    const file = expectOk(inspectUpload({ name: "a.png", bytes: input }, "primary"));
    input[10] = 0xee;
    expect(file.bytes[10]).toBe(1);
    expect(file.sha256).toBe(createHash("sha256").update(file.bytes).digest("hex"));
  });

  it("accepts a Uint8Array view with a byte offset", () => {
    const backing = Buffer.concat([Buffer.from("junkjunk"), png()]);
    const view = new Uint8Array(backing.buffer, backing.byteOffset + 8, backing.length - 8);
    const file = expectOk(inspectUpload({ name: "a.png", bytes: view }, "primary"));
    expect(file.mimeType).toBe("image/png");
    expect(file.sizeBytes).toBe(backing.length - 8);
  });
});

describe("inspectUpload: photo role", () => {
  it("accepts images", () => {
    for (const [name, bytes] of [["a.png", png()], ["a.jpg", jpeg()], ["a.webp", webp()]] as const) {
      expectOk(inspectUpload({ name, bytes }, "photo"));
    }
  });

  it("refuses a PDF as a photo", () => {
    const error = expectRejected(inspectUpload({ name: "a.pdf", bytes: pdf() }, "photo"), "unsupported");
    expect(error).toMatch(/PNG, JPEG or WEBP/);
  });
});

describe("inspectUpload: size and emptiness", () => {
  it("rejects an empty file", () => {
    expectRejected(inspectUpload({ name: "a.pdf", bytes: new Uint8Array(0) }, "primary"), "empty");
  });

  it("enforces the default primary limit", () => {
    const ok = Buffer.concat([pdf(), Buffer.alloc(MAX_PRIMARY_BYTES - pdf().length, 0x20)]);
    expect(ok.length).toBe(MAX_PRIMARY_BYTES);
    expectOk(inspectUpload({ name: "a.pdf", bytes: ok }, "primary"));
    expectRejected(inspectUpload({ name: "a.pdf", bytes: Buffer.concat([ok, Buffer.from(" ")]) }, "primary"), "too_large");
  });

  it("enforces the default photo limit, which is smaller", () => {
    const ok = Buffer.concat([png(), Buffer.alloc(MAX_PHOTO_BYTES - png().length)]);
    expect(ok.length).toBe(MAX_PHOTO_BYTES);
    expectOk(inspectUpload({ name: "a.png", bytes: ok }, "photo"));
    expectRejected(inspectUpload({ name: "a.png", bytes: Buffer.concat([ok, Buffer.from([0])]) }, "photo"), "too_large");
    // the same bytes are fine as a primary file
    expectOk(inspectUpload({ name: "a.png", bytes: Buffer.concat([ok, Buffer.from([0])]) }, "primary"));
  });

  it("honours an overridden limit", () => {
    expectRejected(inspectUpload({ name: "a.png", bytes: png(100) }, "primary", { maxBytes: 50 }), "too_large");
    expectOk(inspectUpload({ name: "a.png", bytes: png(100) }, "primary", { maxBytes: 5000 }));
  });

  it("states the limit in megabytes", () => {
    const error = expectRejected(inspectUpload({ name: "a.png", bytes: png(2_000_000) }, "photo"), "too_large");
    expect(error).toMatch(/MB/);
  });
});

describe("inspectUpload: unsupported content", () => {
  const cases: Array<[string, Buffer]> = [
    ["plain text", Buffer.from("hello, this is not a document")],
    ["HTML", Buffer.from("<!doctype html><html><script>alert(1)</script></html>")],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>')],
    ["a Windows executable", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)])],
    ["a GIF", Buffer.from("GIF89a" + "x".repeat(40))],
    ["a ZIP / Office file", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64)])],
    ["a RIFF file that is not WEBP", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE"), Buffer.alloc(20)])],
    ["a truncated PNG signature", Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ["a PDF header past the first KiB", Buffer.concat([Buffer.alloc(1100, 0x20), pdf()])],
  ];
  it.each(cases)("rejects %s", (_label, bytes) => {
    expectRejected(inspectUpload({ name: "upload.pdf", bytes }, "primary"), "unsupported");
  });

  it("rejects HTML even when it claims to be an image", () => {
    expectRejected(
      inspectUpload({ name: "photo.png", declaredType: "image/png", bytes: Buffer.from("<html><body>hi</body></html>") }, "primary"),
      "unsupported",
    );
  });
});

describe("inspectUpload: name and declared type must agree with the bytes", () => {
  it("rejects a spoofed extension", () => {
    expectRejected(inspectUpload({ name: "invoice.pdf", bytes: png() }, "primary"), "mismatch");
    expectRejected(inspectUpload({ name: "photo.png", bytes: pdf() }, "primary"), "mismatch");
    expectRejected(inspectUpload({ name: "photo.png", bytes: jpeg() }, "primary"), "mismatch");
    expectRejected(inspectUpload({ name: "photo.jpg", bytes: webp() }, "primary"), "mismatch");
  });

  it("rejects an unrelated or executable extension", () => {
    for (const name of ["report.exe", "report.html", "report.svg", "report.docx", "report.pdf.exe", "report.php", "report.js"]) {
      expectRejected(inspectUpload({ name, bytes: pdf() }, "primary"), "mismatch");
    }
  });

  it("rejects a declared type that contradicts the bytes", () => {
    expectRejected(inspectUpload({ name: "x.png", declaredType: "application/pdf", bytes: png() }, "primary"), "mismatch");
    expectRejected(inspectUpload({ name: "x.pdf", declaredType: "text/html", bytes: pdf() }, "primary"), "mismatch");
    expectRejected(inspectUpload({ name: "x.pdf", declaredType: "image/svg+xml", bytes: pdf() }, "primary"), "mismatch");
  });

  it("rejects polyglots that match more than one format", () => {
    const pngWithPdf = Buffer.concat([png(0), Buffer.from("\n%PDF-1.4\n"), Buffer.alloc(40)]);
    expectRejected(inspectUpload({ name: "x.png", bytes: pngWithPdf }, "primary"), "mismatch");
    const jpegWithPdf = Buffer.concat([jpeg(0), Buffer.from("%PDF-1.4"), Buffer.alloc(40)]);
    expectRejected(inspectUpload({ name: "x.jpg", bytes: jpegWithPdf }, "primary"), "mismatch");
    const webpWithPdf = Buffer.concat([webp(0), Buffer.from("%PDF-1.4"), Buffer.alloc(40)]);
    expectRejected(inspectUpload({ name: "x.webp", bytes: webpWithPdf }, "primary"), "mismatch");
  });

  it("is not fooled by path tricks in the name", () => {
    const file = expectOk(inspectUpload({ name: "..\\..\\etc/passwd/../report.pdf", bytes: pdf() }, "primary"));
    expect(file.filename).toBe("report.pdf");
  });

  it("is not fooled by a right-to-left override in the name", () => {
    // "invoice" + RLO + "fdp.exe" would display as "invoiceexe.pdf"; the override is stripped and the real extension is judged.
    expectRejected(inspectUpload({ name: `invoice${char(0x202e)}fdp.exe`, bytes: pdf() }, "primary"), "mismatch");
  });
});

describe("inspectUpload: active PDF content", () => {
  const dangerous: Array<[string, string]> = [
    ["JavaScript action", "5 0 obj\n<< /S /JavaScript /JS (app.alert(1)) >>\nendobj"],
    ["bare /JS entry", "<< /JS (this.print()) >>"],
    ["JS stream reference", "<< /S /Action /JS 12 0 R >>"],
    ["launch action", "<< /S /Launch /F (cmd.exe) >>"],
    ["embedded file", "<< /Type /EmbeddedFile /Length 10 >>"],
    ["names tree JavaScript", "<< /Names << /JavaScript 9 0 R >> >>"],
    ["open action combined with additional actions", "<< /OpenAction 7 0 R /AA << /O 8 0 R >> >>"],
    ["open action and AA in separate objects", "<< /OpenAction 7 0 R >>\n<< /AA << /C 3 0 R >> >>"],
    ["obfuscated name /Java#53cript", "<< /S /Java#53cript >>"],
    ["obfuscated name /J#53", "<< /J#53 (x) >>"],
    ["obfuscated launch", "<< /S /La#75nch >>"],
  ];
  it.each(dangerous)("rejects a PDF with a %s", (_label, body) => {
    const error = expectRejected(inspectUpload({ name: "x.pdf", bytes: pdf(body) }, "primary"), "active_content");
    expect(error).toMatch(/flattened/i);
  });

  const harmless: Array<[string, string]> = [
    ["an open action alone", "<< /OpenAction [3 0 R /Fit] >>"],
    ["additional-actions alone", "<< /AA << >> >>"],
    ["a name that merely starts with JS", "<< /JSON (x) >>"],
    ["a name that merely starts with AA", "<< /OpenAction [1 0 R /Fit] /AAPL 1 >>"],
    ["a name that starts with Launch", "<< /Launcher 1 >>"],
    ["a URI link", "<< /S /URI /URI (https://acevatech.com) >>"],
    ["JavaScript only as prose", "BT (We write JavaScript for a living) Tj ET"],
  ];
  it.each(harmless)("accepts a PDF with %s", (_label, body) => {
    expectOk(inspectUpload({ name: "x.pdf", bytes: pdf(body) }, "primary"));
  });

  it("does not mistake incompressible image data for a script", () => {
    // "/JS" is three bytes, so random data contains it by chance; only a following entry makes it an action
    expectOk(inspectUpload({ name: "x.pdf", bytes: pdf("xx/JS   not-an-entry xx /JS> /JS/ /JSX") }, "primary"));
    for (const seed of [1, 2, 3, 4]) {
      const noise = Buffer.alloc(3_000_000);
      let state = seed;
      for (let i = 0; i < noise.length; i += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        noise[i] = state >>> 24;
      }
      expectOk(inspectUpload({ name: "x.pdf", bytes: Buffer.concat([pdf(), noise]) }, "primary"));
    }
  });

  it("only applies the PDF scan to PDFs", () => {
    const image = Buffer.concat([png(0), Buffer.from("/JavaScript /Launch"), Buffer.alloc(8)]);
    expectOk(inspectUpload({ name: "x.png", bytes: image }, "primary"));
  });

  it("pdfHasActiveContent scans the whole buffer, not just the head", () => {
    const tail = Buffer.concat([pdf(), Buffer.alloc(3000, 0x20), Buffer.from("<< /S /JavaScript >>")]);
    expect(pdfHasActiveContent(tail)).toBe(true);
    expect(pdfHasActiveContent(pdf())).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  const table: Array<[string, string, string]> = [
    ["report.pdf", "", "report.pdf"],
    ["Annual Report 2026.PDF", "", "Annual Report 2026.pdf"],
    ["C:\\Users\\admin\\Desktop\\scan.pdf", "", "scan.pdf"],
    ["/var/tmp/scan.pdf", "", "scan.pdf"],
    ["../../secret.pdf", "", "secret.pdf"],
    ['my "quoted" file.pdf', "", "my quoted file.pdf"],
    ["it's a file.pdf", "", "its a file.pdf"],
    ["a<b>c:d*e?f|g.pdf", "", "abcdefg.pdf"],
    ["  lots   of   spaces  .pdf", "", "lots of spaces.pdf"],
    [".hidden.pdf", "", "hidden.pdf"],
    ["...pdf", "pdf", "pdf.pdf"],
    ["trailing dots...", "pdf", "trailing dots.pdf"],
    ["", "pdf", "document.pdf"],
    ["   ", "pdf", "document.pdf"],
    ['""', ".png", "document.png"],
    ["noextension", "pdf", "noextension.pdf"],
    ["noextension", "", "noextension"],
    ["résumé final.pdf", "", "résumé final.pdf"],
    ["证书.pdf", "", "证书.pdf"],
  ];
  it.each(table)("%j (fallback %j) becomes %j", (input, fallback, expected) => {
    expect(sanitizeFilename(input, fallback)).toBe(expected);
  });

  it("strips control, zero-width and bidi characters", () => {
    const dirty = `a${char(0)}b${char(7)}c${char(0x200b)}d${char(0x202e)}e${char(0xfeff)}f${char(10)}g.pdf`;
    expect(sanitizeFilename(dirty)).toBe("abcdefg.pdf");
  });

  it("caps the name at 120 characters and keeps the extension", () => {
    const name = sanitizeFilename(`${"x".repeat(500)}.pdf`);
    expect(name).toHaveLength(120);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("does not split a surrogate pair when truncating", () => {
    const name = sanitizeFilename(`${"😀".repeat(200)}.pdf`);
    expect(Array.from(name).length).toBeLessThanOrEqual(120);
    expect(name).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("ignores an implausible extension", () => {
    expect(sanitizeFilename("archive.thisisnotanextension", "pdf")).toBe("archive.thisisnotanextension.pdf");
  });
});

describe("contentDisposition", () => {
  it("builds an RFC 6266 value with an ASCII fallback and an extended name", () => {
    expect(contentDisposition("report.pdf", "inline")).toBe(`inline; filename="report.pdf"; filename*=UTF-8''report.pdf`);
    expect(contentDisposition("report.pdf", "attachment")).toBe(`attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`);
  });

  it("transliterates accents for the fallback and percent-encodes the real name", () => {
    const value = contentDisposition("résumé final.pdf", "attachment");
    expect(value).toContain('filename="resume final.pdf"');
    expect(value).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9%20final.pdf");
  });

  it("replaces characters that have no ASCII form", () => {
    const value = contentDisposition("证书.pdf", "inline");
    expect(value).toContain('filename="__.pdf"');
    expect(value).toContain("filename*=UTF-8''%E8%AF%81%E4%B9%A6.pdf");
  });

  it("encodes the characters RFC 5987 reserves", () => {
    const value = contentDisposition("a(b)'c*d.pdf", "inline");
    expect(value).toContain("filename*=UTF-8''a%28b%29%27c%2Ad.pdf");
  });

  it("can never break out of the header", () => {
    const hostile = 'x"; filename="evil.exe\r\nSet-Cookie: a=b\r\n\r\n<script>.pdf';
    const value = contentDisposition(hostile, "inline");
    expect(value).not.toMatch(/[\r\n]/);
    expect(value.match(/"/g)).toHaveLength(2);
    expect(value.startsWith("inline; filename=")).toBe(true);
  });

  it("falls back to a generic name", () => {
    expect(contentDisposition("", "attachment")).toBe(`attachment; filename="download"; filename*=UTF-8''download`);
    expect(contentDisposition('""', "attachment")).toContain('filename="download"');
  });
});
