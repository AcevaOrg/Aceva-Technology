import { pulseReducer, initialState } from "../components/pulse/PulseContext";

function testEnhancedPulseFeatures() {
  console.log("=== TESTING ENHANCED PULSE AI FEATURES ===");

  // Test 1: UNDO_LAST_ANSWER
  console.log("\n1. Testing UNDO_LAST_ANSWER action...");
  let state = {
    ...initialState,
    stage: "discovery" as const,
    step: 2,
    answers: ["Answer 1", "Answer 2"],
    messages: [
      { id: "m1", sender: "user" as const, text: "Answer 1", timestamp: "10:00" },
      { id: "m2", sender: "pulse" as const, text: "Pulse Response 1", timestamp: "10:00" },
      { id: "m3", sender: "user" as const, text: "Answer 2", timestamp: "10:01" },
      { id: "m4", sender: "pulse" as const, text: "Pulse Response 2", timestamp: "10:01" },
    ],
  };

  const undoneState = pulseReducer(state, { type: "UNDO_LAST_ANSWER" });
  console.log(`Original step: ${state.step} -> Undone step: ${undoneState.step}`);
  console.log(`Original answers: ${state.answers.length} -> Undone answers: ${undoneState.answers.length}`);
  console.log(`Original messages: ${state.messages.length} -> Undone messages: ${undoneState.messages.length}`);

  if (undoneState.step === 1 && undoneState.answers.length === 1 && undoneState.messages.length === 2) {
    console.log("✅ PASSED: UNDO_LAST_ANSWER correctly popped last Q&A pair and decremented step!");
  } else {
    console.error("❌ FAILED: UNDO_LAST_ANSWER did not update state properly!");
  }

  // Test 2: RESTART clears state completely
  console.log("\n2. Testing RESTART action reset...");
  const restartedState = pulseReducer(state, { type: "RESTART" });
  if (restartedState.stage === "intent" && restartedState.step === 0 && restartedState.answers.length === 0) {
    console.log("✅ PASSED: RESTART cleanly reset state back to intent stage!");
  } else {
    console.error("❌ FAILED: RESTART did not reset state properly!");
  }

  console.log("\n=== ALL ENHANCED FEATURES TESTS COMPLETED ===");
}

testEnhancedPulseFeatures();
