import { describe, expect, it } from "vitest";
import {
  parseStoredSession,
  SESSION_MAX_AGE_MS,
  pulseReducer,
  initialState,
} from "@/components/pulse/PulseContext";
import type { PulseState } from "@/components/pulse/types";

const NOW = Date.UTC(2026, 9, 8, 12, 0, 0);

function message(id: string, sender: "user" | "pulse", text: string) {
  return { id, sender, text, timestamp: "12:00" };
}

function stored(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    savedAt: NOW - 60_000,
    stage: "discovery",
    step: 2,
    answers: ["first", "second"],
    answerMarks: [1, 3],
    context: { intent: "Automate something" },
    messages: [message("a", "user", "hello"), message("b", "pulse", "hi")],
    ...overrides,
  });
}

describe("parseStoredSession", () => {
  it("restores a well-formed recent session", () => {
    const session = parseStoredSession(stored(), NOW);

    expect(session?.stage).toBe("discovery");
    expect(session?.step).toBe(2);
    expect(session?.answers).toEqual(["first", "second"]);
    expect(session?.messages).toHaveLength(2);
  });

  describe("expiry", () => {
    it("drops a session older than seven days", () => {
      expect(parseStoredSession(stored({ savedAt: NOW - SESSION_MAX_AGE_MS - 1 }), NOW)).toBeNull();
    });

    it("keeps one just inside the window", () => {
      expect(parseStoredSession(stored({ savedAt: NOW - SESSION_MAX_AGE_MS + 1000 }), NOW)).not.toBeNull();
    });

    it("drops a session with no timestamp, which predates expiry tracking", () => {
      expect(parseStoredSession(stored({ savedAt: undefined }), NOW)).toBeNull();
    });

    it("drops a timestamp from the future", () => {
      expect(parseStoredSession(stored({ savedAt: NOW + 10 * 60_000 }), NOW)).toBeNull();
    });
  });

  describe("shape validation", () => {
    it("returns null for input that is not a session at all", () => {
      for (const raw of [null, "", "not json", "[1,2,3]", '"a string"', "null", "42"]) {
        expect(parseStoredSession(raw, NOW)).toBeNull();
      }
    });

    it("returns null when there are no usable messages", () => {
      // The reducer used to spread storage verbatim, so a missing `messages`
      // left state.messages undefined and the next render threw on `.map`.
      for (const messages of [undefined, [], "nope", [{}], [null]]) {
        expect(parseStoredSession(stored({ messages }), NOW)).toBeNull();
      }
    });

    it("keeps the valid messages and discards malformed ones", () => {
      const session = parseStoredSession(
        stored({ messages: [message("a", "user", "kept"), { id: "b" }, null, message("c", "pulse", "also kept")] }),
        NOW
      );

      expect(session?.messages).toHaveLength(2);
      expect(session?.messages?.map((m) => m.text)).toEqual(["kept", "also kept"]);
    });

    it("drops a field that is the wrong type rather than the whole session", () => {
      const session = parseStoredSession(
        stored({ stage: "nonsense", step: -4, answers: "not an array" }),
        NOW
      );

      expect(session).not.toBeNull();
      expect(session?.stage).toBeUndefined();
      expect(session?.step).toBeUndefined();
      expect(session?.answers).toBeUndefined();
      expect(session?.messages).toHaveLength(2);
    });

    it("ignores answer marks that no longer line up with the answers", () => {
      expect(parseStoredSession(stored({ answerMarks: [1] }), NOW)?.answerMarks).toBeUndefined();
      expect(parseStoredSession(stored({ answerMarks: [1, 3] }), NOW)?.answerMarks).toEqual([1, 3]);
    });

    it("restores a lead only when it has both fields, defaulting the method", () => {
      expect(parseStoredSession(stored({ lead: { name: "Jordan" } }), NOW)?.lead).toBeUndefined();

      const lead = parseStoredSession(
        stored({ lead: { name: "Jordan", contact: "j@example.com", method: "carrier pigeon" } }),
        NOW
      )?.lead;
      expect(lead).toEqual({ name: "Jordan", contact: "j@example.com", method: "Email" });
    });
  });
});

describe("RECORD_VALID_ANSWER", () => {
  function discovering(overrides: Partial<PulseState> = {}): PulseState {
    return { ...initialState, stage: "discovery", ...overrides };
  }

  it("records a short answer that an earlier longer one contains", () => {
    // `prev.includes(normNew)` used to swallow this: answering "web" after
    // "I need a web app for my restaurant" counted as a repeat, so the step
    // never advanced and the visitor was stuck re-answering.
    const state = discovering({ answers: ["I need a web app for my restaurant"], step: 1 });
    const next = pulseReducer(state, { type: "RECORD_VALID_ANSWER", value: "web" });

    expect(next.answers).toEqual(["I need a web app for my restaurant", "web"]);
    expect(next.step).toBe(2);
  });

  it("still ignores a genuine repeat", () => {
    const state = discovering({ answers: ["Two locations"], step: 1 });
    const next = pulseReducer(state, { type: "RECORD_VALID_ANSWER", value: "  two locations  " });

    expect(next.answers).toEqual(["Two locations"]);
    expect(next.step).toBe(1);
  });
});

describe("UNDO_LAST_ANSWER", () => {
  it("removes only the turn that was recorded", () => {
    // Build a transcript where one turn failed validation, so the message list
    // and the answer list are deliberately out of step.
    let state: PulseState = { ...initialState, stage: "discovery", messages: [] };

    state = pulseReducer(state, { type: "SEND_MESSAGE", text: "first answer" });
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: "noted" });
    state = pulseReducer(state, { type: "RECORD_VALID_ANSWER", value: "first answer" });

    // A rejected turn: two more bubbles, no recorded answer.
    state = pulseReducer(state, { type: "SEND_MESSAGE", text: "asdfghjkl" });
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: "didn't catch that" });

    state = pulseReducer(state, { type: "SEND_MESSAGE", text: "second answer" });
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: "thanks" });
    state = pulseReducer(state, { type: "RECORD_VALID_ANSWER", value: "second answer" });

    expect(state.answers).toEqual(["first answer", "second answer"]);
    expect(state.messages).toHaveLength(6);

    const undone = pulseReducer(state, { type: "UNDO_LAST_ANSWER" });

    // Blindly dropping two messages would have eaten the rejected turn instead.
    expect(undone.answers).toEqual(["first answer"]);
    expect(undone.messages).toHaveLength(4);
    expect(undone.messages.at(-1)?.text).toBe("didn't catch that");
    expect(undone.step).toBe(state.step - 1);
  });

  it("rewinds past bubbles added after the recorded answer", () => {
    // With a rejected turn trailing the recorded one, dropping "the last two"
    // messages removes the wrong pair: the answer leaves `answers` while its
    // own bubbles stay on screen.
    let state: PulseState = { ...initialState, stage: "discovery", messages: [] };

    state = pulseReducer(state, { type: "SEND_MESSAGE", text: "recorded answer" });
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: "noted" });
    state = pulseReducer(state, { type: "RECORD_VALID_ANSWER", value: "recorded answer" });

    // Rejected afterwards: bubbles, but no recorded answer.
    state = pulseReducer(state, { type: "SEND_MESSAGE", text: "asdfghjkl" });
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: "didn't catch that" });

    expect(state.messages).toHaveLength(4);

    const undone = pulseReducer(state, { type: "UNDO_LAST_ANSWER" });

    expect(undone.answers).toEqual([]);
    // Everything from the recorded turn onward goes, including the later
    // rejected bubbles. slice(0, -2) would have left the answer's own pair.
    expect(undone.messages.map((m) => m.text)).not.toContain("recorded answer");
    expect(undone.messages.map((m) => m.text)).not.toContain("noted");
  });

  it("does nothing when there is no recorded answer", () => {
    const state: PulseState = { ...initialState, stage: "discovery" };
    expect(pulseReducer(state, { type: "UNDO_LAST_ANSWER" })).toBe(state);
  });
});
