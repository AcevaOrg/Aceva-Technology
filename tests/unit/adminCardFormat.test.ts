import { describe, expect, it } from "vitest";
import { adminQrUrl, cardRoute, formatCardDate, shortUrl } from "@/components/admin/card/cardFormat";

describe("shortUrl", () => {
  it("drops the scheme and keeps host and path", () => {
    expect(shortUrl("https://acevatech.com/verify/ACV-7K3M-9QXD-4TRH")).toBe("acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
    expect(shortUrl("http://acevatech.com/verify/ACV-7K3M-9QXD-4TRH")).toBe("acevatech.com/verify/ACV-7K3M-9QXD-4TRH");
  });

  it("drops www., the query, the fragment and trailing slashes", () => {
    expect(shortUrl("https://www.acevatech.com/verify/ACV-1/?utm=x#top")).toBe("acevatech.com/verify/ACV-1");
    expect(shortUrl("https://acevatech.com/")).toBe("acevatech.com");
    expect(shortUrl("https://acevatech.com")).toBe("acevatech.com");
  });

  it("keeps the case of the code and a non-default port", () => {
    expect(shortUrl("http://localhost:3000/verify/ACV-ABCD-EFGH-JKMN")).toBe("localhost:3000/verify/ACV-ABCD-EFGH-JKMN");
  });

  it("cleans text that is not an absolute URL", () => {
    expect(shortUrl("acevatech.com/verify/ACV-1/")).toBe("acevatech.com/verify/ACV-1");
    expect(shortUrl("ftp://files.example.com/a?b=c")).toBe("files.example.com/a");
    expect(shortUrl("  https://acevatech.com/verify/X  ")).toBe("acevatech.com/verify/X");
  });

  it("returns an empty string for nothing", () => {
    expect(shortUrl("")).toBe("");
    expect(shortUrl("   ")).toBe("");
    expect(shortUrl(undefined as unknown as string)).toBe("");
  });
});

describe("formatCardDate", () => {
  it("writes a short English date", () => {
    expect(formatCardDate("2026-03-12")).toBe("12 Mar 2026");
    expect(formatCardDate("2027-01-01")).toBe("1 Jan 2027");
    expect(formatCardDate("2024-02-29")).toBe("29 Feb 2024");
    expect(formatCardDate("2026-12-31")).toBe("31 Dec 2026");
  });

  it("rejects what is not a real calendar date", () => {
    expect(formatCardDate("2025-02-29")).toBe("");
    expect(formatCardDate("2026-02-30")).toBe("");
    expect(formatCardDate("2026-13-01")).toBe("");
    expect(formatCardDate("2026-00-10")).toBe("");
    expect(formatCardDate("12/03/2026")).toBe("");
    expect(formatCardDate("2026-03-12T10:00:00Z")).toBe("");
    expect(formatCardDate("")).toBe("");
  });

  it("treats null and undefined as no date", () => {
    expect(formatCardDate(null)).toBe("");
    expect(formatCardDate(undefined)).toBe("");
  });
});

describe("admin endpoint URLs", () => {
  const id = "0b9d4f1e-6c1a-4f36-9a41-2f3c7d8e9a10";

  it("builds the QR URL, SVG by default", () => {
    expect(adminQrUrl(id)).toBe(`/api/admin/documents/${id}/qr?format=svg`);
  });

  it("adds size and download only when asked", () => {
    expect(adminQrUrl(id, { format: "png", size: 1024, download: true })).toBe(`/api/admin/documents/${id}/qr?format=png&size=1024&download=1`);
    expect(adminQrUrl(id, { format: "svg", download: true })).toBe(`/api/admin/documents/${id}/qr?format=svg&download=1`);
  });

  it("clamps the size to the endpoint's 128..1024 range and ignores a non-number", () => {
    expect(adminQrUrl(id, { size: 50 })).toContain("size=128");
    expect(adminQrUrl(id, { size: 5000 })).toContain("size=1024");
    expect(adminQrUrl(id, { size: 300.6 })).toContain("size=301");
    expect(adminQrUrl(id, { size: Number.NaN })).not.toContain("size=");
  });

  it("encodes the id, so a stray character cannot change the path", () => {
    expect(adminQrUrl("a/b?c")).toBe("/api/admin/documents/a%2Fb%3Fc/qr?format=svg");
  });

  it("names the QR label page", () => {
    expect(cardRoute(id)).toBe(`/admin/documents/${id}/card`);
  });
});
