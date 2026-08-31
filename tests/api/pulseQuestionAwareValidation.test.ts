import { describe, expect, it } from "vitest";
import { validateAnswerAgainstQuestion, detectActiveQuestionTarget } from "@/lib/pulse/answerValidator";

describe("Pulse — Question-Aware Answer Validation Suite (Test Scenarios A - L)", () => {
  describe("TEST A: Budget asked + Gibberish ('asdfklisadfi')", () => {
    it("rejects gibberish budget answer", () => {
      const res = validateAnswerAgainstQuestion("asdfklisadfi", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST B: Budget asked + Monetary ('$5,000')", () => {
    it("accepts valid monetary budget answer", () => {
      const res = validateAnswerAgainstQuestion("$5,000", "budget");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST C: Budget asked + Uncertainty ('I\'m not sure yet.')", () => {
    it("accepts valid uncertainty budget answer", () => {
      const res = validateAnswerAgainstQuestion("I'm not sure yet.", "budget");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST D: Budget asked + Team Discussion ('We\'ll decide after talking to the team.')", () => {
    it("accepts valid team alignment budget answer", () => {
      const res = validateAnswerAgainstQuestion("We'll decide after talking to the team.", "budget");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST E: Budget asked + Timeline ('As soon as possible.')", () => {
    it("rejects timeline answer when budget question is active", () => {
      const res = validateAnswerAgainstQuestion("As soon as possible.", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST F: Timeline asked + Timeline ('As soon as possible.')", () => {
    it("accepts timeline answer when timeline question is active", () => {
      const res = validateAnswerAgainstQuestion("As soon as possible.", "timeline");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST G: Platform asked + Industry ('Restaurant')", () => {
    it("rejects standalone industry answer when platform question is active", () => {
      const res = validateAnswerAgainstQuestion("Restaurant", "platform");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST H: Industry asked + Industry ('Restaurant')", () => {
    it("accepts industry answer when industry question is active", () => {
      const res = validateAnswerAgainstQuestion("Restaurant", "industry");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST I: Budget asked + Greeting ('Hello')", () => {
    it("rejects greeting when budget question is active", () => {
      const res = validateAnswerAgainstQuestion("Hello", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST J: Budget asked + Stretched Greeting ('Hyyyyy')", () => {
    it("rejects stretched greeting when budget question is active", () => {
      const res = validateAnswerAgainstQuestion("Hyyyyy", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST K: Budget asked + Company FAQ ('Who is the CEO of SEVA?')", () => {
    it("rejects company question when budget question is active", () => {
      const res = validateAnswerAgainstQuestion("Who is the CEO of SEVA?", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST L: Budget asked + Project Scope Statement ('I need a mobile app for my restaurant.')", () => {
    it("rejects project requirement statement as budget answer", () => {
      const res = validateAnswerAgainstQuestion("I need a mobile app for my restaurant.", "budget");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST M: Budget asked + Textual Monetary ('Around five thousand dollars.')", () => {
    it("accepts valid textual monetary budget answer", () => {
      const res = validateAnswerAgainstQuestion("Around five thousand dollars.", "budget");
      expect(res.isValid).toBe(true);
    });
  });

  describe("TEST N: Timeline asked + Monetary ('$5,000')", () => {
    it("rejects monetary answer when timeline question is active", () => {
      const res = validateAnswerAgainstQuestion("$5,000", "timeline");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST O: Industry asked + Monetary ('$5,000')", () => {
    it("rejects monetary answer when industry question is active", () => {
      const res = validateAnswerAgainstQuestion("$5,000", "industry");
      expect(res.isValid).toBe(false);
    });
  });

  describe("TEST P: Platform asked + Mobile Application ('Mobile application')", () => {
    it("accepts mobile application answer when platform question is active", () => {
      const res = validateAnswerAgainstQuestion("Mobile application", "platform");
      expect(res.isValid).toBe(true);
    });
  });

  describe("Question Target Detection", () => {
    it("detects budget question from assistant history", () => {
      const history = [
        { role: "user" as const, content: "I want a restaurant web app" },
        { role: "assistant" as const, content: "What is your target launch timeline and budget window?" },
      ];
      expect(detectActiveQuestionTarget(history, {})).toBe("budget");
    });

    it("detects timeline question from assistant history", () => {
      const history = [
        { role: "user" as const, content: "I want a restaurant web app" },
        { role: "assistant" as const, content: "What is your target launch timeframe?" },
      ];
      expect(detectActiveQuestionTarget(history, {})).toBe("timeline");
    });
  });
});
