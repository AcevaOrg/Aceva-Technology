import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/chat/route";
import { buildChatRequestBody, initialState, pulseReducer } from "@/components/pulse/PulseContext";
import { inferContextForAnswer } from "@/components/pulse/PulseMessages";
import type { PulseState } from "@/components/pulse/types";
import { coveredDiscoverySteps } from "@/lib/pulse/discoveryCoverage";
import { DISCOVERY_STEP_COUNT, getDiscoveryQuestion } from "@/lib/pulse/discoverySteps";
import { generatePulseCompletion } from "@/lib/pulse/llm";

/**
 * Live discovery evaluation: whole wizard runs through the real chat route and
 * the real model. tests/api/pulseDiscoveryFlow.test.ts proves the step logic
 * offline; this checks what the model actually says on each turn — one question
 * at most, none on the closing turn, and no second question about a step that
 * was just answered.
 *
 * Costs one chat completion and one embedding per turn (about 25 turns). The
 * transcripts are written to PULSE_DISCOVERY_LOG (default: the OS temp dir) for
 * reading by eye. Run with `npm run test:eval`.
 */

const probe = await generatePulseCompletion("What services does ACEVA offer?", undefined, undefined, "discovery-probe");
const live = probe.isFallback === false && probe.answer.length > 0;
if (!live) console.warn("[discovery-eval] SKIPPED: no live model (needs OPENAI_API_KEY and network).");

const LOG = process.env.PULSE_DISCOVERY_LOG || path.join(os.tmpdir(), "pulse-discovery-eval.json");

interface Turn {
  step: number;
  heading: string | undefined;
  visitor: string;
  pulse: string;
  isValid: boolean;
  nextStep?: number;
  reasked?: boolean;
}

/** Topic words for each step's question, used to spot a reply that probes a step already closed. */
const STEP_TOPIC: Record<number, RegExp> = {
  1: /\b(slow|manual|friction|bottleneck|pain|frustrat\w*|time-consuming)\b/i,
  2: /\b(team size|how many|locations?|staff|scale|volume|per day|per week)\b/i,
  3: /\b(success|goal|outcome|look like|matter most)\b/i,
  4: /\b(timeline|budget|launch|when)\b/i,
};

async function runDiscovery(script: string[]): Promise<{ turns: Turn[]; finished: boolean }> {
  let state: PulseState = { ...initialState, open: true, stage: "intent" };
  const turns: Turn[] = [];

  for (const [index, visitor] of script.entries()) {
    if (state.stage === "discovery" && state.step >= DISCOVERY_STEP_COUNT) break;
    const first = index === 0;
    const before = state;
    if (first) state = pulseReducer(state, { type: "INTENT", value: "Start something new" });
    const step = first ? 0 : state.step;
    const inferred = inferContextForAnswer(visitor, step, before.context);
    const body = buildChatRequestBody(visitor, first ? before : state, inferred, first ? 0 : undefined);
    state = pulseReducer(state, { type: "SEND_MESSAGE", text: visitor });

    const response = await POST(
      new Request("https://example.com/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": crypto.randomUUID() },
        body: JSON.stringify(body),
      })
    );
    const data = await response.json();
    state = pulseReducer(state, { type: "ADD_PULSE_RESPONSE", text: data.answer });
    if (data.isValid) {
      state = pulseReducer(state, {
        type: "RECORD_VALID_ANSWER",
        value: visitor,
        inferred,
        nextStep: data.nextStep,
        covered: coveredDiscoverySteps(visitor),
      });
    } else if (data.reasked) {
      state = pulseReducer(state, { type: "RECORD_REASK" });
    }
    turns.push({
      step,
      heading: getDiscoveryQuestion(step),
      visitor,
      pulse: data.answer,
      isValid: data.isValid,
      nextStep: data.nextStep,
      reasked: data.reasked,
    });
  }
  return { turns, finished: state.step >= DISCOVERY_STEP_COUNT };
}

const SCENARIOS: Record<string, string[]> = {
  "non-technical restaurant owner, everything at once": [
    "We run two restaurants in Lahore. Orders over WhatsApp are chaotic and we lose orders. We want customers to be able to order online, launch in 6 weeks, budget around $8k.",
  ],
  "clinic, one answer at a time": [
    "We run a dental clinic in Karachi",
    "Patients call to book and we miss calls when the front desk is busy",
    "Two dentists and about 40 patients a day",
    "Patients can book online and get reminders",
    "Within 2 months, budget to be discussed with the team",
  ],
  "technical founder, SaaS": [
    "We're building a multi-tenant B2B SaaS for property managers on Next.js and PostgreSQL",
    "Our Prisma migrations are slow and tenant isolation is done in application code, which is error-prone",
    "About 50 tenants and 3,000 monthly active users",
    "Row-level security per tenant and a REST API partners can integrate with",
    "Q2 launch, budget is flexible",
  ],
  "vague visitor who will not give a budget": [
    "We run an online clothing store",
    "Checkout is slow and customers abandon carts",
    "Around 200 orders a week and 4 staff",
    "Customers should be able to pay in one tap",
    "Within 3 months",
    "Within 3 months, that's all I can say",
  ],
  "logistics, partial details up front": [
    "We are a courier company with 12 drivers and parcels get lost because tracking is on paper",
    "Customers should be able to track parcels live",
    "ASAP, around $15k",
  ],
};

const transcripts: Record<string, Turn[]> = {};

describe.skipIf(!live)("discovery with the live model", () => {
  for (const [label, script] of Object.entries(SCENARIOS)) {
    it(label, { timeout: 180_000 }, async () => {
      const { turns, finished } = await runDiscovery(script);
      transcripts[label] = turns;
      fs.writeFileSync(LOG, JSON.stringify(transcripts, null, 2));

      expect(finished).toBe(true);
      expect(turns.length).toBeLessThanOrEqual(6);

      for (const [i, turn] of turns.entries()) {
        const questions = (turn.pulse.match(/\?/g) ?? []).length;
        expect(questions, `turn ${i + 1} asks more than one question: ${turn.pulse}`).toBeLessThanOrEqual(1);

        expect(turn.pulse, `turn ${i + 1} opens with thanks`).not.toMatch(/^\s*(thank you|thanks)\b/i);
        expect(turn.pulse, `turn ${i + 1} uses filler`).not.toMatch(/\b(seamless\w*|streamlined|could benefit from)\b/i);

        const closing = turn.isValid && turn.nextStep === DISCOVERY_STEP_COUNT;
        if (closing) expect(turn.pulse, "closing turn must not ask anything").not.toContain("?");

        // After a valid answer, the one question (if any) must not be about the step just closed.
        if (turn.isValid && !closing && turn.step > 0 && questions === 1) {
          const asked = turn.pulse.slice(turn.pulse.lastIndexOf(".", turn.pulse.indexOf("?")) + 1);
          const nextTopic = STEP_TOPIC[turn.nextStep ?? -1];
          const closedTopic = STEP_TOPIC[turn.step];
          if (closedTopic && !(nextTopic && nextTopic.test(asked))) {
            expect(closedTopic.test(asked), `turn ${i + 1} re-asks the step just answered: ${asked}`).toBe(false);
          }
        }
      }
    });
  }
});
