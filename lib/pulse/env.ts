import fs from "fs";
import path from "path";

/**
 * Type-safe, centralized environment configuration for ACEVA PULSE.
 */

interface ServerEnv {
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  EMBEDDING_MODEL: string;
  NODE_ENV: string;
}

let cachedEnv: ServerEnv | null = null;

export function clearEnvCache(): void {
  cachedEnv = null;
}

function loadServerEnv(): ServerEnv {
  if (cachedEnv && process.env.NODE_ENV !== "test") return cachedEnv;

  let openAiApiKey = process.env.OPENAI_API_KEY !== undefined ? process.env.OPENAI_API_KEY.trim() : "";
  let openAiModel = process.env.OPENAI_MODEL ? process.env.OPENAI_MODEL.trim() : "gpt-4o-mini";
  let embeddingModel = process.env.EMBEDDING_MODEL ? process.env.EMBEDDING_MODEL.trim() : "aceva-semantic-vector-v3";

  // Fallback to direct .env.local file parsing for CLI script contexts (e.g. npx tsx)
  try {
    const envLocalPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, "utf-8");

      if (!openAiApiKey && process.env.OPENAI_API_KEY === undefined) {
        const keyMatch = content.match(/^OPENAI_API_KEY\s*=\s*(.*)$/m);
        if (keyMatch && keyMatch[1]) openAiApiKey = keyMatch[1].trim();
      }

      if (!openAiModel || openAiModel === "gpt-4o-mini") {
        const modelMatch = content.match(/^OPENAI_MODEL\s*=\s*(.*)$/m);
        if (modelMatch && modelMatch[1]) openAiModel = modelMatch[1].trim();
      }

      if (!embeddingModel || embeddingModel === "aceva-semantic-vector-v3") {
        const embMatch = content.match(/^EMBEDDING_MODEL\s*=\s*(.*)$/m);
        if (embMatch && embMatch[1]) embeddingModel = embMatch[1].trim();
      }
    }
  } catch {
    // Ignore read errors
  }

  cachedEnv = {
    OPENAI_API_KEY: openAiApiKey,
    OPENAI_MODEL: openAiModel,
    EMBEDDING_MODEL: embeddingModel,
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
