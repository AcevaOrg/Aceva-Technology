import { describe, expect, it } from "vitest";

import { buildChatRequestBody, initialState } from "@/components/pulse/PulseContext";
import type { PulseState } from "@/components/pulse/types";

function stateWith(overrides: Partial<PulseState>): PulseState {
  return { ...initialState, ...overrides };
}

describe("buildChatRequestBody", () => {
  it("merges this turn's inferred context into what it sends", () => {
    // The reducer applies `inferred` only after the response comes back, so
    // sending state.context alone left the server reasoning about the previous
    // turn — it could not see the industry the current message established.
    const state = stateWith({
      stage: "discovery",
      step: 1,
      context: { intent: "Start something new", industry: "Business Services" },
    });

    const body = buildChatRequestBody("Our dental clinic still uses paper", state, {
      industry: "Healthcare & Clinics",
      current: "Paper records",
    });

    expect(body.context).toEqual({
      intent: "Start something new",
      industry: "Healthcare & Clinics",
      current: "Paper records",
    });
  });

  it("keeps existing context when this turn infers nothing", () => {
    const state = stateWith({ context: { intent: "Automate something" } });

    expect(buildChatRequestBody("tell me more", state, undefined).context).toEqual({
      intent: "Automate something",
    });
  });

  it("lets the current turn override a stale value rather than appending to it", () => {
    const state = stateWith({ context: { industry: "Business Services", scale: "2 sites" } });

    const body = buildChatRequestBody("actually we have twelve sites", state, { scale: "12 sites" });

    expect(body.context.scale).toBe("12 sites");
    expect(body.context.industry).toBe("Business Services");
  });

  it("sends the active step while the wizard is running", () => {
    for (const step of [0, 1, 2, 3, 4]) {
      const state = stateWith({ stage: "discovery", step });
      expect(buildChatRequestBody("answer", state).step).toBe(step);
    }
  });

  it("sends no step outside the wizard", () => {
    for (const stage of ["entry", "intent", "direction", "contact", "confirmation"] as const) {
      const state = stateWith({ stage, step: 2 });
      expect(buildChatRequestBody("answer", state).step).toBeUndefined();
    }
  });

  it("sends only the last 8 history messages", () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      id: `m${i}`,
      sender: (i % 2 === 0 ? "user" : "pulse") as "user" | "pulse",
      text: `turn ${i}`,
      timestamp: "",
    }));

    const body = buildChatRequestBody("latest", stateWith({ messages }));

    expect(body.history).toHaveLength(8);
    expect(body.history[0].content).toBe("turn 22");
    expect(body.history[7].content).toBe("turn 29");
    expect(body.history.every((m) => m.role === "user" || m.role === "assistant")).toBe(true);
  });

  it("maps the pulse sender onto the assistant role", () => {
    const body = buildChatRequestBody(
      "latest",
      stateWith({
        messages: [
          { id: "a", sender: "user", text: "mine", timestamp: "" },
          { id: "b", sender: "pulse", text: "theirs", timestamp: "" },
        ],
      })
    );

    expect(body.history).toEqual([
      { role: "user", content: "mine" },
      { role: "assistant", content: "theirs" },
    ]);
  });

  it("sends the message verbatim", () => {
    expect(buildChatRequestBody("  keep my spacing  ", initialState).message).toBe("  keep my spacing  ");
  });
});
