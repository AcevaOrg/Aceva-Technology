import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import {
  FILE_RESPONSE_CSP,
  PUBLIC_FILE_MAX_AGE_SECONDS,
  canAccessFile,
  clientIpFromHeaders,
  fileCacheControl,
  fileSecurityHeaders,
  matchesVerificationCode,
  parseFileRole,
  servableContentType,
  wantsDownload,
  type FileAccessRequest,
} from "@/lib/documents/access";
import type { DocumentCategory, DocumentFileMeta, DocumentRecord, FileRole } from "@/lib/documents/types";

const CODE = "ACV-7K3M-9QXD-4TRH";
const OTHER_CODE = "ACV-7K3M-9QXD-4TRJ";
const NOW = new Date("2026-11-04T12:00:00Z");

function file(role: FileRole): DocumentFileMeta {
  return {
    id: `file-${role}`,
    documentId: "doc",
    role,
    filename: role === "photo" ? "portrait.jpg" : "paper.pdf",
    mimeType: role === "photo" ? "image/jpeg" : "application/pdf",
    sizeBytes: 100,
    sha256: "a".repeat(64),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

/** A publishable record with both files by default; each test changes only what it is about. */
function record(category: DocumentCategory, overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    category,
    title: "Title",
    summary: "",
    status: "published",
    visibility: "public",
    allowDownload: true,
    allowView: false,
    featured: false,
    sortOrder: 0,
    holderName: "Holder",
    referenceNo: "REF-1",
    issuedOn: "2026-01-01",
    expiresOn: null,
    verificationCode: CODE,
    revokedAt: null,
    revokedReason: "",
    data: {},
    files: [file("primary"), file("photo")],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verifyCount: 0,
    lastVerifiedAt: null,
    ...overrides,
  };
}

function decide(overrides: Partial<FileAccessRequest> & Pick<FileAccessRequest, "record">) {
  return canAccessFile({ role: "primary", now: NOW, ...overrides });
}

function allowed(decision: ReturnType<typeof canAccessFile>): boolean {
  return decision.allowed;
}

function reason(decision: ReturnType<typeof canAccessFile>): string | undefined {
  return decision.allowed ? undefined : decision.reason;
}

describe("canAccessFile: the primary file", () => {
  it("serves a published, public, downloadable file with no code at all", () => {
    expect(decide({ record: record("certification") })).toEqual({ allowed: true, via: "public" });
  });

  it("refuses when the admin has allowed the public neither to view nor to download", () => {
    const decision = decide({ record: record("certification", { allowDownload: false, allowView: false }), code: CODE });
    expect(reason(decision)).toBe("not_shared");
  });

  describe("view-only", () => {
    const viewOnly = () => record("certification", { allowDownload: false, allowView: true });

    it("shows the file to a visitor, with or without the code", () => {
      expect(decide({ record: viewOnly() })).toEqual({ allowed: true, via: "public" });
      expect(decide({ record: viewOnly(), code: CODE })).toEqual({ allowed: true, via: "code" });
    });

    it("refuses the same file as a download, naming a reason of its own", () => {
      expect(reason(decide({ record: viewOnly(), download: true }))).toBe("download_off");
      expect(reason(decide({ record: viewOnly(), download: true, code: CODE }))).toBe("download_off");
    });

    it("an admin may still download it", () => {
      expect(decide({ record: viewOnly(), download: true, isAdmin: true })).toEqual({ allowed: true, via: "admin" });
    });

    it("a download-allowed file is open to view and to download", () => {
      const open = record("certification", { allowDownload: true, allowView: false });
      expect(decide({ record: open })).toEqual({ allowed: true, via: "public" });
      expect(decide({ record: open, download: true })).toEqual({ allowed: true, via: "public" });
    });

    it("never lets a view-only setting open a draft, an archived or a private record", () => {
      for (const overrides of [{ status: "draft" }, { status: "archived" }, { visibility: "private" }] as const) {
        expect(reason(decide({ record: record("certification", { allowDownload: false, allowView: true, ...overrides }) }))).toBe("hidden");
      }
    });
  });

  it.each(["draft", "archived"] as const)("never serves a %s record, even with its code", (status) => {
    expect(reason(decide({ record: record("certification", { status }), code: CODE }))).toBe("hidden");
    expect(reason(decide({ record: record("certification", { status }) }))).toBe("hidden");
  });

  it("never serves a private record, even with its code", () => {
    expect(reason(decide({ record: record("certification", { visibility: "private" }), code: CODE }))).toBe("hidden");
  });

  describe("unlisted records need their own code", () => {
    const unlisted = record("experience_letter", { visibility: "unlisted" });

    it("refuses without a code", () => {
      expect(reason(decide({ record: unlisted }))).toBe("hidden");
      expect(reason(decide({ record: unlisted, code: null }))).toBe("hidden");
      expect(reason(decide({ record: unlisted, code: "" }))).toBe("hidden");
    });

    it("refuses a wrong code, including one that differs in the last character", () => {
      expect(reason(decide({ record: unlisted, code: OTHER_CODE }))).toBe("hidden");
      expect(reason(decide({ record: unlisted, code: "ACV-0000-0000-0000" }))).toBe("hidden");
    });

    it("refuses a malformed code", () => {
      for (const code of ["nonsense", "ACV", "ACV-7K3M-9QXD", `${CODE}${CODE}`, "x".repeat(500), "ACV-UUUU-UUUU-UUUU"]) {
        expect(allowed(decide({ record: unlisted, code })), code).toBe(false);
      }
    });

    it("accepts the right code in any spelling", () => {
      for (const code of [CODE, CODE.toLowerCase(), CODE.replaceAll("-", ""), ` ${CODE.replaceAll("-", " ")} `]) {
        expect(decide({ record: unlisted, code }), code).toEqual({ allowed: true, via: "code" });
      }
    });

    it("still refuses the right code when the record is a draft, private or revoked", () => {
      expect(allowed(decide({ record: { ...unlisted, status: "draft" }, code: CODE }))).toBe(false);
      expect(allowed(decide({ record: { ...unlisted, visibility: "private" }, code: CODE }))).toBe(false);
      expect(reason(decide({ record: { ...unlisted, revokedAt: "2026-05-01T00:00:00.000Z" }, code: CODE }))).toBe("revoked");
    });

    it("refuses when the record holds no code to match", () => {
      expect(allowed(decide({ record: { ...unlisted, verificationCode: null }, code: CODE }))).toBe(false);
    });
  });

  describe("revoked records", () => {
    it("never yield a file, with or without the code", () => {
      const revoked = record("certification", { revokedAt: "2026-05-01T00:00:00.000Z" });
      expect(reason(decide({ record: revoked, code: CODE }))).toBe("revoked");
      expect(reason(decide({ record: revoked }))).toBe("hidden");
    });
  });

  describe("expired records", () => {
    it("are still served: the page shows them as expired, and the file is the same paper", () => {
      const expired = record("certification", { expiresOn: "2026-06-30" });
      expect(allowed(decide({ record: expired }))).toBe(true);
    });
  });

  it("refuses when the record has no file in that role", () => {
    expect(reason(decide({ record: record("certification", { files: [file("photo")] }) }))).toBe("no_file");
  });

  it("refuses an unknown role without throwing", () => {
    expect(reason(decide({ record: record("certification"), role: "thumbnail" as FileRole }))).toBe("no_file");
  });

  it("a wrong code on a public record is treated like no code, not as an error", () => {
    expect(allowed(decide({ record: record("certification"), code: OTHER_CODE }))).toBe(true);
  });
});

describe("canAccessFile: personal records and consent", () => {
  it("a public people record without recorded consent is not served by URL alone", () => {
    const person = record("program_record", { data: {} });
    expect(reason(decide({ record: person }))).toBe("hidden");
  });

  it("the person's own code still opens it, because the verify page shows them by name", () => {
    const person = record("program_record", { data: {} });
    expect(allowed(decide({ record: person, code: CODE }))).toBe(true);
  });

  it("consent opens a public people record to everyone", () => {
    const person = record("program_record", { data: { consent_to_publish: true } });
    expect(allowed(decide({ record: person }))).toBe(true);
  });

  it("consent must be exactly true, not merely present", () => {
    for (const consent of ["true", 1, "yes", null, false]) {
      const person = record("program_record", { data: { consent_to_publish: consent as never } });
      expect(allowed(decide({ record: person })), String(consent)).toBe(false);
    }
  });
});

describe("canAccessFile: the photo", () => {
  const photo = (overrides: Partial<DocumentRecord>, code?: string) =>
    decide({ record: record("program_record", overrides), role: "photo", code });

  it("needs the record's own opt-in (show_photo === true)", () => {
    expect(reason(photo({ data: { consent_to_publish: true } }))).toBe("photo_hidden");
    expect(reason(photo({ data: { consent_to_publish: true, show_photo: false } }))).toBe("photo_hidden");
    expect(reason(photo({ data: { consent_to_publish: true, show_photo: "true" as never } }))).toBe("photo_hidden");
  });

  it("is served for a consenting, opted-in public record", () => {
    expect(photo({ data: { consent_to_publish: true, show_photo: true } })).toEqual({ allowed: true, via: "public" });
  });

  it("is NOT served by URL alone when consent is missing, even with show_photo", () => {
    expect(reason(photo({ data: { show_photo: true } }))).toBe("hidden");
  });

  it("is served for an unlisted record only with its code", () => {
    const data = { show_photo: true };
    expect(reason(photo({ visibility: "unlisted", data }))).toBe("hidden");
    expect(reason(photo({ visibility: "unlisted", data }, OTHER_CODE))).toBe("hidden");
    expect(photo({ visibility: "unlisted", data }, CODE)).toEqual({ allowed: true, via: "code" });
  });

  it("does not depend on allowDownload (that governs the document, not the portrait)", () => {
    expect(allowed(photo({ allowDownload: false, data: { consent_to_publish: true, show_photo: true } }))).toBe(true);
  });

  it("is never served for a category without photos, even if a row has one", () => {
    const stray = record("certification", { data: { show_photo: true } });
    expect(reason(decide({ record: stray, role: "photo" }))).toBe("photo_hidden");
  });

  it("is never served for a draft, private or revoked record", () => {
    const data = { consent_to_publish: true, show_photo: true };
    expect(allowed(photo({ status: "draft", data }, CODE))).toBe(false);
    expect(allowed(photo({ visibility: "private", data }, CODE))).toBe(false);
    expect(allowed(photo({ revokedAt: "2026-05-01T00:00:00.000Z", data }, CODE))).toBe(false);
  });

  it("an unlisted people record shows its photo only to a code holder who was opted in", () => {
    const person = record("program_record", { visibility: "unlisted", data: { show_photo: true } });
    expect(allowed(decide({ record: person, role: "photo" }))).toBe(false);
    expect(allowed(decide({ record: person, role: "photo", code: CODE }))).toBe(true);
    const hidden = record("program_record", { visibility: "unlisted", data: { show_photo: false } });
    expect(allowed(decide({ record: hidden, role: "photo", code: CODE }))).toBe(false);
  });
});

describe("canAccessFile: an admin", () => {
  it("may read any file that exists, whatever the state", () => {
    const states: Partial<DocumentRecord>[] = [
      { status: "draft" },
      { status: "archived" },
      { visibility: "private" },
      { visibility: "unlisted" },
      { allowDownload: false },
      { revokedAt: "2026-05-01T00:00:00.000Z" },
      { expiresOn: "2020-01-01" },
    ];
    for (const overrides of states) {
      const r = record("certification", overrides);
      expect(decide({ record: r, isAdmin: true }), JSON.stringify(overrides)).toEqual({ allowed: true, via: "admin" });
      expect(decide({ record: r, isAdmin: true, role: "photo" }), JSON.stringify(overrides)).toEqual({ allowed: true, via: "admin" });
    }
  });

  it("still gets nothing for a file that does not exist", () => {
    const r = record("certification", { files: [] });
    expect(reason(decide({ record: r, isAdmin: true }))).toBe("no_file");
  });

  it("is only recognised for a literal true", () => {
    const draft = record("certification", { status: "draft" });
    for (const isAdmin of [false, undefined, 1 as never, "true" as never, {} as never]) {
      expect(allowed(decide({ record: draft, isAdmin })), String(isAdmin)).toBe(false);
    }
  });
});

describe("matchesVerificationCode", () => {
  it("compares canonical forms", () => {
    expect(matchesVerificationCode(CODE, CODE)).toBe(true);
    expect(matchesVerificationCode(CODE, "acv7k3m9qxd4trh")).toBe(true);
    expect(matchesVerificationCode(CODE, OTHER_CODE)).toBe(false);
  });

  it("is false for anything that cannot be a code, and never throws", () => {
    for (const supplied of [undefined, null, 0, {}, [], "", " ", "ACV", "😀".repeat(40), "a".repeat(10_000)]) {
      expect(matchesVerificationCode(CODE, supplied), String(supplied).slice(0, 20)).toBe(false);
    }
    expect(matchesVerificationCode(null, CODE)).toBe(false);
    expect(matchesVerificationCode("", CODE)).toBe(false);
    expect(matchesVerificationCode("not canonical", CODE)).toBe(false);
  });
});

describe("request parsing", () => {
  it("parseFileRole defaults to the document and rejects anything else", () => {
    expect(parseFileRole(null)).toBe("primary");
    expect(parseFileRole("")).toBe("primary");
    expect(parseFileRole("primary")).toBe("primary");
    expect(parseFileRole("photo")).toBe("photo");
    for (const bad of ["Primary", "PHOTO", "thumb", "primary,photo", "../photo", " photo"]) {
      expect(parseFileRole(bad), bad).toBeNull();
    }
  });

  it("wantsDownload is true only for 1 or true", () => {
    expect(wantsDownload("1")).toBe(true);
    expect(wantsDownload("true")).toBe(true);
    for (const no of [null, "", "0", "false", "yes", "TRUE"]) expect(wantsDownload(no), String(no)).toBe(false);
  });

  it("clientIpFromHeaders prefers the first forwarded hop, then x-real-ip, then 'unknown'", () => {
    const headers = (entries: Record<string, string>) => new Headers(entries);
    expect(clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-real-ip": "10.9.9.9" }))).toBe("203.0.113.9");
    expect(clientIpFromHeaders(headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIpFromHeaders(headers({ "x-forwarded-for": " , 10.0.0.1", "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(clientIpFromHeaders(headers({}))).toBe("unknown");
  });
});

describe("response headers", () => {
  it("serves only the stored types inline, and forces anything else to download as opaque bytes", () => {
    for (const mime of ["application/pdf", "image/png", "image/jpeg", "image/webp"]) {
      expect(servableContentType(mime)).toEqual({ contentType: mime, forceDownload: false });
    }
    for (const mime of ["text/html", "image/svg+xml", "application/javascript", "", "application/pdf; charset=utf-8"]) {
      expect(servableContentType(mime), mime).toEqual({ contentType: "application/octet-stream", forceDownload: true });
    }
  });

  it("only shares a copy publicly when an anonymous visitor could have fetched it", () => {
    const publicRecord = record("certification");
    expect(fileCacheControl(publicRecord, true)).toBe(`public, max-age=${PUBLIC_FILE_MAX_AGE_SECONDS}`);
    expect(PUBLIC_FILE_MAX_AGE_SECONDS).toBe(300);
    // an admin previewing a file the public may not have: never cacheable
    expect(fileCacheControl(publicRecord, false)).toBe("private, no-store");
    // unlisted and private records are never shared-cacheable, whatever the decision
    expect(fileCacheControl(record("certification", { visibility: "unlisted" }), true)).toBe("private, no-store");
    expect(fileCacheControl(record("certification", { visibility: "private" }), true)).toBe("private, no-store");
  });

  it("carries the hardening headers", () => {
    const headers = fileSecurityHeaders();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(headers["X-Robots-Tag"]).toContain("noindex");
    expect(headers["Content-Security-Policy"]).toBe(FILE_RESPONSE_CSP);
  });

  it("uses a CSP that lets the browser's PDF viewer draw but nothing else run", () => {
    expect(FILE_RESPONSE_CSP).toContain("default-src 'none'");
    expect(FILE_RESPONSE_CSP).toContain("object-src 'self'");
    expect(FILE_RESPONSE_CSP).toContain("frame-ancestors 'self'");
    expect(FILE_RESPONSE_CSP).not.toMatch(/script-src/);
    expect(FILE_RESPONSE_CSP).not.toContain("'none'; object-src 'none'");
  });
});

describe("next.config.ts", () => {
  it("overrides the site-wide CSP and frame policy for document files, after the catch-all", async () => {
    const entries = (await nextConfig.headers?.()) ?? [];
    const catchAll = entries.findIndex((entry) => entry.source === "/:path*");
    const files = entries.findIndex((entry) => entry.source === "/api/documents/:path*");
    expect(catchAll).toBeGreaterThanOrEqual(0);
    // Later entries win for the same key, so the file entry must come last.
    expect(files).toBeGreaterThan(catchAll);

    const csp = entries[files].headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toBe(FILE_RESPONSE_CSP);
    expect(entries[files].headers.find((header) => header.key === "X-Frame-Options")?.value).toBe("SAMEORIGIN");

    // the site-wide policy stays strict for everything else
    const siteCsp = entries[catchAll].headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(siteCsp).toContain("object-src 'none'");
    expect(siteCsp).toContain("frame-ancestors 'none'");
  });
});
