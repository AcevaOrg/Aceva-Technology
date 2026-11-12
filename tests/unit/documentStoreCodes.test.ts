import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setSqlClientForTests } from "@/lib/db";
import { CATEGORIES } from "@/lib/documents/categories";
import { generateVerificationCode } from "@/lib/documents/codes";
import { ensureDocumentTables, resetDocumentTablesCache } from "@/lib/documents/schema";
import {
  createDocument,
  duplicateDocument,
  getDocument,
  regenerateVerificationCode,
  updateDocument,
} from "@/lib/documents/store";
import { validateDocumentInput, type DocumentInput } from "@/lib/documents/validate";
import { createPgliteSql } from "../helpers/pgliteSql";

/**
 * Verification codes are drawn at random, so a collision cannot be provoked by chance. The draw is
 * replaced here by a scripted sequence so the retry path can be proved.
 */
vi.mock("@/lib/documents/codes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/documents/codes")>();
  return { ...actual, generateVerificationCode: vi.fn(actual.generateVerificationCode) };
});

const draw = vi.mocked(generateVerificationCode);

// Starting an embedded Postgres takes seconds, and several test files start one at the same time.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let pg: Awaited<ReturnType<typeof createPgliteSql>>;

beforeAll(async () => {
  pg = await createPgliteSql();
  setSqlClientForTests(pg.sql);
  await ensureDocumentTables();
});

afterAll(async () => {
  setSqlClientForTests(null);
  resetDocumentTablesCache();
  await pg.close();
});

beforeEach(async () => {
  setSqlClientForTests(pg.sql);
  await pg.db.exec("TRUNCATE verification_events, document_files, documents RESTART IDENTITY CASCADE");
});

let referenceSequence = 0;

function certification(overrides: Record<string, unknown> = {}): DocumentInput {
  const result = validateDocumentInput(
    {
      title: "Certificate",
      holderName: "ACEVA",
      // Unique within a category, so each fixture gets its own unless the test names one.
      referenceNo: `R${(referenceSequence += 1)}`,
      issuedOn: "2026-01-01",
      data: { direction: "held", issuing_body: "BSI" },
      ...overrides,
    },
    { category: "certification" },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

async function rowCount(): Promise<number> {
  const result = await pg.db.query<{ n: number }>("SELECT count(*)::int AS n FROM documents");
  return result.rows[0].n;
}

const TAKEN = "ACV-AAAA-AAAA-AAAA";
const FREE_1 = "ACV-BBBB-BBBB-BBBB";
const FREE_2 = "ACV-CCCC-CCCC-CCCC";

describe("verification code collisions", () => {
  async function occupy(code = TAKEN) {
    draw.mockReturnValueOnce(code);
    const existing = await createDocument(certification({ title: "Holds the code" }));
    expect(existing.verificationCode).toBe(code);
    return existing;
  }

  it("create: retries with a fresh code when the first draw is taken", async () => {
    await occupy();
    draw.mockClear();
    draw.mockReturnValueOnce(TAKEN).mockReturnValueOnce(TAKEN).mockReturnValueOnce(FREE_1);
    const created = await createDocument(certification({ title: "Second" }));
    expect(created.verificationCode).toBe(FREE_1);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(await rowCount()).toBe(2);
  });

  it("create: gives up after five collisions and stores nothing", async () => {
    await occupy();
    draw.mockClear();
    draw.mockReturnValue(TAKEN);
    await expect(createDocument(certification({ title: "Never lands" }))).rejects.toThrow(/unique verification code/);
    expect(draw).toHaveBeenCalledTimes(5);
    expect(await rowCount()).toBe(1);
  });

  it("create: draws no code at all when verification is off", async () => {
    draw.mockClear();
    const created = await createDocument(certification({ enableVerification: false }));
    expect(created.verificationCode).toBeNull();
    expect(draw).not.toHaveBeenCalled();
  });

  it("update: retries when switching verification on", async () => {
    await occupy();
    const target = await createDocument(certification({ title: "Target", enableVerification: false, referenceNo: "R2" }));
    draw.mockClear();
    draw.mockReturnValueOnce(TAKEN).mockReturnValueOnce(FREE_1);
    const updated = await updateDocument(target.id, certification({ title: "Target", enableVerification: true, referenceNo: "R2" }));
    expect(updated?.verificationCode).toBe(FREE_1);
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it("update: draws nothing when the record already has a code", async () => {
    draw.mockReturnValueOnce(FREE_1);
    const target = await createDocument(certification());
    draw.mockClear();
    const updated = await updateDocument(target.id, certification({ title: "Renamed" }));
    expect(updated?.verificationCode).toBe(FREE_1);
    expect(draw).not.toHaveBeenCalled();
  });

  it("regenerate: retries, and the old code is replaced", async () => {
    await occupy();
    draw.mockReturnValueOnce(FREE_1);
    const target = await createDocument(certification({ title: "Target", referenceNo: "R2" }));
    draw.mockClear();
    draw.mockReturnValueOnce(TAKEN).mockReturnValueOnce(FREE_2);
    const regenerated = await regenerateVerificationCode(target.id);
    expect(regenerated?.verificationCode).toBe(FREE_2);
    expect((await getDocument(target.id))?.verificationCode).toBe(FREE_2);
  });

  it("regenerate: leaves the old code in place when it cannot find a free one", async () => {
    await occupy();
    draw.mockReturnValueOnce(FREE_1);
    const target = await createDocument(certification({ title: "Target", referenceNo: "R2" }));
    draw.mockReturnValue(TAKEN);
    await expect(regenerateVerificationCode(target.id)).rejects.toThrow(/unique verification code/);
    expect((await getDocument(target.id))?.verificationCode).toBe(FREE_1);
  });

  it("duplicate: retries for the copy's own code", async () => {
    await occupy();
    draw.mockReturnValueOnce(FREE_1);
    const source = await createDocument(certification({ title: "Source", referenceNo: "R2" }));
    draw.mockClear();
    draw.mockReturnValueOnce(TAKEN).mockReturnValueOnce(FREE_2);
    const copy = await duplicateDocument(source.id);
    expect(copy?.verificationCode).toBe(FREE_2);
    expect(copy?.id).not.toBe(source.id);
  });

  it("does not retry a failure that is not a code collision", async () => {
    draw.mockClear();
    const broken = { ...certification(), category: "not_a_category" as keyof typeof CATEGORIES };
    await expect(createDocument(broken)).rejects.toThrow();
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it("a code that is free is used as drawn", async () => {
    draw.mockReturnValueOnce(FREE_1);
    expect((await createDocument(certification())).verificationCode).toBe(FREE_1);
  });
});
