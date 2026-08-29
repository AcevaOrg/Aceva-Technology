import { downloadPulseBlueprintDocx } from "../lib/pulse/docxGenerator";
import { PulseState } from "../components/pulse/types";

async function testDocxExport() {
  console.log("=== TESTING DOCX GENERATOR ===");
  const testState: PulseState = {
    open: true,
    stage: "confirmation",
    step: 5,
    answers: [
      "I want to build a custom food ordering app for 3 restaurant locations.",
      "Hospitality industry",
      "We want to lower 3rd party commission costs.",
      "4-6 weeks timeframe.",
    ],
    context: {
      intent: "Start something new",
      industry: "Hospitality",
      scale: "3 restaurant branches",
      goals: ["Online ordering", "Kitchen automation"],
      friction: ["High commission fees on 3rd party apps"],
    },
    messages: [],
    lead: { name: "John Doe", contact: "john@example.com", method: "Email" as const },
    id: "PLS-260829-999",
  };

  console.log("Generating DOCX blueprint for PLS-260829-999...");
  try {
    if (typeof window === "undefined") {
      (global as unknown as { window: object }).window = {};
      (global as unknown as { document: object }).document = {
        createElement: () => ({ click: () => {}, appendChild: () => {}, removeChild: () => {} }),
        body: { appendChild: () => {}, removeChild: () => {} },
      };
      (global as unknown as { URL: object }).URL = {
        createObjectURL: () => "blob:test-url",
        revokeObjectURL: () => {},
      };
    }
    await downloadPulseBlueprintDocx(testState, "PLS-260829-999");
    console.log("✅ PASSED: Word .docx document generated successfully!");
  } catch (err) {
    console.error("❌ FAILED: Error generating docx document:", err);
  }
}

testDocxExport();
