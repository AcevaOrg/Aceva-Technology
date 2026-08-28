import { getOpenAIApiKey, getOpenAIModel } from "../lib/pulse/env";
import OpenAI from "openai";

async function testOpenAI() {
  const apiKey = getOpenAIApiKey();
  const model = getOpenAIModel();

  console.log("=== PULSE OpenAI LLM Provider Test ===");
  console.log(`OpenAI Configured: ${apiKey ? "YES" : "NO"}`);
  console.log(`OpenAI Model: ${model}`);

  if (!apiKey) {
    console.log("Status: SKIPPED (no key)");
    return;
  }

  const start = Date.now();
  try {
    const openai = new OpenAI({ apiKey });
    const c = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Respond with exactly: OK" }],
      max_tokens: 5,
      temperature: 0,
    });
    const text = c.choices[0]?.message?.content?.trim() || "";
    console.log(`Status: PASS`);
    console.log(`Latency: ${Date.now() - start}ms`);
    console.log(`Output: "${text}"`);
  } catch (err: unknown) {
    const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : "unknown";
    console.log(`Status: FAIL (HTTP ${status})`);
    console.log(`Latency: ${Date.now() - start}ms`);
  }
}

testOpenAI().catch(console.error);
