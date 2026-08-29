import fs from "fs";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";
import { DocumentChunkMetadata, VectorDatabaseIndex, VectorDocumentChunk } from "../components/pulse/types";
import { generateEmbedding, EMBEDDING_DIMENSION, EMBEDDING_MODEL_NAME } from "../lib/pulse/embeddings";

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const INDEX_FILE_PATH = path.join(KNOWLEDGE_DIR, "vectorIndex.json");

interface RawChunk {
  id: string;
  hash: string;
  content: string;
  metadata: DocumentChunkMetadata;
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
    const trimmed = rawSection.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[2].trim() : undefined;

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
  console.log("=== ACEVA Knowledge Ingestion & Embedding Pipeline ===");

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`Knowledge directory not found at: ${KNOWLEDGE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  console.log(`Found ${files.length} knowledge markdown files.`);

  // Load existing index for idempotency
  let existingIndex: VectorDatabaseIndex = {
    version: "1.0.0",
    embeddingModel: EMBEDDING_MODEL_NAME,
    dimension: EMBEDDING_DIMENSION,
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
        existingIndex.embeddingModel === EMBEDDING_MODEL_NAME
      ) {
        // Reuse existing embedding (Idempotent)
        newChunksList.push(existing);
        reusedCount++;
      } else {
        // Generate new embedding
        console.log(`Embedding chunk: ${raw.id} (${raw.metadata.title} - ${raw.metadata.heading || "Main"})`);
        const embedding = await generateEmbedding(raw.content);
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

  const updatedIndex: VectorDatabaseIndex = {
    version: "1.0.0",
    embeddingModel: EMBEDDING_MODEL_NAME,
    dimension: EMBEDDING_DIMENSION,
    updatedAt: new Date().toISOString(),
    chunks: newChunksList,
  };

  fs.writeFileSync(INDEX_FILE_PATH, JSON.stringify(updatedIndex, null, 2), "utf-8");

  console.log("\n=== Ingestion Complete ===");
  console.log(`Total Chunks: ${updatedIndex.chunks.length}`);
  console.log(`New Embeddings Generated: ${embeddedCount}`);
  console.log(`Existing Chunks Reused: ${reusedCount}`);
  console.log(`Saved vector database to: ${INDEX_FILE_PATH}`);
}

runIngestion().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
