"use client";

import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import {
  PulseAction,
  PulseContextData,
  PulseMessage,
  PulseStage,
  PulseState,
} from "./types";
import { describeApiError } from "@/lib/api/errorCodes";

const STORAGE_KEY = "aceva-pulse-v2";
const SESSION_KEY = "aceva-pulse-session";

/**
 * An opaque per-browser id used only to group a visitor's chat turns in the
 * analytics table.
 *
 * Random, never derived from anything about the person, and deliberately the
 * only identifier the turn log stores. Falls back to a fresh value when
 * storage is unavailable (private mode, blocked cookies), which costs grouping
 * for that visitor and nothing else.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const created = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export const INITIAL_PULSE_GREETING =
  "Hello! I'm Aceva Pulse, ACEVA's AI assistant. Tell me what you'd like to build or improve, and I'll help map out your project.";

const initialGreetingMessage = {
  id: "msg-welcome",
  sender: "pulse" as const,
  text: INITIAL_PULSE_GREETING,
  timestamp: "",
};

export const initialState: PulseState = {
  open: false,
  stage: "entry",
  step: 0,
  answers: [],
  context: {},
  messages: [initialGreetingMessage],
  streaming: false,
  retry: null,
  answerMarks: [],
};

export function pulseReducer(state: PulseState, action: PulseAction): PulseState {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        open: true,
        stage: state.stage === "entry" ? "intent" : state.stage,
      };

    case "CLOSE":
      return {
        ...state,
        open: false,
      };

    case "INTENT":
      return {
        ...state,
        stage: "discovery",
        step: 0,
        context: { ...state.context, intent: action.value },
      };

    case "ANSWER": {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: "user" as const,
        text: action.value,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      return {
        ...state,
        answers: [...state.answers, action.value],
        context: { ...state.context, ...action.inferred },
        messages: [...state.messages, newMessage],
        step: state.step + 1,
      };
    }

    case "RECORD_VALID_ANSWER": {
      const cleanVal = action.value.trim().toLowerCase();
      // Ignore initial intent selection prompts from being counted as step answers
      if (
        state.stage === "intent" ||
        /^(i want to start something new|i want to improve what i have|i want to automate something|i want to sell something online|i want to solve a business problem)$/i.test(
          cleanVal
        )
      ) {
        return {
          ...state,
          context: { ...state.context, ...action.inferred },
        };
      }

      const normalise = (value: string) =>
        value.trim().toLowerCase().replace(/^(as i said|like i said|as mentioned|again|to repeat)\s*,?\s*/i, "");
      const normNew = normalise(action.value);

      // Exact match only. The previous `prev.includes(normNew)` meant any short
      // answer was swallowed by a longer earlier one — answering "web" after
      // "I need a web app for my restaurant" counted as a repeat, so the step
      // never advanced and the visitor was stuck re-answering.
      const isDuplicate = state.answers.some((prev) => normalise(prev) === normNew);

      if (isDuplicate) {
        return {
          ...state,
          context: { ...state.context, ...action.inferred },
        };
      }

      return {
        ...state,
        answers: [...state.answers, action.value],
        answerMarks: [...(state.answerMarks ?? []), state.turnStart ?? state.messages.length],
        context: { ...state.context, ...action.inferred },
        step: state.step + 1,
      };
    }

    case "SEND_MESSAGE": {
      const newMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: "user" as const,
        text: action.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      return {
        ...state,
        // Captured before the bubble is added, so undo can rewind to exactly here.
        turnStart: state.messages.length,
        messages: [...state.messages, newMessage],
      };
    }

    case "SET_LOADING":
      return {
        ...state,
        loading: action.loading,
      };

    // The streaming trio. START opens an empty Pulse bubble, DELTA grows it,
    // END replaces it with the authoritative text from the done frame — the two
    // can differ, because enforceClosingStatement rewrites the final discovery
    // reply server-side after the tokens have already gone out.
    case "PULSE_STREAM_START": {
      return {
        ...state,
        streaming: true,
        loading: true,
        messages: [
          ...state.messages,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            sender: "pulse" as const,
            text: "",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      };
    }

    case "PULSE_STREAM_DELTA": {
      const last = state.messages[state.messages.length - 1];
      if (!last || last.sender !== "pulse") return state;
      return {
        ...state,
        messages: [
          ...state.messages.slice(0, -1),
          { ...last, text: last.text + action.text },
        ],
      };
    }

    case "PULSE_STREAM_END": {
      const last = state.messages[state.messages.length - 1];
      const finalText = action.text ?? last?.text ?? "";
      const settled =
        last && last.sender === "pulse"
          ? [...state.messages.slice(0, -1), { ...last, text: finalText }]
          : state.messages;

      return {
        ...state,
        streaming: false,
        loading: false,
        // An aborted stream leaves a partial bubble; drop it if nothing arrived
        // at all, so the user is not left staring at an empty message.
        messages: finalText.trim() ? settled : state.messages.slice(0, -1),
      };
    }

    case "SET_RETRY":
      return { ...state, retry: action.retry };

    case "ADD_PULSE_RESPONSE": {
      const responseMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: "pulse" as const,
        text: action.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      return {
        ...state,
        messages: [...state.messages, responseMessage],
        loading: false,
        streaming: false,
      };
    }

    case "COMPLETE":
      return {
        ...state,
        stage: "direction",
      };

    case "CONTACT":
      return {
        ...state,
        stage: "contact",
      };

    case "CONFIRM":
      return {
        ...state,
        stage: "confirmation",
        lead: action.lead,
        id: action.id,
      };

    case "RESTORE":
      return {
        ...state,
        ...action.session,
        open: false,
      };

    case "RESTART":
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
      return {
        ...initialState,
        open: true,
        stage: "intent",
        messages: [initialGreetingMessage],
      };

    case "UNDO_LAST_ANSWER": {
      if (state.answers.length === 0) return state;

      // Rewind to where that answer's turn began. Blindly dropping the last two
      // messages was wrong whenever the transcript and the answer list were out
      // of step — which they are as soon as one message fails validation, since
      // those add bubbles without recording an answer.
      const marks = state.answerMarks ?? [];
      const mark = marks.length === state.answers.length ? marks[marks.length - 1] : undefined;
      const rewound =
        typeof mark === "number" && mark >= 0 && mark <= state.messages.length
          ? state.messages.slice(0, mark)
          : state.messages;

      return {
        ...state,
        answers: state.answers.slice(0, -1),
        answerMarks: marks.slice(0, -1),
        messages: rewound.length > 0 ? rewound : [initialGreetingMessage],
        step: Math.max(0, state.step - 1),
      };
    }

    default:
      return state;
  }
}

interface PulseContextType {
  state: PulseState;
  dispatch: React.Dispatch<PulseAction>;
  openPulse: () => void;
  closePulse: () => void;
  sendChatMessage: (text: string, inferredContext?: Partial<PulseState["context"]>) => Promise<void>;
  /** Aborts the in-flight turn, keeping whatever tokens already arrived. */
  stopStreaming: () => void;
  /** Re-sends the turn that failed, without duplicating the user's bubble. */
  retryLastMessage: () => Promise<void>;
}

/** One frame of the /api/chat event stream. Mirrors the route's union. */
type StreamFrame =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; isValid: boolean }
  | { type: "error"; error: string; code: string };

/**
 * Splits an SSE byte stream into frames.
 *
 * Chunk boundaries fall wherever the network puts them, so a `data:` line can
 * arrive in pieces; anything after the last blank-line separator is held back
 * until the rest of it shows up.
 */
export async function* readSseFrames(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const payload = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("");
        if (!payload) continue;

        try {
          yield JSON.parse(payload) as StreamFrame;
        } catch {
          // A truncated or malformed frame is skipped rather than killing the
          // whole stream; the done frame is what the caller actually needs.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Builds the /api/chat request body for one turn.
 *
 * Split out of `sendChatMessage` so it can be asserted directly — the project
 * has no React renderer in its test setup, and this is where two real bugs
 * lived: the context lagged a turn behind, and the active step was never sent.
 */
export function buildChatRequestBody(
  text: string,
  state: PulseState,
  inferredContext?: Partial<PulseContextData>
) {
  return {
    message: text,
    sessionId: getSessionId(),
    // Only the window the server keeps: /api/chat forwards the last 8 messages
    // and caps the body at 16KB, so posting a whole long transcript would
    // eventually be rejected outright.
    history: state.messages.slice(-8).map((m) => ({
      role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    })),
    // This turn's inference is merged in before sending. The reducer only
    // applies it after the response arrives, so sending `state.context` alone
    // left the server a turn behind — unable to see the industry or field the
    // current message had just established, which is exactly what
    // detectActiveQuestionTarget needs in order to validate the right field.
    context: { ...state.context, ...inferredContext },
    // Lets the route pin the model to the question already on screen.
    step: state.stage === "discovery" ? state.step : undefined,
  };
}

/** Stored chat older than this is dropped rather than restored. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const STAGES: PulseStage[] = ["entry", "intent", "discovery", "direction", "contact", "confirmation"];

function isMessage(value: unknown): value is PulseMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.sender === "user" || m.sender === "pulse") &&
    typeof m.text === "string" &&
    typeof m.timestamp === "string"
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Turns whatever is in localStorage into a session worth restoring.
 *
 * Storage is not trustworthy input: it can be hand-edited, left behind by an
 * older build with a different shape, or truncated. The reducer used to spread
 * it into state verbatim, so a stored value missing `messages` left
 * `state.messages` undefined and the next render threw on `.map`.
 *
 * Anything malformed is dropped field by field rather than failing the whole
 * restore, and a session past SESSION_MAX_AGE_MS is discarded entirely — a
 * month-old transcript is not something a returning visitor wants to resume.
 */
export function parseStoredSession(
  raw: string | null,
  now: number = Date.now()
): Partial<PulseState> | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const stored = parsed as Record<string, unknown>;

  const savedAt = typeof stored.savedAt === "number" ? stored.savedAt : undefined;
  // A session with no timestamp predates expiry tracking; treat it as stale.
  if (savedAt === undefined || !Number.isFinite(savedAt)) return null;
  if (now - savedAt > SESSION_MAX_AGE_MS || savedAt > now + 60_000) return null;

  const messages = Array.isArray(stored.messages) ? stored.messages.filter(isMessage) : [];
  // Nothing to resume: let the caller start fresh rather than restoring a husk.
  if (messages.length === 0) return null;

  const session: Partial<PulseState> = { messages };

  if (typeof stored.stage === "string" && STAGES.includes(stored.stage as PulseStage)) {
    session.stage = stored.stage as PulseStage;
  }
  if (typeof stored.step === "number" && Number.isInteger(stored.step) && stored.step >= 0) {
    session.step = stored.step;
  }

  const answers = stringArray(stored.answers);
  if (answers) session.answers = answers;

  if (Array.isArray(stored.answerMarks)) {
    const marks = stored.answerMarks.filter(
      (entry): entry is number => typeof entry === "number" && Number.isInteger(entry) && entry >= 0
    );
    // Only useful if it still lines up with the answers it indexes.
    if (marks.length === (session.answers?.length ?? 0)) session.answerMarks = marks;
  }

  if (stored.context && typeof stored.context === "object" && !Array.isArray(stored.context)) {
    session.context = stored.context as PulseContextData;
  }

  const lead = stored.lead;
  if (lead && typeof lead === "object" && !Array.isArray(lead)) {
    const l = lead as Record<string, unknown>;
    if (typeof l.name === "string" && typeof l.contact === "string") {
      session.lead = {
        name: l.name,
        contact: l.contact,
        method: l.method === "Phone" || l.method === "Text" ? l.method : "Email",
      };
    }
  }

  if (typeof stored.id === "string") session.id = stored.id;

  return session;
}

const PulseContext = createContext<PulseContextType | undefined>(undefined);

export function PulseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(pulseReducer, initialState);
  const isHydrated = useRef(false);
  /**
   * Set when a RESTORE has been dispatched but not yet applied to `state`.
   *
   * Both effects below run in the same commit, restore first. Without this
   * flag the save effect saw `isHydrated.current === true` and persisted the
   * pre-restore `initialState` — a lone greeting at stage "intent" — straight
   * over the stored session, because the queued RESTORE had not been applied
   * yet. React's dev double-mount then made that destructive rather than
   * self-correcting: the second mount re-read the clobbered value and
   * faithfully restored one message at stage "intent", so a reload always
   * landed on the intent picker with the transcript gone.
   */
  const restorePending = useRef(false);

  useEffect(() => {
    try {
      const session = parseStoredSession(localStorage.getItem(STORAGE_KEY));
      if (session) {
        restorePending.current = true;
        dispatch({ type: "RESTORE", session });
      } else {
        // Unusable or expired: clear it so it is not re-parsed every load.
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    isHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;
    // The render that still holds the pre-restore state must not be written.
    if (restorePending.current) {
      restorePending.current = false;
      return;
    }
    try {
      const { stage, step, answers, answerMarks, context, messages, lead, id } = state;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ stage, step, answers, answerMarks, context, messages, lead, id, savedAt: Date.now() })
      );
    } catch {
      // Ignore storage errors
    }
  }, [state]);

  const openPulse = () => dispatch({ type: "OPEN" });
  const closePulse = () => dispatch({ type: "CLOSE" });

  // Held in a ref so the Stop button can reach the in-flight request.
  const abortRef = useRef<AbortController | null>(null);

  const stopStreaming = () => {
    abortRef.current?.abort();
  };

  const sendChatMessage = async (
    text: string,
    inferredContext?: Partial<PulseState["context"]>,
    options?: { isRetry?: boolean }
  ) => {
    // A retry re-uses the bubble the first attempt already added.
    if (!options?.isRetry) dispatch({ type: "SEND_MESSAGE", text });
    dispatch({ type: "SET_RETRY", retry: null });
    dispatch({ type: "SET_LOADING", loading: true });

    const controller = new AbortController();
    abortRef.current = controller;

    /** Records the turn so the UI can offer Retry, then shows why it failed. */
    const fail = (message: string) => {
      dispatch({ type: "PULSE_STREAM_END" });
      dispatch({ type: "ADD_PULSE_RESPONSE", text: message });
      dispatch({ type: "SET_RETRY", retry: { text, inferred: inferredContext } });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Opting in. The server answers with buffered JSON otherwise, which
          // is the fallback this whole path degrades to.
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify(buildChatRequestBody(text, state, inferredContext)),
        signal: controller.signal,
      });

      const isStream =
        res.ok &&
        Boolean(res.body) &&
        (res.headers.get("content-type") ?? "").includes("text/event-stream");

      // ---- Non-stream fallback: a proxy stripped the stream, the server chose
      // ---- not to stream, or the request failed outright.
      if (!isStream) {
        const data = await res.json().catch(() => null);

        if (res.ok && data?.answer) {
          dispatch({ type: "ADD_PULSE_RESPONSE", text: data.answer });
          if (data.isValid) {
            dispatch({ type: "RECORD_VALID_ANSWER", value: text, inferred: inferredContext });
          }
          return;
        }

        // describeApiError turns the canonical envelope into something the
        // visitor can act on. A 429 in particular used to surface as a bare
        // "An error occurred" with no indication that waiting would fix it.
        fail(describeApiError(data, "An error occurred while communicating with Pulse."));
        return;
      }

      // ---- Streaming path.
      dispatch({ type: "PULSE_STREAM_START" });

      let settled: { answer: string; isValid: boolean } | null = null;
      let streamError: string | null = null;

      for await (const frame of readSseFrames(res.body as ReadableStream<Uint8Array>)) {
        if (frame.type === "delta") {
          dispatch({ type: "PULSE_STREAM_DELTA", text: frame.text });
        } else if (frame.type === "done") {
          settled = { answer: frame.answer, isValid: frame.isValid };
        } else if (frame.type === "error") {
          streamError = frame.error;
        }
      }

      if (settled) {
        // Reconcile to the authoritative text; usually identical to the tokens.
        dispatch({ type: "PULSE_STREAM_END", text: settled.answer });
        if (settled.isValid) {
          dispatch({ type: "RECORD_VALID_ANSWER", value: text, inferred: inferredContext });
        }
        return;
      }

      // No done frame: the stream errored in-band, or ended early.
      fail(streamError ?? "Pulse stopped responding partway through. Please try again.");
    } catch (error) {
      // Stop is a deliberate act, not a failure: keep the partial reply and
      // offer no error copy, but do leave Retry available.
      if (error instanceof DOMException && error.name === "AbortError") {
        dispatch({ type: "PULSE_STREAM_END" });
        dispatch({ type: "SET_RETRY", retry: { text, inferred: inferredContext } });
        return;
      }
      fail("Unable to connect to Pulse server. Please check your connection and try again.");
    } finally {
      abortRef.current = null;
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  const retryLastMessage = async () => {
    const target = state.retry;
    if (!target) return;
    await sendChatMessage(target.text, target.inferred, { isRetry: true });
  };

  return (
    <PulseContext.Provider
      value={{ state, dispatch, openPulse, closePulse, sendChatMessage, stopStreaming, retryLastMessage }}
    >
      {children}
    </PulseContext.Provider>
  );
}

export function usePulse() {
  const context = useContext(PulseContext);
  if (!context) {
    throw new Error("usePulse must be used within a PulseProvider");
  }
  return context;
}
