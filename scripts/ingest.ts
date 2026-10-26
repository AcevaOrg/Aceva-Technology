import fs from "fs";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";
import { DocumentChunkMetadata, VectorDatabaseIndex, VectorDocumentChunk } from "../components/pulse/types";
import { generateEmbedding, getExpectedEmbeddingDimension } from "../lib/pulse/embeddings";
import { getEmbeddingModel } from "../lib/pulse/env";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const INDEX_FILE_PATH = path.join(KNOWLEDGE_DIR, "vectorIndex.json");

interface RawChunk {
  id: string;
  hash: string;
  content: string;
  metadata: DocumentChunkMetadata;
}

/**
 * Headings whose sections are written for the team, not for visitors. They are
 * kept in the markdown for humans but never indexed.
 *
 * "Not yet documented" holds unconfirmed placeholders. "Review note(s)" holds
 * provenance and maintenance instructions — which source file a fact mirrors,
 * what to re-check, when to re-run ingest. Both are useful in the markdown and
 * actively harmful in the index: "How soon will someone review my
 * requirements?" ranked company.md's "Review notes" third, ahead of the chunk
 * that actually answers it, purely because "review" matched the heading.
 *
 * A heading that starts with "internal" or carries a "(internal)" marker is
 * skipped too, so a section can be withheld from the index without inventing a
 * new marker syntax inside the knowledge files.
 *
 * The four named faq.md sections are operator guidance addressed to Pulse
 * itself: "PULSE must never hallucinate", the approved fallback scripts, the
 * lead-qualification field list, and the internal note reconciling the FAQ
 * against the public website. Retrieval was handing those to the model inside
 * the "Retrieved Official ACEVA Knowledge Context" block, so a visitor
 * question could surface Pulse's own instructions as though they were an
 * answer. Instructions reach the model through RAG_SYSTEM_PROMPT on every
 * turn; the index is only for facts a visitor may be told.
 */
const SKIPPED_HEADINGS = /^(?:not yet documented|review notes?|internal([ :_-].*)?|.*[(]internal[)]|pulse response rules|approved fallbacks|lead qualification|source reconciliation)$/i;

/**
 * Removes `TODO(aceva):` lines before embedding.
 *
 * These must not reach the index. A placeholder list is dense with exactly the
 * vocabulary of the question it stands in for, so it outranks the section that
 * holds the real answer — an added "Not yet documented" block under the tech
 * stack ranked 2nd for "What technologies do you use?" and told the model to
 * refuse a question the file answers two sections earlier. Stripping them keeps
 * the markdown useful to the team and the index free of self-sabotage.
 */
function stripUnconfirmedPlaceholders(section: string): string {
  return section
    .split("\n")
    .filter((line) => !/^\s*[-*]?\s*TODO\(aceva\)/i.test(line))
    .join("\n");
}

/** True when a section still has prose or list content under its heading. */
function sectionHasBody(section: string): boolean {
  const withoutHeading = section.replace(/^#{1,3}\s+.+$/m, "").trim();
  return withoutHeading.length > 0;
}

function computeHash(content: string, metadata: DocumentChunkMetadata): string {
  const payload = `${content.trim()}::${metadata.title}::${metadata.category}::${metadata.source}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function chunkMarkdownFile(filePath: string): RawChunk[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsed = matter(fileContent);
  const data = parsed.data || {};
  const bodyText = parsed.content || "";

  const fileName = path.basename(filePath);
  const title = data.title || fileName.replace(/\.md$/, "");
  const category = data.category || "general";
  const source = data.source || fileName;
  const url = data.url || "/";
  const company = data.company || "ACEVA Technology";

  const chunks: RawChunk[] = [];
  const sections = bodyText.split(/(?=\n#{1,3}\s+)/);
  let chunkIndex = 0;

  for (const rawSection of sections) {
    const trimmed = stripUnconfirmedPlaceholders(rawSection).trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[2].trim() : undefined;

    if (heading && SKIPPED_HEADINGS.test(heading)) continue;
    if (!sectionHasBody(trimmed)) continue;

    const fullContent = `${company} — ${title}${heading ? ` [${heading}]` : ""}:\n${trimmed}`;

    const metadata: DocumentChunkMetadata = {
      source,
      title,
      category,
      url,
      company,
      heading,
    };

    chunkIndex++;
    const id = `${fileName.replace(/\.md$/, "")}-chunk-${chunkIndex}`;
    const hash = computeHash(fullContent, metadata);

    chunks.push({
      id,
      hash,
      content: fullContent,
      metadata,
    });
  }

  return chunks;
}

async function runIngestion() {
  const embeddingModel = getEmbeddingModel();
  console.log("=== ACEVA Knowledge Ingestion & Embedding Pipeline ===");
  console.log(`Embedding model: ${embeddingModel}`);

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`Knowledge directory not found at: ${KNOWLEDGE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge markdown files.`);

  // Load existing index for idempotency
  let existingIndex: VectorDatabaseIndex = {
    version: "1.0.0",
    embeddingModel,
    dimension: getExpectedEmbeddingDimension(embeddingModel) ?? 0,
    updatedAt: new Date().toISOString(),
    chunks: [],
  };

  if (fs.existsSync(INDEX_FILE_PATH)) {
    try {
      existingIndex = JSON.parse(fs.readFileSync(INDEX_FILE_PATH, "utf-8"));
      console.log(`Loaded existing vector database with ${existingIndex.chunks.length} chunks.`);
    } catch {
      console.warn("Could not parse existing index file. Re-creating index.");
    }
  }

  const existingMap = new Map<string, VectorDocumentChunk>();
  for (const c of existingIndex.chunks) {
    existingMap.set(c.id, c);
  }

  const newChunksList: VectorDocumentChunk[] = [];
  let embeddedCount = 0;
  let reusedCount = 0;

  for (const file of files) {
    const fullPath = path.join(KNOWLEDGE_DIR, file);
    const rawChunks = chunkMarkdownFile(fullPath);

    for (const raw of rawChunks) {
      const existing = existingMap.get(raw.id);

      if (
        existing &&
        existing.hash === raw.hash &&
        existing.embedding?.length &&
        existingIndex.embeddingModel === embeddingModel
      ) {
        // Reuse existing embedding (Idempotent)
        newChunksList.push(existing);
        reusedCount++;
      } else {
        // Generate new embedding
        console.log(`Embedding chunk: ${raw.id} (${raw.metadata.title} - ${raw.metadata.heading || "Main"})`);
        const embedding = await generateEmbedding(raw.content);
        if (!embedding) {
          // Writing a partial index would leave chunks that can never be matched,
          // and the previous index is still usable, so stop without touching it.
          throw new Error(
            `Failed to embed chunk "${raw.id}" with ${embeddingModel}. ` +
              "No index was written — check OPENAI_API_KEY and EMBEDDING_MODEL, then re-run."
          );
        }
        newChunksList.push({
          id: raw.id,
          hash: raw.hash,
          content: raw.content,
          metadata: raw.metadata,
          embedding,
        });
        embeddedCount++;
      }
    }
  }

  // The authoritative width is whatever the API actually returned, so a model
  // this project has no table entry for still produces a correct index.
  const dimension = newChunksList[0]?.embedding.length ?? getExpectedEmbeddingDimension(embeddingModel) ?? 0;
  const inconsistent = newChunksList.filter((c) => c.embedding.length !== dimension);
  if (inconsistent.length > 0) {
    throw new Error(
      `Embeddings came back at mixed widths (e.g. "${inconsistent[0].id}" is ${inconsistent[0].embedding.length}, expected ${dimension}). No index was written.`
    );
  }

  const updatedIndex: VectorDatabaseIndex = {
    version: "1.0.0",
    embeddingModel,
    dimension,
    updatedAt: new Date().toISOString(),
    chunks: newChunksList,
  };

  fs.writeFileSync(INDEX_FILE_PATH, JSON.stringify(updatedIndex, null, 2), "utf-8");

  console.log("\n=== Ingestion Complete ===");
  console.log(`Total Chunks: ${updatedIndex.chunks.length}`);
  console.log(`Dimension: ${updatedIndex.dimension} (${updatedIndex.embeddingModel})`);
  console.log(`New Embeddings Generated: ${embeddedCount}`);
  console.log(`Existing Chunks Reused: ${reusedCount}`);
  console.log(`Saved vector database to: ${INDEX_FILE_PATH}`);
}

runIngestion().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
