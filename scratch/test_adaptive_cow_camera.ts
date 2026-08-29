import { generatePulseCompletion } from "../lib/pulse/llm";

async function testAdaptiveCowCamera() {
  console.log("=== TESTING ADAPTIVE QUESTIONING ON USER'S COW CAMERA EXAMPLE ===");

  const turn1Prompt = "I want an algorithm in a mobile application that uses a camera to scan a video feed of cows or cars and count the exact number of cows living or cars present.";

  console.log(`\nTurn 1 Prompt: "${turn1Prompt}"`);
  const resp1 = await generatePulseCompletion(turn1Prompt);
  console.log(`\nPULSE Turn 1 Response:\n${resp1}\n`);

  const history = [
    { role: "user" as const, content: turn1Prompt },
    { role: "assistant" as const, content: resp1 },
  ];

  const turn2Prompt = "It will be used on iOS and Android smartphones by farm managers. We want it ready in 4 weeks with a budget around $15k.";
  console.log(`\nTurn 2 Prompt: "${turn2Prompt}"`);
  const resp2 = await generatePulseCompletion(turn2Prompt, history);
  console.log(`\nPULSE Turn 2 Response:\n${resp2}\n`);
}

testAdaptiveCowCamera();
