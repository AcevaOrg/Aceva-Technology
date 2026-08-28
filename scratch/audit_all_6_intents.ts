import { generatePulseCompletion } from "../lib/pulse/llm";
import { getDirection, saveDirection } from "../lib/pulse/directionStore";

async function auditIntents() {
  console.log("=== AUDITING ALL 6 INTENT OPTIONS ===");

  const options = [
    { label: "01 Start something new", text: "I want to start something new." },
    { label: "02 Improve what I have", text: "I want to improve what I have." },
    { label: "03 Automate something", text: "I want to automate something." },
    { label: "04 Sell something", text: "I want to sell something online." },
    { label: "05 Solve a problem", text: "I want to solve a business problem." },
    { label: "06 I don't know yet", text: "I'm not sure yet, can you help me figure out what I need?" },
  ];

  let passedCount = 0;

  for (const opt of options) {
    console.log(`\n--- Testing Option: ${opt.label} ---`);
    console.log(`Input Prompt: "${opt.text}"`);

    try {
      const response = await generatePulseCompletion(opt.text);
      console.log(`PULSE Response Length: ${response.length} chars`);
      console.log(`PULSE Response Snippet:\n${response.slice(0, 250)}...\n`);

      if (
        response &&
        !response.includes("unrelated topics") &&
        !response.includes("unavailable")
      ) {
        console.log(`✅ ${opt.label}: PASSED (Friendly, relevant response returned)`);
        passedCount++;
      } else {
        console.error(`❌ ${opt.label}: FAILED (Returned error or out-of-scope rejection)`);
      }
    } catch (err) {
      console.error(`❌ ${opt.label}: EXCEPTION (${err})`);
    }
  }

  console.log(`\n=== RESULT: ${passedCount}/${options.length} INTENT OPTIONS PASSED ===`);
}

auditIntents();
