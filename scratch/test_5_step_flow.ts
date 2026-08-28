import { generatePulseCompletion } from "../lib/pulse/llm";

async function test5StepFlow() {
  console.log("=== TESTING 5-STEP SECTION-RELEVANT DISCOVERY & BUDGET BAN ===");

  const prompts = [
    "I select 'I don't know yet'. I am building an algorithm in a mobile application that uses a camera to scan a video feed of cows or cars and count the exact number of cows living or cars present.",
    "It will be used on iOS and Android smartphones by farm managers in open fields.",
    "We need real-time object detection with live count overlay on the camera screen.",
    "Our target timeline is to have this operational within 6 weeks.",
    "We have set aside a budget allocation of $20,000 for full development.",
  ];

  const history: { role: "user" | "assistant"; content: string }[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const userPrompt = prompts[i];
    console.log(`\n--- Step ${i + 1} Prompt: "${userPrompt}" ---`);

    const response = await generatePulseCompletion(userPrompt, history);
    console.log(`PULSE Step ${i + 1} Response:\n${response}\n`);

    // Verify budget ban
    if (i < 4 && (response.includes("$5,000") || response.includes("$10,000") || response.includes("$15,000"))) {
      console.error(`❌ Step ${i + 1}: FAILED - PULSE guessed a budget number!`);
    } else {
      console.log(`✅ Step ${i + 1}: PASSED - Budget ban verified`);
    }

    history.push({ role: "user", content: userPrompt });
    history.push({ role: "assistant", content: response });
  }
}

test5StepFlow();
