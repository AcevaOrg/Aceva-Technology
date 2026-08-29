import { generatePulseCompletion } from "../lib/pulse/llm";
import { saveDirection } from "../lib/pulse/directionStore";

async function testPulseIdTimeline() {
  console.log("=== TESTING PULSE ID TIMELINE & LAST ANSWER PERSISTENCE ===");

  const pulseId = "PLS-260827-999";
  const answers = [
    "I want a mobile app for ordering food",
    "High delivery commission fees from third parties",
    "3 restaurant branches in Karachi with 20 staff",
    "Direct ordering with live order tracking",
    "Operational within 6 weeks with $15,000 budget",
  ];

  saveDirection({
    pulseId,
    lead: { name: "Test Client", contact: "client@test.com", method: "Email" },
    context: {
      industry: "Hospitality & Restaurant",
      intent: "Start something new",
      timeline: "Operational within 6 weeks with $15,000 budget",
      scale: "3 restaurant branches in Karachi",
      goals: ["Direct ordering", "Live order tracking"],
      friction: ["High delivery commission fees"],
    },
    answers,
    recommendedModules: ["Custom Digital Ordering & Menu Portal", "Kitchen Display System"],
    createdAt: new Date().toISOString(),
  });

  const response = await generatePulseCompletion(`Tell me about ${pulseId}`);
  console.log(`\nPULSE ID Lookup Response:\n${response}\n`);

  if (response.includes("6 weeks") && response.includes("Operational within 6 weeks")) {
    console.log("✅ PASSED: Last answer timeline and Q&A history successfully retrieved!");
  } else {
    console.error("❌ FAILED: Timeline was not present in PULSE ID response!");
  }
}

testPulseIdTimeline();
