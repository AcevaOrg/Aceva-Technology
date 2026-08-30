import { describe, expect, it } from "vitest";
import { isProjectDiscoveryInput, isGreetingInput, isGibberishInput } from "@/lib/pulse/scope";

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
});
