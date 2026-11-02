import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

import { POST } from "@/app/api/chat/route";
import { buildChatRequestBody, initialState, pulseReducer } from "@/components/pulse/PulseContext";
import { inferContextForAnswer } from "@/components/pulse/PulseMessages";
import type { PulseState } from "@/components/pulse/types";
import { coveredDiscoverySteps, MAX_DISCOVERY_REASKS } from "@/lib/pulse/discoveryCoverage";
import { DISCOVERY_STEP_COUNT, getDiscoveryQuestion } from "@/lib/pulse/discoverySteps";

/**
 * Drives whole discoveries through the real reducer, request builder and chat
 * route, with only the model mocked. Each scenario is a scripted visitor; the
 * harness sends their next line whenever Pulse is waiting for an answer, the
 * same way PulseMessages and sendChatMessage do.
 */

interface Turn {
  step: number;
  message: string;
  isValid: boolean;
  nextStep?: number;
  reasked?: boolean;
  options: Record<string, unknown>;
}

async function runDiscovery(script: string[]) {
  let state: PulseState = { ...initialState, open: true, stage: "intent" };
  const turns: Turn[] = [];

  for (const [index, message] of script.entries()) {
    if (state.stage === "discovery" && state.step >= DISCOVERY_STEP_COUNT) break;

    // The first line is typed on the intent screen: INTENT starts discovery in
    // the same tick, so the body is built from the stale state with step 0.
    const first = index === 0;
    const before = state;
    if (first) state = pulseReducer(state, { type: "INTENT", value: "Start something new" });
    const step = first ? 0 : state.step;
    const inferred = inferContextForAnswer(message, step, before.context);
    const body = buildChatRequestBody(message, first ? before : state, inferred, first ? 0 : undefined);
    state = pulseReducer(state, { type: "SEND_MESSAGE", text: message });

    mockGeneratePulseCompletion.mockClear();
    const response = await POST(
      new Request("https://example.com/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
        body: JSON.stringify(body),
      })
    );
    const data = await response.json();
    const options = (mockGeneratePulseCompletion.mock.calls[0]?.[4] ?? {}) as Record<string, unknown>;

    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: data.answer });
    if (data.isValid) {
      state = pulseReducer(state, {
        type: "RECORD_VALID_ANSWER",
        value: message,
        inferred,
        nextStep: data.nextStep,
        covered: coveredDiscoverySteps(message),
      });
    } else if (data.reasked) {
      state = pulseReducer(state, { type: "RECORD_REASK" });
    }

    turns.push({ step, message, isValid: data.isValid, nextStep: data.nextStep, reasked: data.reasked, options });
  }

  /** Discovery questions the visitor answered or was re-asked; their own questions are not counted. */
  const asked = turns.filter((turn) => !turn.message.trim().endsWith("?"));
  const perStep = new Map<number, number>();
  for (const turn of asked) perStep.set(turn.step, (perStep.get(turn.step) ?? 0) + 1);

  return { state, turns, asked: asked.length, perStep, finished: state.step >= DISCOVERY_STEP_COUNT };
}

function expectWithinLimits(result: Awaited<ReturnType<typeof runDiscovery>>) {
  expect(result.finished).toBe(true);
  expect(result.asked).toBeLessThanOrEqual(6);
  expect(result.state.reasks ?? 0).toBeLessThanOrEqual(MAX_DISCOVERY_REASKS);
  for (const count of result.perStep.values()) expect(count).toBeLessThanOrEqual(2);
}

describe("discovery: at most six questions, nothing asked twice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue({ answer: "Noted.", isFallback: false });
  });

  it("restaurant that says everything at once: one question, then the closing statement", async () => {
    const result = await runDiscovery([
      "We run two restaurants in Lahore. Orders over WhatsApp are chaotic and we lose orders. We want customers to be able to order online, launch in 6 weeks, budget around $8k.",
    ]);
    expectWithinLimits(result);
    expect(result.asked).toBe(1);
    expect(result.turns[0].options.closingStatement).toBe(true);
    expect(result.state.context.scale).toMatch(/two restaurants/i);
    expect(result.state.context.timeline).toBeTruthy();
  });

  it("clinic answering one question at a time: exactly five", async () => {
    const result = await runDiscovery([
      "We run a dental clinic in Karachi",
      "Patients call to book and we miss calls when the front desk is busy",
      "Two dentists and about 40 patients a day",
      "Patients can book online and get reminders",
      "Within 2 months, budget to be discussed with the team",
    ]);
    expectWithinLimits(result);
    expect(result.asked).toBe(5);
    expect(result.state.reasks ?? 0).toBe(0);
  });

  it("logistics with scale and friction in the first answer: those steps are skipped", async () => {
    const result = await runDiscovery([
      "We are a courier company with 12 drivers and parcels get lost because tracking is on paper",
      "Customers should be able to track parcels live",
      "ASAP, around $15k",
    ]);
    expectWithinLimits(result);
    expect(result.asked).toBe(3);
    expect(result.turns.map((turn) => turn.step)).toEqual([0, 3, 4]);
    // The reply to the first answer asks the next open question, not a narrower friction question.
    expect(result.turns[0].options.nextQuestion).toBe(getDiscoveryQuestion(3));
  });

  it("visitor who will not give a budget: re-asked once, then accepted", async () => {
    const result = await runDiscovery([
      "We run an online clothing store",
      "Checkout is slow and customers abandon carts",
      "Around 200 orders a week and 4 staff",
      "Customers should be able to pay in one tap",
      "Within 3 months",
      "Within 3 months, that's all I can say",
    ]);
    expectWithinLimits(result);
    expect(result.asked).toBe(6);
    expect(result.turns[4]).toMatchObject({ step: 4, isValid: false, reasked: true });
    expect(result.turns[4].options.reask).toBe(true);
    expect(result.turns[5]).toMatchObject({ step: 4, isValid: true });
  });

  it("visitor who repeats an earlier answer: one clarification, then discovery moves on", async () => {
    const result = await runDiscovery([
      "We need a mobile app for our gym members",
      "As I said, we need a mobile app for our gym members",
      "As I said, we need a mobile app for our gym members",
      "About 300 members and 6 trainers",
      "Members can book classes from their phone",
      // The clarification is spent, so a timeline-only answer is accepted rather than re-asked.
      "Within 3 months",
    ]);
    expectWithinLimits(result);
    expect(result.turns[1]).toMatchObject({ step: 1, isValid: false, reasked: true });
    expect(result.turns[2]).toMatchObject({ step: 1, isValid: true });
    expect(result.turns[5]).toMatchObject({ step: 4, isValid: true });
  });

  it("a question of the visitor's own is answered without spending the clarification", async () => {
    const result = await runDiscovery([
      "We are building a SaaS tool for property managers",
      "How much does a project like this usually cost?",
      "Tenants report maintenance issues by email and requests get lost",
      "About 50 properties and 3 managers",
      "Managers should be able to see every open request in one dashboard",
      "Launch in Q2, budget is flexible",
    ]);
    expectWithinLimits(result);
    expect(result.turns[1]).toMatchObject({ step: 1, isValid: false });
    expect(result.turns[1].reasked).toBeUndefined();
    expect(result.state.reasks ?? 0).toBe(0);
  });

  it("keeps the industry's guessed friction and goals away from the model until asked", async () => {
    const result = await runDiscovery(["We run a small hotel by the beach"]);
    const context = result.turns[0].options;
    const sent = mockGeneratePulseCompletion.mock.calls[0][2] as Record<string, unknown>;
    expect(context.nextQuestion).toBe(getDiscoveryQuestion(1));
    expect(sent.industry).toBe("Hotels & Hospitality");
    expect(sent.friction).toBeUndefined();
    expect(sent.goals).toBeUndefined();
  });
});
