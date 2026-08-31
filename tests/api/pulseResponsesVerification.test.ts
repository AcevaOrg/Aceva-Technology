import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock generatePulseCompletion
const mockGeneratePulseCompletion = vi.fn();
vi.mock("@/lib/pulse/llm", () => ({
  generatePulseCompletion: (...args: unknown[]) => mockGeneratePulseCompletion(...args),
}));

import { POST } from "@/app/api/chat/route";

function createChatRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": crypto.randomUUID(),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Pulse Response Quality, Tone, & Accuracy Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGeneratePulseCompletion.mockResolvedValue(
      "That sounds like a great project. What are the key features and target audience for your application?"
    );
  });

  it("1. Greetings & Casual Check-ins: Provides polite, natural greeting and invites project discovery (isValid: false)", async () => {
    for (const msg of ["Hi", "Hello", "How are you doing?", "Good morning"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/hello|doing great|welcome|build/i);
    }
  });

  it("2. Company FAQ & Capabilities: Provides clear, professional description of ACEVA's services (isValid: false)", async () => {
    for (const msg of ["What does ACEVA do?", "Where is ACEVA located?", "What is ACEVA Technologies?"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toContain("ACEVA Technologies is a digital engineering agency");
      expect(data.answer).toMatch(/web platforms|mobile apps|software systems/i);
    }
  });

  it("3. General Tech Trivia: Acknowledges topic politely and redirects back to project discovery (isValid: false)", async () => {
    const triviaQuestions = [
      "What is the difference between Java and Python?",
      "Why was Ruby popular in the 2010s?",
      "Why is Python popular?",
    ];
    for (const msg of triviaQuestions) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/interesting|specifically designed|software project/i);
    }
  });

  it("4. General Knowledge & Math: Polite rejection returning to project discovery (isValid: false)", async () => {
    for (const msg of ["What is the capital of France?", "Calculate 25*25", "How deep is the ocean?"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toMatch(/specifically designed|software project|build/i);
    }
  });

  it("5. Nonsense & Gibberish: Natural, non-punitive clarification request (isValid: false)", async () => {
    for (const msg of ["hdgjsabdasvjvdahs", "asdfghjkl", "qazxswedc"]) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toContain("I didn't quite catch that.");
      expect(data.answer).toContain("project description or specific question");
    }
  });

  it("6. Explicit Single Requirement: Returns isValid: true and engages in technical discovery", async () => {
    const response = await POST(createChatRequest({ message: "I want to build a mobile app for my restaurant." }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
    expect(data.answer).toBeTruthy();
    expect(mockGeneratePulseCompletion).toHaveBeenCalled();
  });

  it("7. Mixed Intent Input: Returns isValid: true and extracts valid project info", async () => {
    const response = await POST(
      createChatRequest({ message: "Hi, I need a mobile app for my restaurant. Also, how does Python work?" })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
    expect(mockGeneratePulseCompletion).toHaveBeenCalled();
  });

  it("8. Direct Negotiation / Answer Preference: Returns isValid: true for direct team alignment answers", async () => {
    const response = await POST(
      createChatRequest({ message: "I will discuss budget with the ACEVA team directly" })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.isValid).toBe(true);
  });

  it("9. Assistant Identity & Persona Queries: Identifies strictly as 'Aceva Pulse' and NOT 'Pulse Ai Assistant' (isValid: false)", async () => {
    const identityQueries = [
      "Who are you?",
      "What is your name?",
      "Who am I talking to?",
      "Are you Pulse?",
      "What should I call you?",
      "Tell me about yourself.",
      "Are you an AI assistant?",
    ];
    for (const msg of identityQueries) {
      const response = await POST(createChatRequest({ message: msg }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isValid).toBe(false);
      expect(data.answer).toContain("Aceva Pulse");
      expect(data.answer).not.toMatch(/Pulse Ai Assistant|Pulse AI Assistant|Pulse Ai|Pulse AI/i);
    }
  });

  it("10. Multi-Turn Sequential Validation: Invalid message following a valid answer does NOT bypass validation", async () => {
    // 1. Valid first message
    const res1 = await POST(createChatRequest({ message: "I want an app." }));
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.isValid).toBe(true);

    const history = [
      { role: "user", content: "I want an app." },
      { role: "assistant", content: data1.answer },
    ];
    const context = { intent: "Start something new" };

    // 2. Subsequent invalid message (gibberish/unrelated) MUST NOT bypass validation
    const res2 = await POST(createChatRequest({ message: "asdfklisadfi", history, context }));
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.isValid).toBe(false);

    // 3. Subsequent valid message continues flow cleanly
    const res3 = await POST(createChatRequest({ message: "I need online ordering.", history, context }));
    expect(res3.status).toBe(200);
    const data3 = await res3.json();
    expect(data3.isValid).toBe(true);
  });

  it("11. Chunk 3/5 Validation Fix Verification: Invalid inputs return isValid: false while valid project info returns isValid: true", async () => {
    const invalidInputs = [
      // Gibberish
      "asdfklisadfi",
      "hdgjsabdasvjvdahs",
      "qwepoiuyasd",
      "zxcmnbvcx",
      "jshdfkjshdf",
      "qweqweqwe",
      // Nonsense
      "what when it does not where",
      "who are you you",
      "why what then",
      "how which what",
      // Random / Invalid
      "123456789",
      "!!!???",
      "@#$%^&*",
      "abcxyz123",
      // Greetings
      "hi",
      "hello",
      "hey",
      "hyy",
      "hyyyyyy",
      "helo",
      "helloooo",
      "salam",
      "assalamualaikum",
      // Irrelevant / Trivia / FAQs
      "What is Python?",
      "How does Java work?",
      "What does ACEVA do?",
      "What is SEVA?",
      "What is Pulse?",
    ];

    const history = [
      { role: "user", content: "I want an app." },
      { role: "assistant", content: "Great! Tell us about your business or project." },
    ];
    const context = { intent: "Start something new" };

    for (const msg of invalidInputs) {
      // Test both standalone and multi-turn context
      const resStandalone = await POST(createChatRequest({ message: msg }));
      expect(resStandalone.status).toBe(200);
      const dataStandalone = await resStandalone.json();
      expect(dataStandalone.isValid, `Standalone input '${msg}' should have isValid: false`).toBe(false);

      const resMultiTurn = await POST(createChatRequest({ message: msg, history, context }));
      expect(resMultiTurn.status).toBe(200);
      const dataMultiTurn = await resMultiTurn.json();
      expect(dataMultiTurn.isValid, `Multi-turn input '${msg}' should have isValid: false`).toBe(false);
    }

    const validProjectInputs = [
      "I want an app.",
      "I want a website.",
      "I need a mobile app for my restaurant.",
      "We need online ordering.",
      "Our current process uses WhatsApp.",
    ];

    for (const msg of validProjectInputs) {
      const res = await POST(createChatRequest({ message: msg }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isValid).toBe(true);
    }
  });

  it("12. Chunk 4/5 Specific Tests 1-9 & Progression Across Questions 1, 2, 3, 4, and 5", async () => {
    // TEST 1
    const t1_res1 = await POST(createChatRequest({ message: "I want an app." }));
    expect((await t1_res1.json()).isValid).toBe(true);
    const t1_hist1 = [
      { role: "user", content: "I want an app." },
      { role: "assistant", content: "Tell us about your business or project." },
    ];
    const t1_ctx1 = { intent: "Start something new" };
    const t1_res2 = await POST(createChatRequest({ message: "asdfklisadfi", history: t1_hist1, context: t1_ctx1 }));
    expect((await t1_res2.json()).isValid).toBe(false);

    // TEST 2
    const t2_res1 = await POST(createChatRequest({ message: "I want a website." }));
    expect((await t2_res1.json()).isValid).toBe(true);
    const t2_res2 = await POST(createChatRequest({ message: "hyyyyyyyy", history: t1_hist1, context: t1_ctx1 }));
    expect((await t2_res2.json()).isValid).toBe(false);
    const t2_res3 = await POST(createChatRequest({ message: "heelooo", history: t1_hist1, context: t1_ctx1 }));
    expect((await t2_res3.json()).isValid).toBe(false);

    // TEST 3
    const t3_res1 = await POST(createChatRequest({ message: "I want an app." }));
    expect((await t3_res1.json()).isValid).toBe(true);
    const t3_res2 = await POST(createChatRequest({ message: "qweqweqwe", history: t1_hist1, context: t1_ctx1 }));
    expect((await t3_res2.json()).isValid).toBe(false);

    // TEST 4
    const t4_res1 = await POST(createChatRequest({ message: "I want an app." }));
    expect((await t4_res1.json()).isValid).toBe(true);
    const t4_res2 = await POST(createChatRequest({ message: "What does ACEVA do?", history: t1_hist1, context: t1_ctx1 }));
    expect((await t4_res2.json()).isValid).toBe(false);

    // TEST 5
    const t5_res1 = await POST(createChatRequest({ message: "I want an app." }));
    expect((await t5_res1.json()).isValid).toBe(true);
    const t5_res2 = await POST(createChatRequest({ message: "I need online ordering.", history: t1_hist1, context: t1_ctx1 }));
    expect((await t5_res2.json()).isValid).toBe(true);

    // TEST 6: Budget asked + Gibberish
    const budgetHistory = [
      { role: "user", content: "I need a restaurant app." },
      { role: "assistant", content: "What is your budget?" },
    ];
    const budgetContext = { intent: "Start something new", industry: "Restaurant" };
    const t6_res = await POST(createChatRequest({ message: "asdfklisadfi", history: budgetHistory, context: budgetContext }));
    expect((await t6_res.json()).isValid).toBe(false);

    // TEST 7: Budget asked + Timeline
    const t7_res = await POST(createChatRequest({ message: "As soon as possible.", history: budgetHistory, context: budgetContext }));
    expect((await t7_res.json()).isValid).toBe(false);

    // TEST 8: Budget asked + Monetary
    const t8_res = await POST(createChatRequest({ message: "$5,000", history: budgetHistory, context: budgetContext }));
    expect((await t8_res.json()).isValid).toBe(true);

    // TEST 9: Timeline asked + Timeline
    const timelineHistory = [
      { role: "user", content: "I need a restaurant app." },
      { role: "assistant", content: "What is your timeline?" },
    ];
    const t9_res = await POST(createChatRequest({ message: "As soon as possible.", history: timelineHistory, context: budgetContext }));
    expect((await t9_res.json()).isValid).toBe(true);

    // Multi-Question Step Progression: Verification across Questions 1, 2, 3, 4, and 5
    const multiStepHistory: { role: "user" | "assistant"; content: string }[] = [];
    const multiStepContext: Record<string, unknown> = { intent: "Start something new" };

    const stepQuestions = [
      { question: "Tell us about your business or industry.", answer: "I need a mobile app for my restaurant." }, // Q1
      { question: "Where do things feel slow or manual friction today?", answer: "Taking orders over WhatsApp is chaotic." }, // Q2
      { question: "What does your operation look like today?", answer: "2 locations with 300 orders per day." }, // Q3
      { question: "What goals or capabilities matter most to you?", answer: "We want direct online ordering and centralized kitchen display." }, // Q4
      { question: "What is your target timeline and budget window?", answer: "$5,000 budget and launch in 4 weeks." }, // Q5
    ];

    for (let stepIdx = 0; stepIdx < stepQuestions.length; stepIdx++) {
      const stepSpec = stepQuestions[stepIdx];
      multiStepHistory.push({ role: "assistant", content: stepSpec.question });

      // 1. Verify invalid input at current step MUST return isValid: false
      const invRes = await POST(
        createChatRequest({
          message: "asdfklisadfi",
          history: multiStepHistory,
          context: multiStepContext,
        })
      );
      expect((await invRes.json()).isValid, `Gibberish at Question Step ${stepIdx + 1} (${stepSpec.question}) must return isValid: false`).toBe(false);

      // 2. Submit valid answer for current step
      const valRes = await POST(
        createChatRequest({
          message: stepSpec.answer,
          history: multiStepHistory,
          context: multiStepContext,
        })
      );
      const valData = await valRes.json();
      expect(valData.isValid, `Valid answer at Question Step ${stepIdx + 1} (${stepSpec.answer}) must return isValid: true`).toBe(true);

      // Update history and context for subsequent step
      multiStepHistory.push({ role: "user", content: stepSpec.answer });
      if (stepIdx === 0) multiStepContext.industry = "Restaurant";
      if (stepIdx === 1) multiStepContext.friction = "WhatsApp chaos";
      if (stepIdx === 2) multiStepContext.scale = "2 locations";
      if (stepIdx === 3) multiStepContext.goals = "Online ordering";
      if (stepIdx === 4) {
        multiStepContext.budget = "$5,000";
        multiStepContext.timeline = "4 weeks";
      }
    }
  });
});
