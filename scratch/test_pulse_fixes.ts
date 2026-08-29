import { generatePulseCompletion } from "../lib/pulse/llm";
import { GREETING_REJECTION, OUT_OF_SCOPE_REJECTION } from "../lib/pulse/scope";

async function runPulseFixesTest() {
  console.log("=== TESTING PULSE AI FIXES ===");

  // Test 1: Greetings
  console.log("\n1. Testing Greeting Inputs ('hi', 'hello')...");
  const greetingResult = await generatePulseCompletion("hi");
  console.log(`Input: "hi" -> Output:\n"${greetingResult}"`);
  if (greetingResult === GREETING_REJECTION) {
    console.log("✅ PASSED: Greeting input correctly answered with polite request!");
  } else {
    console.error("❌ FAILED: Greeting was not caught by greeting rejection!");
  }

  // Test 2: Invalid / Unclear / Gibberish Input
  console.log("\n2. Testing Gibberish Input ('asdfghjkl')...");
  const gibberishResult = await generatePulseCompletion("asdfghjkl");
  console.log(`Input: "asdfghjkl" -> Output:\n"${gibberishResult}"`);
  if (gibberishResult === OUT_OF_SCOPE_REJECTION) {
    console.log("✅ PASSED: Gibberish input rejected cleanly!");
  } else {
    console.error("❌ FAILED: Gibberish input was not rejected!");
  }

  // Test 3: Out-of-Scope Trivia Input
  console.log("\n3. Testing Trivia Input ('what is the capital of France?')...");
  const triviaResult = await generatePulseCompletion("what is the capital of France?");
  console.log(`Input: "what is the capital of France?" -> Output:\n"${triviaResult}"`);
  if (triviaResult === OUT_OF_SCOPE_REJECTION) {
    console.log("✅ PASSED: Trivia input rejected cleanly!");
  } else {
    console.error("❌ FAILED: Trivia input was not rejected!");
  }

  // Test 4: Relevant Pulse Project Question
  console.log("\n4. Testing Valid Project Question ('I want a mobile app for restaurant ordering')...");
  const validResult = await generatePulseCompletion("I want a mobile app for restaurant ordering");
  console.log(`Input: Valid Question -> Response Snippet:\n"${validResult.slice(0, 180)}..."`);
  if (validResult && validResult !== GREETING_REJECTION && validResult !== OUT_OF_SCOPE_REJECTION) {
    console.log("✅ PASSED: Valid project question answered properly!");
  } else {
    console.error("❌ FAILED: Valid project question was incorrectly rejected!");
  }

  console.log("\n=== ALL PULSE FIXES TESTS COMPLETED ===");
}

runPulseFixesTest();
