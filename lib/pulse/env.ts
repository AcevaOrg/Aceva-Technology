import fs from "fs";
import path from "path";

/**
 * Type-safe, centralized environment configuration for ACEVA PULSE.
 */

/**
 * Default embedding model when EMBEDDING_MODEL is unset.
 *
 * Declared here rather than imported from `./embeddings` to keep the dependency
 * one-way: embeddings reads its configuration from this module.
 */
const FALLBACK_EMBEDDING_MODEL = "text-embedding-3-small";

interface ServerEnv {
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  EMBEDDING_MODEL: string;
  DATABASE_URL: string;
  NODE_ENV: string;
}

/**
 * Reads a value out of a raw .env file body. Surrounding quotes are stripped
 * because dotenv-style files may quote values — `neon link`, for one, writes
 * DATABASE_URL="postgres://..." — and a quoted connection string is not a
 * valid URL. Next.js strips these itself at runtime; this parser must match it.
 */
function readEnvFileValue(content: string, key: string): string {
  const match = content.match(new RegExp("^" + key + "\\s*=\\s*(.*)$", "m"));
  if (!match || !match[1]) return "";
  const value = match[1].trim();
  const quoted = value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")));
  return quoted ? value.slice(1, -1).trim() : value;
}

let cachedEnv: ServerEnv | null = null;

export function clearEnvCache(): void {
  cachedEnv = null;
}

function loadServerEnv(): ServerEnv {
  if (cachedEnv && process.env.NODE_ENV !== "test") return cachedEnv;

  let openAiApiKey = process.env.OPENAI_API_KEY !== undefined ? process.env.OPENAI_API_KEY.trim() : "";
  let openAiModel = process.env.OPENAI_MODEL ? process.env.OPENAI_MODEL.trim() : "gpt-4o-mini";
  let embeddingModel = process.env.EMBEDDING_MODEL
    ? process.env.EMBEDDING_MODEL.trim()
    : FALLBACK_EMBEDDING_MODEL;
  let databaseUrl = process.env.DATABASE_URL !== undefined ? process.env.DATABASE_URL.trim() : "";

  // Fallback to direct .env.local file parsing for CLI script contexts (e.g. npx tsx)
  try {
    const envLocalPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf-8");

      if (!openAiApiKey && process.env.OPENAI_API_KEY === undefined) {
        openAiApiKey = readEnvFileValue(content, "OPENAI_API_KEY") || openAiApiKey;
      }

      if (!openAiModel || openAiModel === "gpt-4o-mini") {
        openAiModel = readEnvFileValue(content, "OPENAI_MODEL") || openAiModel;
      }

      if (!embeddingModel || embeddingModel === FALLBACK_EMBEDDING_MODEL) {
        embeddingModel = readEnvFileValue(content, "EMBEDDING_MODEL") || embeddingModel;
      }

      if (!databaseUrl && process.env.DATABASE_URL === undefined) {
        databaseUrl = readEnvFileValue(content, "DATABASE_URL") || databaseUrl;
      }
    }
  } catch {
    // Ignore read errors
  }

  cachedEnv = {
    OPENAI_API_KEY: openAiApiKey,
    OPENAI_MODEL: openAiModel,
    EMBEDDING_MODEL: embeddingModel,
    DATABASE_URL: databaseUrl,
    NODE_ENV: process.env.NODE_ENV || "development",
  };

  return cachedEnv;
}

export function getOpenAIApiKey(): string {
  return loadServerEnv().OPENAI_API_KEY;
}

export function getOpenAIModel(): string {
  return loadServerEnv().OPENAI_MODEL;
}

export function getEmbeddingModel(): string {
  return loadServerEnv().EMBEDDING_MODEL;
}

export function getDatabaseUrl(): string {
  return loadServerEnv().DATABASE_URL;
}
