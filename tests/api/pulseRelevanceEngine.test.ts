import { describe, expect, it, vi } from "vitest";
import {
  isProjectDiscoveryInput,
  isGreetingInput,
  isGibberishInput,
  isInvalidOrUnclearInput,
  isQuestionInScope,
  getCasualOrFAQResponse,
} from "@/lib/pulse/scope";

// isQuestionInScope falls through to a vector similarity check, which would
// otherwise reach the live embeddings API. Null is the documented "API
// unavailable" path, so scoring degrades to keywords and stays offline.
vi.mock("@/lib/pulse/embeddings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pulse/embeddings")>()),
  generateEmbedding: async () => null,
}));

describe("Pulse — Comprehensive Relevance & Intent Validation Engine Suite", () => {
  describe("1. Stretched & Misspelled Greetings (MUST BE INVALID / 0 PROGRESS)", () => {
    const greetings = [
      "hi",
      "hello",
      "hey",
      "hiya",
      "hii",
      "hiii",
      "hiiii",
      "hyyyy",
      "hyyyyy",
      "hyyyyyyyy",
      "heyyy",
      "heyyyy",
      "hellooo",
      "helloooo",
      "helo",
      "heloo",
      "helllo",
      "hallo",
      "halo",
      "haloo",
      "hy",
      "hyy",
      "hyyy",
      "salam",
      "salaam",
      "salaam alaikum",
      "assalamualaikum",
      "assalamu alaikum",
      "asalam o alaikum",
      "assalam o alaikum",
      "salam alaikum",
      "aoa",
      "aoaaaa",
      "salaaaammm",
      "heyyyyyyyyyyyyyyyyy",
      "hellooooo broooo",
    ];

    greetings.forEach((greeting) => {
      it(`recognizes greeting intent for '${greeting}'`, () => {
        expect(isGreetingInput(greeting)).toBe(true);
        expect(isProjectDiscoveryInput(greeting)).toBe(false);
      });
    });
  });

  describe("2. Greeting + Relevant Project Information (MUST BE VALID)", () => {
    it("extracts project requirement from 'Hyyyyy, I want to build a mobile app for my restaurant.'", () => {
      const msg = "Hyyyyy, I want to build a mobile app for my restaurant.";
      expect(isProjectDiscoveryInput(msg)).toBe(true);
    });

    it("extracts project requirement from 'Assalamualaikum, I need a website for my business.'", () => {
      const msg = "Assalamualaikum, I need a website for my business.";
      expect(isProjectDiscoveryInput(msg)).toBe(true);
    });
  });

  describe("3. Gibberish & Keyboard Smashing (MUST BE INVALID)", () => {
    const gibberishSamples = [
      "hdgjsabdasvjvdahs",
      "asdfghjkl",
      "qwepoiuyasd",
      "zxcmnbvcx",
      "jshdfkjshdf",
      "xczvbnmqwer",
      "qweqweqwe",
      "zzxxccvvbb",
      "mnbvcxz",
      "qazwsxedcrf",
      "123456789",
      "000000000",
      "!!! ???",
      "@#$%^&*",
      "abc123xyz",
      "asdkjhasdkjh",
      "qwertyuiopasdf",
      "lkjhgfdsa",
    ];

    gibberishSamples.forEach((sample) => {
      it(`detects gibberish/nonsense for '${sample}'`, () => {
        expect(isGibberishInput(sample)).toBe(true);
        expect(isProjectDiscoveryInput(sample)).toBe(false);
      });
    });
  });

  describe("4. Meaningless / Incoherent Questions (MUST BE INVALID)", () => {
    const incoherentQuestions = [
      "Who are you, you?",
      "Why what then?",
      "How which is that?",
      "Where why you?",
      "What what is who?",
      "Does why happen which?",
      "When how what?",
      "Which who then why?",
      "Can where be how?",
      "What is you are?",
    ];

    incoherentQuestions.forEach((q) => {
      it(`classifies incoherent question '${q}' as invalid`, () => {
        expect(isProjectDiscoveryInput(q)).toBe(false);
      });
    });
  });

  describe("5. Completely Irrelevant General Knowledge Questions (MUST BE INVALID)", () => {
    const irrelevantQuestions = [
      "What is the difference between Java and Python?",
      "Why was Ruby popular?",
      "How does the human brain work?",
      "Who invented the telephone?",
      "What is quantum computing?",
      "How do airplanes fly?",
      "Why is the sky blue?",
      "Which football team is the best?",
      "What happened in the news today?",
      "How does Bitcoin work?",
    ];

    irrelevantQuestions.forEach((q) => {
      it(`classifies irrelevant question '${q}' as invalid for discovery progress`, () => {
        expect(isProjectDiscoveryInput(q)).toBe(false);
      });
    });
  });

  describe("6. ACEVA / SEVA / Pulse Questions (MUST BE INVALID FOR PROGRESS)", () => {
    const companyQuestions = [
      "What does ACEVA do?",
      "What is ACEVA Technology?",
      "How does ACEVA work?",
      "Who works at ACEVA?",
      "Who leads ACEVA?",
      "What technologies does ACEVA use?",
      "What is SEVA?",
      "What does SEVA do?",
      "How does SEVA work?",
      "What is Pulse?",
      "How does Pulse work?",
      "Who created Pulse?",
      "Why does Pulse ask questions?",
    ];

    companyQuestions.forEach((q) => {
      it(`classifies company inquiry '${q}' as invalid for discovery progress`, () => {
        expect(isProjectDiscoveryInput(q)).toBe(false);
      });
    });
  });

  describe("7. Legitimate Project Discovery Inputs (MUST REMAIN VALID)", () => {
    const validInputs = [
      "I need a mobile app for my restaurant.",
      "We want customers to book appointments online.",
      "Our current process is handled through WhatsApp.",
      "It's difficult to keep track of our orders.",
      "The budget will be decided after talking to the team.",
      "The project should be completed as soon as possible.",
    ];

    validInputs.forEach((input) => {
      it(`accepts legitimate project input '${input}'`, () => {
        expect(isProjectDiscoveryInput(input)).toBe(true);
      });
    });
  });

  describe("8. Industry Vocabulary That Is Not A Recipe Or A Maths Problem (MUST REMAIN VALID)", () => {
    // The recipe pattern's trailing group was optional, so it reduced to "a
    // food word followed by a space" and matched the vocabulary of the industry
    // this product uses as its own worked example. The first entry below is
    // verbatim the placeholder Pulse shows under discovery step 4, so a visitor
    // who typed what they were shown was told to ask something relevant. The
    // maths pattern had the same flaw: "solve|calculate|compute|convert"
    // followed by a space was enough, which caught the intent menu's own
    // "I want to solve a business problem."
    const validInputs = [
      "Customers can order online directly, and kitchen staff see orders on one simple screen",
      "We are a coffee shop and need an ordering site",
      "Our pizza place needs online ordering",
      "Staff bake fresh bread each morning and log it by hand",
      "Our chefs cook the food fresh every day",
      "We brew the coffee fresh each morning",
      "The app should calculate delivery fees automatically",
      "The app should calculate delivery fees for 2-3 locations",
      "We want to convert more visitors into paying customers",
      "I want to solve a business problem.",
    ];

    validInputs.forEach((input) => {
      it(`accepts industry wording '${input.slice(0, 48)}'`, () => {
        expect(isProjectDiscoveryInput(input)).toBe(true);
      });
    });

    const stillInvalid = [
      "Calculate 25*25",
      "What is the recipe for carbonara?",
      "How do I bake a chocolate cake?",
      "Tell me a recipe",
      "convert 5 kilograms to pounds",
      "Solve x + 2 = 5",
      "Explain the pythagorean theorem",
    ];

    stillInvalid.forEach((input) => {
      it(`still rejects '${input}'`, () => {
        expect(isProjectDiscoveryInput(input)).toBe(false);
        expect(isInvalidOrUnclearInput(input)).toBe(true);
      });
    });
  });

  describe("9. Mixed Project Intent With An Off-Topic Aside (MUST REMAIN VALID AND IN SCOPE)", () => {
    const mixed = "Hi, I need a mobile app for my restaurant. Also, how does Python work?";

    it("keeps the requirement rather than letting the aside veto it", async () => {
      expect(isProjectDiscoveryInput(mixed)).toBe(true);
      // Both the scope check and llm.ts used to reject this outright on the
      // general-programming pattern, throwing the requirement away, even though
      // /api/chat deliberately let it past its own copy of that gate.
      await expect(isQuestionInScope(mixed)).resolves.toBe(true);
    });

    it("still rejects an aside with no requirement attached", async () => {
      for (const q of ["How does Python work?", "What is the capital of France?"]) {
        expect(isInvalidOrUnclearInput(q)).toBe(true);
        await expect(isQuestionInScope(q)).resolves.toBe(false);
      }
    });
  });

  describe("12. Follow-Up Questions Inside An Active Conversation (MUST BE IN SCOPE)", () => {
    // Scope used to be decided by `isProjectDiscoveryInput` once a conversation
    // was under way — a progress classifier that rejects every question-shaped
    // message. So the moment a visitor had said anything, every natural
    // follow-up was refused in a few milliseconds without reaching retrieval.
    const history = [
      { role: "user" as const, content: "Tell me about the Angel Indian Restaurant website" },
      { role: "assistant" as const, content: "ACEVA designed and built it, delivered on 2 October 2026." },
    ];
    const context = { intent: "Start something new" };

    const followUps = [
      "How long did that one take?",
      "Who hosts it?",
      "What did the SEO actually achieve for them?",
      "How much would something like that cost me?",
      "Can you do the same for us?",
      "And what about mobile?",
    ];

    followUps.forEach((q) => {
      it(`keeps the follow-up '${q}' in scope`, async () => {
        await expect(isQuestionInScope(q, history, context)).resolves.toBe(true);
      });
    });

    it("still refuses noise and off-topic questions mid-conversation", async () => {
      for (const q of [
        "What is the capital of France?",
        "How do I bake a chocolate cake?",
        "Who won the cricket world cup?",
        "What is the difference between Java and Python?",
        "asdfghjkl",
        "Hi",
      ]) {
        await expect(isQuestionInScope(q, history, context), q).resolves.toBe(false);
      }
    });
  });

  describe("13. Questions About ACEVA Must Not Advance Progress", () => {
    // `hasExplicitProjectIntent` returns early on a bare "build", and on a
    // platform word sitting beside an industry word. That made three portfolio
    // and capability questions count as discovery answers, moving the progress
    // bar while the visitor was only reading about past work.
    const notDiscovery = [
      "Can you build a mobile app for iOS and Android?",
      "What did you build for Angel Indian Restaurant?",
      "Tell me about the Angel Indian Restaurant website",
      "Do you build websites for restaurants?",
      "Have you built an ordering system before?",
      "What platforms do you build for?",
    ];

    notDiscovery.forEach((q) => {
      it(`does not count '${q}' as a discovery answer`, () => {
        expect(isProjectDiscoveryInput(q)).toBe(false);
      });
    });

    it("still counts a visitor describing their own requirement, even as a question", () => {
      // The veto lifts on a first-person reference to their own business, which
      // is what separates "can you build X" from "can you build X for us".
      for (const q of [
        "Can you build me an ordering app for my restaurant?",
        "Could you build a booking system for our clinic?",
        "I need a mobile app for my restaurant",
        "We want customers to book appointments online.",
        "Hyyyyy, I want to build a mobile app for my restaurant.",
      ]) {
        expect(isProjectDiscoveryInput(q), q).toBe(true);
      }
    });
  });

  describe("11. The Company Name Pulse Says Out Loud", () => {
    // "ACEVA Technology", singular, confirmed by the team on 11 October 2026 and
    // matching acevatech.com's header, footer and copyright line. This canned
    // description is where the wrong name shipped once: it said "ACEVA
    // Technologies", the only place in the product that did.
    const triggers = ["What is aceva?", "Tell me about aceva", "Who created aceva?", "Why do you need aceva?"];

    triggers.forEach((q) => {
      it(`names the company correctly for '${q}'`, () => {
        const reply = getCasualOrFAQResponse(q);

        expect(reply).toBeTruthy();
        expect(reply).toContain("ACEVA Technology");
        expect(reply).not.toContain("ACEVA Technologies");
      });
    });

    it("uses one identity wording for Pulse itself", () => {
      // Three different self-descriptions used to be in rotation here, one of
      // which called Pulse an "AI System Architect".
      for (const q of ["Who are you?", "How are you?", "Hi", "Who is Shiva?"]) {
        const reply = getCasualOrFAQResponse(q);
        if (!reply || !/Aceva Pulse/.test(reply)) continue;
        expect(reply).toContain("ACEVA's AI assistant");
        expect(reply).not.toMatch(/System Architect/i);
      }
    });
  });

  describe("10. Questions About ACEVA's Client Work (MUST BE IN SCOPE)", () => {
    // knowledge/client-projects.md documents the two publicly credited client
    // sites, so these are now answerable and must reach retrieval.
    //
    // Only scope is asserted here. Whether a given phrasing also advances the
    // progress bar is decided by `isProjectDiscoveryInput`'s explicit-intent
    // regex, which matches a bare "build" and a "website" beside an industry
    // word — so "What did you build for chefamritpalsingh.com?" reads as
    // discovery input even though it asks about past work. That is pre-existing
    // and orthogonal to client-project retrieval; pinning it here would assert
    // behaviour this file is not responsible for.
    const projectQuestions = [
      "Do you have a portfolio?",
      "Can I see examples of your work?",
      "Do you have any case studies?",
      "Have you built any real client websites?",
      "Tell me about the Angel Indian Restaurant website",
      "Who is Amrit?",
      "What did you build for chefamritpalsingh.com?",
    ];

    projectQuestions.forEach((q) => {
      it(`keeps '${q}' in scope`, async () => {
        await expect(isQuestionInScope(q)).resolves.toBe(true);
      });
    });

    it("still rejects person and sports trivia", async () => {
      // "Who is Amrit?" works because the who-trivia pattern now requires a
      // subject; it used to reduce to "who" plus a verb and reject every
      // "Who is …" question. These must stay out.
      for (const q of [
        "Who won the cricket world cup?",
        "Who painted the Mona Lisa?",
        "Who invented the telephone?",
        "Who is Shiva?",
      ]) {
        await expect(isQuestionInScope(q)).resolves.toBe(false);
        expect(isProjectDiscoveryInput(q)).toBe(false);
      }
    });
  });
});
