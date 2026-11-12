import { createRequire } from "node:module";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import { generateVerificationCode } from "@/lib/documents/codes";
import { renderQrPng, renderQrSvg, verificationUrl } from "@/lib/documents/qr";
import { SITE_URL } from "@/lib/seo";

// pngjs ships no type declarations and only a decode is needed here, so describe just that.
interface DecodedPng {
  width: number;
  height: number;
  data: Buffer;
}
const nodeRequire = createRequire(import.meta.url);
const { PNG } = nodeRequire("pngjs") as { PNG: { sync: { read: (buffer: Buffer) => DecodedPng } } };

describe("verificationUrl", () => {
  const code = "ACV-7K3M-9QXD-4TRH";

  it("joins the site URL, /verify/ and the code", () => {
    expect(verificationUrl(code, "https://acevatech.com")).toBe("https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
  });

  it("never produces a double slash, however the base ends", () => {
    for (const base of ["https://acevatech.com/", "https://acevatech.com//", "https://acevatech.com"]) {
      const url = verificationUrl(code, base);
      expect(url).toBe("https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
      expect(url.replace("https://", "")).not.toContain("//");
    }
  });

  it("defaults to the configured site URL", () => {
    expect(verificationUrl(code)).toBe(`${SITE_URL.replace(/\/+$/, "")}/verify/${code}`);
  });

  it("supports a base path", () => {
    expect(verificationUrl(code, "https://example.com/app/")).toBe("https://example.com/app/verify/ACV-7K3M-9QXD-4TRH");
  });

  it("encodes the canonical form of a sloppy code", () => {
    expect(verificationUrl("acv 7k3m 9qxd 4trh", "https://acevatech.com")).toBe("https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
  });

  it("refuses something that is not a verification code", () => {
    for (const bad of ["", "nope", "ACV-1234", "../../admin", "ACV-7K3M-9QXD-4TRH/../x"]) {
      expect(() => verificationUrl(bad, "https://acevatech.com")).toThrow(RangeError);
    }
  });
});

describe("renderQrSvg", () => {
  const url = "https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH";

  it("returns a standalone, labelled SVG with a viewBox", async () => {
    const svg = await renderQrSvg(url);
    expect(svg.startsWith('<svg role="img"')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(svg).toContain("aria-label=");
    expect(svg.trim().endsWith("</svg>")).toBe(true);
  });

  it("draws dark modules on a white background by default", async () => {
    const svg = await renderQrSvg(url);
    expect(svg).toContain('stroke="#0a0b0e"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it("keeps a quiet zone of at least four modules", async () => {
    const [, w] = /viewBox="0 0 (\d+) \d+"/.exec(await renderQrSvg(url, { margin: 0 })) ?? [];
    const [, wide] = /viewBox="0 0 (\d+) \d+"/.exec(await renderQrSvg(url, { margin: 10 })) ?? [];
    const [, base] = /viewBox="0 0 (\d+) \d+"/.exec(await renderQrSvg(url, { margin: 4 })) ?? [];
    expect(w).toBe(base); // asking for 0 still gives 4
    expect(Number(wide) - Number(base)).toBe(12); // 6 extra modules on each side
  });

  it("honours a fixed size and custom colours", async () => {
    const svg = await renderQrSvg(url, { size: 240, dark: "#112233", light: "#fafafa" });
    expect(svg).toContain('width="240"');
    expect(svg).toContain('height="240"');
    expect(svg).toContain('stroke="#112233"');
    expect(svg).toContain('fill="#fafafa"');
  });

  it("ignores colours that could inject markup", async () => {
    const svg = await renderQrSvg(url, { dark: '"/><script>alert(1)</script>', light: "url(javascript:x)" });
    expect(svg).not.toContain("<script");
    expect(svg).toContain('stroke="#0a0b0e"');
    expect(svg).toContain('fill="#ffffff"');
  });

  it("omits width and height when no size is given so it scales", async () => {
    expect(await renderQrSvg(url)).not.toMatch(/ width="/);
  });

  it("rejects empty and absurdly long input", async () => {
    await expect(renderQrSvg("")).rejects.toThrow(RangeError);
    await expect(renderQrSvg("x".repeat(5000))).rejects.toThrow(RangeError);
  });
});

describe("renderQrPng", () => {
  it("is a PNG", async () => {
    const png = await renderQrPng("https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it("round-trips: a scanner decodes exactly the verification URL", async () => {
    const url = verificationUrl(generateVerificationCode(), "https://acevatech.com");
    const decoded = PNG.sync.read(await renderQrPng(url, { width: 480 }));
    const result = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
    expect(result).not.toBeNull();
    expect(result?.data).toBe(url);
  });

  it("round-trips at several sizes and for several codes", async () => {
    for (const width of [200, 320, 640]) {
      const url = verificationUrl(generateVerificationCode(), "https://acevatech.com");
      const decoded = PNG.sync.read(await renderQrPng(url, { width }));
      const result = jsQR(new Uint8ClampedArray(decoded.data), decoded.width, decoded.height);
      expect(result?.data).toBe(url);
    }
  });

  it("clamps the requested width", async () => {
    const small = PNG.sync.read(await renderQrPng("https://acevatech.com/verify/x", { width: 1 }));
    expect(small.width).toBeGreaterThanOrEqual(128);
    const large = PNG.sync.read(await renderQrPng("https://acevatech.com/verify/x", { width: 99999 }));
    expect(large.width).toBeLessThanOrEqual(2048);
  });

  it("rejects empty input", async () => {
    await expect(renderQrPng("")).rejects.toThrow(RangeError);
  });
});
