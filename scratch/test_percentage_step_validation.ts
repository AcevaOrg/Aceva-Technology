import { generatePulseCompletion } from "../lib/pulse/llm";
import { isGreetingInput, isInvalidOrUnclearInput, GREETING_REJECTION, OUT_OF_SCOPE_REJECTION } from "../lib/pulse/scope";

async function testPercentageStepValidation() {
  console.log("=== TESTING PERCENTAGE & STEP VALIDATION RULES ===");

  const inputs = [
    { text: "hi", shouldBeValid: false },
    { text: "hello", shouldBeValid: false },
    { text: "hey", shouldBeValid: false },
    { text: "a", shouldBeValid: false },
    { text: "asdfghjkl", shouldBeValid: false },
    { text: "what is the capital of France?", shouldBeValid: false },
    { text: "I want to build a mobile application for food ordering", shouldBeValid: true },
  ];

  let passed = 0;

  for (const input of inputs) {
    const isGreeting = isGreetingInput(input.text);
    const isInvalid = isInvalidOrUnclearInput(input.text);
    const answer = await generatePulseCompletion(input.text);
    const isValid = !isGreeting && !isInvalid && answer !== GREETING_REJECTION && answer !== OUT_OF_SCOPE_REJECTION;

    console.log(`\nInput: "${input.text}"`);
    console.log(` -> isValid: ${isValid} (Expected: ${input.shouldBeValid})`);

    if (isValid === input.shouldBeValid) {
      console.log(`✅ PASSED!`);
      passed++;
    } else {
      console.error(`❌ FAILED!`);
    }
  }

  console.log(`\n=== RESULT: ${passed}/${inputs.length} VALIDATION TESTS PASSED ===`);
}

testPercentageStepValidation();
