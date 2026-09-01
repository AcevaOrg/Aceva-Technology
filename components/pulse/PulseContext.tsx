"use client";

import React, { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { PulseAction, PulseState } from "./types";

const STORAGE_KEY = "aceva-pulse-v2";

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

      const normNew = action.value.trim().toLowerCase().replace(/^(as i said|like i said|as mentioned|again|to repeat)\s*,?\s*/i, "");
      const isDuplicate = state.answers.some(
        (prev) => prev.trim().toLowerCase() === normNew || prev.trim().toLowerCase().includes(normNew)
      );

      if (isDuplicate) {
        return {
          ...state,
          context: { ...state.context, ...action.inferred },
        };
      }

      return {
        ...state,
        answers: [...state.answers, action.value],
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
        messages: [...state.messages, newMessage],
      };
    }

    case "SET_LOADING":
      return {
        ...state,
        loading: action.loading,
      };

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
      if (state.step <= 0) return state;

      const newAnswers = state.answers.slice(0, -1);
      // Remove last pulse response and last user message
      let newMessages = [...state.messages];
      if (newMessages.length >= 2) {
        newMessages = newMessages.slice(0, -2);
      } else if (newMessages.length === 1) {
        newMessages = [];
      }

      return {
        ...state,
        answers: newAnswers,
        messages: newMessages.length > 0 ? newMessages : [initialGreetingMessage],
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
}

const PulseContext = createContext<PulseContextType | undefined>(undefined);

export function PulseProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(pulseReducer, initialState);
  const isHydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        dispatch({ type: "RESTORE", session: JSON.parse(saved) });
      }
    } catch {
      // Ignore storage errors
    }
    isHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!isHydrated.current) return;
    try {
      const { stage, step, answers, context, messages, lead, id } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ stage, step, answers, context, messages, lead, id }));
    } catch {
      // Ignore storage errors
    }
  }, [state]);

  const openPulse = () => dispatch({ type: "OPEN" });
  const closePulse = () => dispatch({ type: "CLOSE" });

  const sendChatMessage = async (text: string, inferredContext?: Partial<PulseState["context"]>) => {
    dispatch({ type: "SEND_MESSAGE", text });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const historyPayload = state.messages.map((m) => ({
        role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          context: state.context,
        }),
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        dispatch({ type: "ADD_PULSE_RESPONSE", text: data.answer });
        if (data.isValid) {
          dispatch({
            type: "RECORD_VALID_ANSWER",
            value: text,
            inferred: inferredContext,
          });
          // After the 5th valid answer the discovery view keeps the final Pulse
          // response in the chat for a short pause, then advances to the
          // direction stage (timer lives in PulseMessages).
        }
      } else {
        dispatch({
          type: "ADD_PULSE_RESPONSE",
          text: data.error || "An error occurred while communicating with Pulse.",
        });
      }
    } catch {
      dispatch({
        type: "ADD_PULSE_RESPONSE",
        text: "Unable to connect to Pulse server. Please check your connection and try again.",
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  return (
    <PulseContext.Provider value={{ state, dispatch, openPulse, closePulse, sendChatMessage }}>
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
