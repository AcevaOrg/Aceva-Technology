import { describe, expect, it } from "vitest";
import { isProjectDiscoveryInput } from "@/lib/pulse/scope";

export const dataset = [
  {
    "id": 1,
    "category": "Science / education",
    "message": "What is evolution?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 2,
    "category": "Programming",
    "message": "What is Node.js?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 3,
    "category": "Recommendations / opinions",
    "message": "Which AI tool is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 4,
    "category": "Generated unrelated topic",
    "message": "How did electric cars develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 5,
    "category": "Generated unrelated topic",
    "message": "Are people using geography more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 6,
    "category": "Random / noise",
    "message": "hello 123 !!!",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 7,
    "category": "Generated unrelated topic",
    "message": "Is weather difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 8,
    "category": "General technology",
    "message": "What is a server?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 9,
    "category": "Generated unrelated topic",
    "message": "When did programming become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 10,
    "category": "Generated unrelated topic",
    "message": "Should I learn about photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 11,
    "category": "Generated unrelated topic",
    "message": "What are the problems with economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 12,
    "category": "Personal / casual",
    "message": "What's your favorite color?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 13,
    "category": "News / current events",
    "message": "What is the latest AI news?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 14,
    "category": "General knowledge",
    "message": "When was the first computer built?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 15,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 16,
    "category": "Generated unrelated topic",
    "message": "Where did football originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 17,
    "category": "Generated unrelated topic",
    "message": "What is universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 18,
    "category": "Generated unrelated topic",
    "message": "Where did cryptocurrency originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 19,
    "category": "Generated unrelated topic",
    "message": "When did robotics become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 20,
    "category": "Programming",
    "message": "Can Python replace Java?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 21,
    "category": "General knowledge",
    "message": "Why is the sky blue?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 22,
    "category": "Generated unrelated topic",
    "message": "When did laptops become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 23,
    "category": "Generated unrelated topic",
    "message": "Is cricket difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 24,
    "category": "Mixed intent",
    "message": "Budget is around $10,000. Who invented Python?",
    "classification": "partial",
    "progressBehavior": "Count budget information only."
  },
  {
    "id": 25,
    "category": "Generated unrelated topic",
    "message": "When did medicine become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 26,
    "category": "Generated unrelated topic",
    "message": "Do people like history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 27,
    "category": "Generated unrelated topic",
    "message": "Do people like electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 28,
    "category": "Generated unrelated topic",
    "message": "Why is social media popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 29,
    "category": "Generated unrelated topic",
    "message": "Can you explain smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 30,
    "category": "Generated unrelated topic",
    "message": "Can you explain operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 31,
    "category": "ACEVA - general",
    "message": "Where is ACEVA located?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 32,
    "category": "Generated unrelated topic",
    "message": "Why is football popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 33,
    "category": "Random / noise",
    "message": "@#$%^&*",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 34,
    "category": "Math / unrelated task",
    "message": "What is 3/4 as a percentage?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 35,
    "category": "Generated unrelated topic",
    "message": "How did photography develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 36,
    "category": "Recommendations / opinions",
    "message": "Should I learn Python?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 37,
    "category": "Generated unrelated topic",
    "message": "Who invented movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 38,
    "category": "Generated unrelated topic",
    "message": "Are people using economics more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 39,
    "category": "Generated unrelated topic",
    "message": "When did databases become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 40,
    "category": "Generated unrelated topic",
    "message": "Why is databases popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 41,
    "category": "Nonsense / gibberish",
    "message": "xvbnmklpoi",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 42,
    "category": "Generated unrelated topic",
    "message": "What is social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 43,
    "category": "Generated unrelated topic",
    "message": "Is online banking difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 44,
    "category": "General technology",
    "message": "How does encryption work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 45,
    "category": "Science / education",
    "message": "What is a molecule?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 46,
    "category": "Incoherent questions",
    "message": "Why is who that?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 47,
    "category": "Science / education",
    "message": "How does gravity work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 48,
    "category": "Generated unrelated topic",
    "message": "What is programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 49,
    "category": "Generated unrelated topic",
    "message": "Who is famous for astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 50,
    "category": "Generated unrelated topic",
    "message": "Where did databases originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 51,
    "category": "Generated unrelated topic",
    "message": "Is movies difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 52,
    "category": "Meta / Pulse",
    "message": "What is your purpose?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 53,
    "category": "Personal / casual",
    "message": "Let's talk.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 54,
    "category": "General technology",
    "message": "How do search engines work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 55,
    "category": "Generated unrelated topic",
    "message": "Is cars difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 56,
    "category": "News / current events",
    "message": "Why is this country in the news?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 57,
    "category": "Generated unrelated topic",
    "message": "Why is psychology popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 58,
    "category": "Generated unrelated topic",
    "message": "Which cricket is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 59,
    "category": "Generated unrelated topic",
    "message": "Does music require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 60,
    "category": "Generated unrelated topic",
    "message": "How does databases work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 61,
    "category": "ACEVA - general",
    "message": "Why does ACEVA use this technology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 62,
    "category": "Generated unrelated topic",
    "message": "Tell me about online banking.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 63,
    "category": "Generated unrelated topic",
    "message": "How does space travel work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 64,
    "category": "Nonsense / gibberish",
    "message": "qazxswedc",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 65,
    "category": "Generated unrelated topic",
    "message": "Who is famous for universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 66,
    "category": "Generated unrelated topic",
    "message": "Does video games require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 67,
    "category": "General technology",
    "message": "What is an API?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 68,
    "category": "Generated unrelated topic",
    "message": "What are the problems with programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 69,
    "category": "Entertainment / sports",
    "message": "Who won the last World Cup?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 70,
    "category": "Recommendations / opinions",
    "message": "What restaurant is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 71,
    "category": "Nonsense / gibberish",
    "message": "qazwsxedcrf",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 72,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 73,
    "category": "News / current events",
    "message": "What happened recently?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 74,
    "category": "Generated unrelated topic",
    "message": "Is universities difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 75,
    "category": "Generated unrelated topic",
    "message": "Tell me about laptops.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 76,
    "category": "Generated unrelated topic",
    "message": "Could programming change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 77,
    "category": "ACEVA - general",
    "message": "How does ACEVA work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 78,
    "category": "Generated unrelated topic",
    "message": "Why is weather popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 79,
    "category": "Greeting",
    "message": "Can we talk?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 80,
    "category": "Programming",
    "message": "How does Python work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 81,
    "category": "Generated unrelated topic",
    "message": "How did fashion develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 82,
    "category": "Random / noise",
    "message": "👍👍👍",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 83,
    "category": "People - unrelated",
    "message": "How old is Shiva?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 84,
    "category": "Generated unrelated topic",
    "message": "Could movies change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 85,
    "category": "Personal / casual",
    "message": "Listen to this.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 86,
    "category": "Math / unrelated task",
    "message": "Calculate 25*25.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 87,
    "category": "Generated unrelated topic",
    "message": "Tell me about cars.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 88,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 89,
    "category": "Generated unrelated topic",
    "message": "Why do people use movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 90,
    "category": "General knowledge",
    "message": "Why do volcanoes erupt?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 91,
    "category": "Generated unrelated topic",
    "message": "Does robotics require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 92,
    "category": "Generated unrelated topic",
    "message": "Are people using programming more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 93,
    "category": "Generated unrelated topic",
    "message": "What are the problems with astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 94,
    "category": "Random / noise",
    "message": "abc123xyz",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 95,
    "category": "Nonsense / gibberish",
    "message": "plmoknijb",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 96,
    "category": "Generated unrelated topic",
    "message": "Could video games change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 97,
    "category": "Generated unrelated topic",
    "message": "Why is universities popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 98,
    "category": "Generated unrelated topic",
    "message": "Should I learn about history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 99,
    "category": "Generated unrelated topic",
    "message": "Should I learn about medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 100,
    "category": "General technology",
    "message": "How does a database work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 101,
    "category": "Meta / Pulse",
    "message": "Why does Pulse ask questions?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 102,
    "category": "Generated unrelated topic",
    "message": "What is robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 103,
    "category": "Programming",
    "message": "How does Java work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 104,
    "category": "Math / unrelated task",
    "message": "Solve 3x=21.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 105,
    "category": "Generated unrelated topic",
    "message": "Why is programming popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 106,
    "category": "Generated unrelated topic",
    "message": "Does universities require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 107,
    "category": "Greeting",
    "message": "How's it going?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 108,
    "category": "Generated unrelated topic",
    "message": "Why is robotics popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 109,
    "category": "Generated unrelated topic",
    "message": "When did cars become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 110,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 111,
    "category": "Greeting",
    "message": "How is your day?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 112,
    "category": "Greeting",
    "message": "Hope you're doing well",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 113,
    "category": "Math / unrelated task",
    "message": "What is 100 divided by 4?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 114,
    "category": "Generated unrelated topic",
    "message": "What are the problems with cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 115,
    "category": "Generated unrelated topic",
    "message": "Should I learn about movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 116,
    "category": "Generated unrelated topic",
    "message": "Why is operating systems popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 117,
    "category": "Generated unrelated topic",
    "message": "How did cricket develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 118,
    "category": "Generated unrelated topic",
    "message": "Which social media is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 119,
    "category": "General knowledge",
    "message": "What is the largest ocean?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 120,
    "category": "Science / education",
    "message": "How does sound travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 121,
    "category": "News / current events",
    "message": "What are today's biggest stories?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 122,
    "category": "Generated unrelated topic",
    "message": "Are people using online banking more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 123,
    "category": "Generated unrelated topic",
    "message": "When did space travel become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 124,
    "category": "Incoherent questions",
    "message": "Can why which?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 125,
    "category": "Generated unrelated topic",
    "message": "How does programming work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 126,
    "category": "Generated unrelated topic",
    "message": "Do people like smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 127,
    "category": "Personal / casual",
    "message": "Can we chat about something else?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 128,
    "category": "Random / noise",
    "message": "q1w2e3r4",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 129,
    "category": "ACEVA - general",
    "message": "Who founded ACEVA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 130,
    "category": "Entertainment / sports",
    "message": "Which football club is richest?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 131,
    "category": "Generated unrelated topic",
    "message": "Tell me about universities.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 132,
    "category": "Random / noise",
    "message": "...... hi ......",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 133,
    "category": "Science / education",
    "message": "How does the immune system work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 134,
    "category": "Positive control",
    "message": "I need an online booking system for my business.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 135,
    "category": "Meta / Pulse",
    "message": "What model are you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 136,
    "category": "Generated unrelated topic",
    "message": "Does electric cars require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 137,
    "category": "Generated unrelated topic",
    "message": "Which cryptocurrency is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 138,
    "category": "Generated unrelated topic",
    "message": "Why do people use stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 139,
    "category": "Recommendations / opinions",
    "message": "What do you recommend?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 140,
    "category": "Entertainment / sports",
    "message": "How does cricket scoring work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 141,
    "category": "Generated unrelated topic",
    "message": "Can you explain movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 142,
    "category": "Nonsense / gibberish",
    "message": "poiuasdfgh",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 143,
    "category": "Generated unrelated topic",
    "message": "Which fashion is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 144,
    "category": "Generated unrelated topic",
    "message": "What is space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 145,
    "category": "Generated unrelated topic",
    "message": "Who is famous for weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 146,
    "category": "Entertainment / sports",
    "message": "What is the best movie of the year?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 147,
    "category": "Generated unrelated topic",
    "message": "Can you explain psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 148,
    "category": "Generated unrelated topic",
    "message": "What is movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 149,
    "category": "Generated unrelated topic",
    "message": "How does astronomy work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 150,
    "category": "Generated unrelated topic",
    "message": "What are the problems with electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 151,
    "category": "Generated unrelated topic",
    "message": "Why do people use medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 152,
    "category": "Generated unrelated topic",
    "message": "What is cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 153,
    "category": "Personal / casual",
    "message": "What are you doing?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 154,
    "category": "Generated unrelated topic",
    "message": "Which robotics is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 155,
    "category": "Personal / casual",
    "message": "Do you like coffee?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 156,
    "category": "Generated unrelated topic",
    "message": "Can you explain history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 157,
    "category": "Generated unrelated topic",
    "message": "Why do people use online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 158,
    "category": "Generated unrelated topic",
    "message": "Does cooking require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 159,
    "category": "Generated unrelated topic",
    "message": "Why do people use economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 160,
    "category": "ACEVA - general",
    "message": "How is ACEVA managed?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 161,
    "category": "Generated unrelated topic",
    "message": "Does stock markets require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 162,
    "category": "Generated unrelated topic",
    "message": "Which cars is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 163,
    "category": "Generated unrelated topic",
    "message": "Could history change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 164,
    "category": "Generated unrelated topic",
    "message": "Which laptops is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 165,
    "category": "Generated unrelated topic",
    "message": "Which history is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 166,
    "category": "Generated unrelated topic",
    "message": "How did cryptocurrency develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 167,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 168,
    "category": "Generated unrelated topic",
    "message": "How did space travel develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 169,
    "category": "Generated unrelated topic",
    "message": "When did weather become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 170,
    "category": "Generated unrelated topic",
    "message": "Which smartphones is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 171,
    "category": "Generated unrelated topic",
    "message": "Do people like movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 172,
    "category": "Generated unrelated topic",
    "message": "Is social media difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 173,
    "category": "Generated unrelated topic",
    "message": "How did astronomy develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 174,
    "category": "Personal / casual",
    "message": "Can I ask you something?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 175,
    "category": "Generated unrelated topic",
    "message": "Can you explain cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 176,
    "category": "Generated unrelated topic",
    "message": "Where did cars originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 177,
    "category": "Mixed intent",
    "message": "Hello. We need an online booking system. By the way, who is the CEO of ACEVA?",
    "classification": "partial",
    "progressBehavior": "Count booking requirement only."
  },
  {
    "id": 178,
    "category": "Generated unrelated topic",
    "message": "Do people like databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 179,
    "category": "Generated unrelated topic",
    "message": "Do people like operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 180,
    "category": "Generated unrelated topic",
    "message": "Should I learn about economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 181,
    "category": "Programming",
    "message": "Why was Java created?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 182,
    "category": "Personal / casual",
    "message": "Do you have feelings?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 183,
    "category": "Nonsense / gibberish",
    "message": "hgfdsaytre",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 184,
    "category": "ACEVA - general",
    "message": "Tell me about ACEVA.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 185,
    "category": "Generated unrelated topic",
    "message": "Who invented cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 186,
    "category": "Generated unrelated topic",
    "message": "Should I learn about football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 187,
    "category": "Generated unrelated topic",
    "message": "Are people using laptops more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 188,
    "category": "Generated unrelated topic",
    "message": "How does operating systems work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 189,
    "category": "Generated unrelated topic",
    "message": "Are people using cryptocurrency more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 190,
    "category": "Generated unrelated topic",
    "message": "Does operating systems require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 191,
    "category": "Generated unrelated topic",
    "message": "Is video games difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 192,
    "category": "Generated unrelated topic",
    "message": "Where did medicine originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 193,
    "category": "Greeting",
    "message": "Are you there?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 194,
    "category": "Generated unrelated topic",
    "message": "Should I learn about cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 195,
    "category": "Generated unrelated topic",
    "message": "Why do people use geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 196,
    "category": "Generated unrelated topic",
    "message": "Which programming is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 197,
    "category": "Meta / Pulse",
    "message": "Who built you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 198,
    "category": "Recommendations / opinions",
    "message": "Which cloud provider is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 199,
    "category": "Generated unrelated topic",
    "message": "Who is famous for cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 200,
    "category": "Entertainment / sports",
    "message": "How does the offside rule work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 201,
    "category": "Generated unrelated topic",
    "message": "Can you explain economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 202,
    "category": "Generated unrelated topic",
    "message": "How does weather work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 203,
    "category": "Generated unrelated topic",
    "message": "Who is famous for stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 204,
    "category": "Meta / Pulse",
    "message": "Why are you asking me these questions?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 205,
    "category": "Personal / casual",
    "message": "Are you available?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 206,
    "category": "Generated unrelated topic",
    "message": "Does history require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 207,
    "category": "Math / unrelated task",
    "message": "Convert 10 miles to kilometers.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 208,
    "category": "Generated unrelated topic",
    "message": "How did football develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 209,
    "category": "Generated unrelated topic",
    "message": "Is cryptocurrency difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 210,
    "category": "Math / unrelated task",
    "message": "What is 2 to the power of 10?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 211,
    "category": "Generated unrelated topic",
    "message": "Should I learn about geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 212,
    "category": "Generated unrelated topic",
    "message": "When did universities become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 213,
    "category": "Random / noise",
    "message": "blah blah blah",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 214,
    "category": "Generated unrelated topic",
    "message": "Can you explain astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 215,
    "category": "Generated unrelated topic",
    "message": "Could cryptocurrency change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 216,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 217,
    "category": "Generated unrelated topic",
    "message": "What are the problems with online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 218,
    "category": "Generated unrelated topic",
    "message": "Could databases change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 219,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 220,
    "category": "Generated unrelated topic",
    "message": "What is psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 221,
    "category": "Greeting",
    "message": "Good to see you",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 222,
    "category": "Generated unrelated topic",
    "message": "Should I learn about online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 223,
    "category": "General technology",
    "message": "What is quantum computing?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 224,
    "category": "Generated unrelated topic",
    "message": "What is medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 225,
    "category": "Generated unrelated topic",
    "message": "Which video games is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 226,
    "category": "Generated unrelated topic",
    "message": "Why do people use cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 227,
    "category": "Generated unrelated topic",
    "message": "Where did geography originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 228,
    "category": "Generated unrelated topic",
    "message": "Do people like social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 229,
    "category": "Generated unrelated topic",
    "message": "What are the problems with music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 230,
    "category": "Generated unrelated topic",
    "message": "Why do people use smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 231,
    "category": "Generated unrelated topic",
    "message": "Can you explain databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 232,
    "category": "General knowledge",
    "message": "Why do seasons change?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 233,
    "category": "Generated unrelated topic",
    "message": "Should I learn about databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 234,
    "category": "Generated unrelated topic",
    "message": "Should I learn about music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 235,
    "category": "Generated unrelated topic",
    "message": "Tell me about electric cars.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 236,
    "category": "Generated unrelated topic",
    "message": "Could photography change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 237,
    "category": "ACEVA - general",
    "message": "What technologies does ACEVA use?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 238,
    "category": "Generated unrelated topic",
    "message": "Why is laptops popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 239,
    "category": "Positive control",
    "message": "The project should be completed as soon as possible.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 240,
    "category": "Generated unrelated topic",
    "message": "Are people using football more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 241,
    "category": "Generated unrelated topic",
    "message": "Should I learn about smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 242,
    "category": "Generated unrelated topic",
    "message": "Does weather require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 243,
    "category": "Recommendations / opinions",
    "message": "What phone should I buy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 244,
    "category": "Generated unrelated topic",
    "message": "Why is stock markets popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 245,
    "category": "News / current events",
    "message": "When did this event happen?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 246,
    "category": "Greeting",
    "message": "How are you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 247,
    "category": "Programming",
    "message": "Should I learn Java?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 248,
    "category": "News / current events",
    "message": "Who is currently president?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 249,
    "category": "News / current events",
    "message": "Why is this company in the news?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 250,
    "category": "Generated unrelated topic",
    "message": "What are the problems with fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 251,
    "category": "Programming",
    "message": "How do APIs work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 252,
    "category": "Math / unrelated task",
    "message": "What is the derivative of x squared?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 253,
    "category": "General technology",
    "message": "What is the metaverse?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 254,
    "category": "Incoherent questions",
    "message": "Can where be how?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 255,
    "category": "Generated unrelated topic",
    "message": "Does programming require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 256,
    "category": "Generated unrelated topic",
    "message": "What is astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 257,
    "category": "General knowledge",
    "message": "Where is the Sahara Desert?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 258,
    "category": "Generated unrelated topic",
    "message": "Tell me about psychology.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 259,
    "category": "Generated unrelated topic",
    "message": "What are the problems with universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 260,
    "category": "Generated unrelated topic",
    "message": "Could laptops change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 261,
    "category": "Generated unrelated topic",
    "message": "Tell me about fashion.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 262,
    "category": "General knowledge",
    "message": "What is the speed of light?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 263,
    "category": "Generated unrelated topic",
    "message": "Do people like robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 264,
    "category": "Mixed intent",
    "message": "We need a mobile app. Also tell me a joke.",
    "classification": "partial",
    "progressBehavior": "Count mobile-app requirement only."
  },
  {
    "id": 265,
    "category": "News / current events",
    "message": "What happened in the news today?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 266,
    "category": "Generated unrelated topic",
    "message": "Should I learn about programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 267,
    "category": "Generated unrelated topic",
    "message": "Who is famous for geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 268,
    "category": "Math / unrelated task",
    "message": "What is 2+2?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 269,
    "category": "Generated unrelated topic",
    "message": "Is music difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 270,
    "category": "Generated unrelated topic",
    "message": "Are people using cricket more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 271,
    "category": "Generated unrelated topic",
    "message": "What are the problems with video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 272,
    "category": "Generated unrelated topic",
    "message": "When did astronomy become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 273,
    "category": "Generated unrelated topic",
    "message": "Should I learn about cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 274,
    "category": "Generated unrelated topic",
    "message": "How does laptops work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 275,
    "category": "Generated unrelated topic",
    "message": "Is robotics difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 276,
    "category": "Generated unrelated topic",
    "message": "Why do people use fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 277,
    "category": "General technology",
    "message": "Why do websites need servers?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 278,
    "category": "Recommendations / opinions",
    "message": "What is the best car?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 279,
    "category": "Generated unrelated topic",
    "message": "Do people like geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 280,
    "category": "Generated unrelated topic",
    "message": "Does smartphones require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 281,
    "category": "Generated unrelated topic",
    "message": "When did operating systems become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 282,
    "category": "Math / unrelated task",
    "message": "How many days are in a year?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 283,
    "category": "Generated unrelated topic",
    "message": "Are people using astronomy more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 284,
    "category": "Generated unrelated topic",
    "message": "When did video games become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 285,
    "category": "Science / education",
    "message": "What is a black hole?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 286,
    "category": "Generated unrelated topic",
    "message": "Who is famous for smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 287,
    "category": "Generated unrelated topic",
    "message": "Where did economics originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 288,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 289,
    "category": "Generated unrelated topic",
    "message": "Where did laptops originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 290,
    "category": "Generated unrelated topic",
    "message": "How did stock markets develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 291,
    "category": "Generated unrelated topic",
    "message": "What is fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 292,
    "category": "Generated unrelated topic",
    "message": "What are the problems with medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 293,
    "category": "Generated unrelated topic",
    "message": "Which universities is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 294,
    "category": "Generated unrelated topic",
    "message": "Do people like psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 295,
    "category": "Generated unrelated topic",
    "message": "When did cooking become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 296,
    "category": "Generated unrelated topic",
    "message": "Why is space travel popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 297,
    "category": "Incoherent questions",
    "message": "Who are you, you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 298,
    "category": "Generated unrelated topic",
    "message": "Could space travel change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 299,
    "category": "Recommendations / opinions",
    "message": "What game should I play?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 300,
    "category": "Generated unrelated topic",
    "message": "Do people like online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 301,
    "category": "Random / noise",
    "message": "!!!!!!",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 302,
    "category": "Math / unrelated task",
    "message": "What is 90% of 80?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 303,
    "category": "Nonsense / gibberish",
    "message": "zxcmnbvcx",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 304,
    "category": "Generated unrelated topic",
    "message": "Who is famous for video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 305,
    "category": "Positive control",
    "message": "We need an admin dashboard to manage the system.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 306,
    "category": "Greeting",
    "message": "Good afternoon",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 307,
    "category": "Mixed intent",
    "message": "Hi, I need a mobile app for my restaurant. Also, how does Python work?",
    "classification": "partial",
    "progressBehavior": "Count only the project-relevant portion; do not add progress for the Python question."
  },
  {
    "id": 308,
    "category": "Generated unrelated topic",
    "message": "Where did psychology originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 309,
    "category": "ACEVA - general",
    "message": "What is ACEVA's history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 310,
    "category": "Generated unrelated topic",
    "message": "What are the problems with databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 311,
    "category": "Generated unrelated topic",
    "message": "Should I learn about electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 312,
    "category": "ACEVA - general",
    "message": "What does ACEVA do?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 313,
    "category": "Greeting",
    "message": "What's up?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 314,
    "category": "Random / noise",
    "message": "test test test",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 315,
    "category": "Generated unrelated topic",
    "message": "Why is photography popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 316,
    "category": "Generated unrelated topic",
    "message": "What is operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 317,
    "category": "News / current events",
    "message": "Who reported this story?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 318,
    "category": "Generated unrelated topic",
    "message": "Tell me about stock markets.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 319,
    "category": "Positive control",
    "message": "We want a website where customers can purchase products.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 320,
    "category": "Generated unrelated topic",
    "message": "What is photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 321,
    "category": "Generated unrelated topic",
    "message": "Why is history popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 322,
    "category": "Personal / casual",
    "message": "Tell me something interesting.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 323,
    "category": "Generated unrelated topic",
    "message": "When did electric cars become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 324,
    "category": "Math / unrelated task",
    "message": "How many meters are in a kilometer?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 325,
    "category": "Personal / casual",
    "message": "I'm bored.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 326,
    "category": "Generated unrelated topic",
    "message": "Who invented geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 327,
    "category": "Generated unrelated topic",
    "message": "How does video games work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 328,
    "category": "Generated unrelated topic",
    "message": "Why do people use photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 329,
    "category": "Generated unrelated topic",
    "message": "Are people using cooking more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 330,
    "category": "Generated unrelated topic",
    "message": "Does online banking require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 331,
    "category": "Generated unrelated topic",
    "message": "What are the problems with cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 332,
    "category": "Generated unrelated topic",
    "message": "Do people like space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 333,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 334,
    "category": "Incoherent questions",
    "message": "Where why you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 335,
    "category": "Generated unrelated topic",
    "message": "Can you explain video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 336,
    "category": "News / current events",
    "message": "What happened in the stock market?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 337,
    "category": "Generated unrelated topic",
    "message": "Can you explain football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 338,
    "category": "Generated unrelated topic",
    "message": "When did stock markets become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 339,
    "category": "Generated unrelated topic",
    "message": "Could cricket change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 340,
    "category": "Generated unrelated topic",
    "message": "Can you explain programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 341,
    "category": "Generated unrelated topic",
    "message": "How does movies work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 342,
    "category": "Generated unrelated topic",
    "message": "Why is cooking popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 343,
    "category": "Meta / Pulse",
    "message": "Are you an AI assistant?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 344,
    "category": "Generated unrelated topic",
    "message": "Do people like cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 345,
    "category": "Generated unrelated topic",
    "message": "Are people using stock markets more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 346,
    "category": "Incoherent questions",
    "message": "How is which what?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 347,
    "category": "Programming",
    "message": "What is JavaScript?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 348,
    "category": "Meta / Pulse",
    "message": "How were you trained?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 349,
    "category": "Greeting",
    "message": "Are you okay?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 350,
    "category": "Generated unrelated topic",
    "message": "Can you explain medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 351,
    "category": "Generated unrelated topic",
    "message": "Can you explain music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 352,
    "category": "General technology",
    "message": "What is artificial intelligence?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 353,
    "category": "Generated unrelated topic",
    "message": "Does economics require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 354,
    "category": "General technology",
    "message": "How does Wi-Fi work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 355,
    "category": "Generated unrelated topic",
    "message": "How did geography develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 356,
    "category": "General knowledge",
    "message": "How deep is the ocean?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 357,
    "category": "Generated unrelated topic",
    "message": "How does photography work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 358,
    "category": "Random / noise",
    "message": "nothing",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 359,
    "category": "Generated unrelated topic",
    "message": "Could universities change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 360,
    "category": "Generated unrelated topic",
    "message": "Which space travel is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 361,
    "category": "News / current events",
    "message": "Why are prices rising?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 362,
    "category": "Entertainment / sports",
    "message": "Who is the fastest runner?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 363,
    "category": "Generated unrelated topic",
    "message": "How does stock markets work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 364,
    "category": "Incoherent questions",
    "message": "How what why then?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 365,
    "category": "Generated unrelated topic",
    "message": "How did cooking develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 366,
    "category": "Generated unrelated topic",
    "message": "How does social media work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 367,
    "category": "Recommendations / opinions",
    "message": "Which operating system is better?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 368,
    "category": "Generated unrelated topic",
    "message": "Is medicine difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 369,
    "category": "Incoherent questions",
    "message": "Who which where?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 370,
    "category": "Positive control",
    "message": "I need a mobile app for my restaurant.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 371,
    "category": "Positive control",
    "message": "The main users will be small business owners.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 372,
    "category": "Nonsense / gibberish",
    "message": "asdfghjkl",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 373,
    "category": "Generated unrelated topic",
    "message": "What is geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 374,
    "category": "Generated unrelated topic",
    "message": "Who invented operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 375,
    "category": "Generated unrelated topic",
    "message": "Does laptops require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 376,
    "category": "Generated unrelated topic",
    "message": "Are people using robotics more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 377,
    "category": "Generated unrelated topic",
    "message": "Is programming difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 378,
    "category": "General knowledge",
    "message": "When was the internet invented?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 379,
    "category": "Generated unrelated topic",
    "message": "Who invented cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 380,
    "category": "Generated unrelated topic",
    "message": "Tell me about economics.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 381,
    "category": "News / current events",
    "message": "What are the latest technology headlines?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 382,
    "category": "People - unrelated",
    "message": "Tell me about the team.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 383,
    "category": "Generated unrelated topic",
    "message": "Can you explain geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 384,
    "category": "Generated unrelated topic",
    "message": "Does photography require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 385,
    "category": "News / current events",
    "message": "What are the latest sports results?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 386,
    "category": "Nonsense / gibberish",
    "message": "zzxxccvvbb",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 387,
    "category": "Generated unrelated topic",
    "message": "Is geography difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 388,
    "category": "Science / education",
    "message": "Why does water boil?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 389,
    "category": "Generated unrelated topic",
    "message": "Where did universities originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 390,
    "category": "Generated unrelated topic",
    "message": "Should I learn about cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 391,
    "category": "Generated unrelated topic",
    "message": "Can you explain photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 392,
    "category": "Science / education",
    "message": "What is chemistry?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 393,
    "category": "Generated unrelated topic",
    "message": "Who invented space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 394,
    "category": "Science / education",
    "message": "What is relativity?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 395,
    "category": "Generated unrelated topic",
    "message": "Who invented databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 396,
    "category": "Entertainment / sports",
    "message": "Who is the best basketball player?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 397,
    "category": "Recommendations / opinions",
    "message": "Which programming language should I learn?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 398,
    "category": "Generated unrelated topic",
    "message": "Are people using music more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 399,
    "category": "Generated unrelated topic",
    "message": "Are people using medicine more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 400,
    "category": "Generated unrelated topic",
    "message": "What are the problems with geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 401,
    "category": "Generated unrelated topic",
    "message": "Why do people use cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 402,
    "category": "News / current events",
    "message": "What is happening in the world?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 403,
    "category": "Generated unrelated topic",
    "message": "How does cryptocurrency work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 404,
    "category": "Generated unrelated topic",
    "message": "Why is smartphones popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 405,
    "category": "Random / noise",
    "message": "😂😂😂",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 406,
    "category": "Meta / Pulse",
    "message": "What company made you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 407,
    "category": "Generated unrelated topic",
    "message": "Where did astronomy originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 408,
    "category": "Recommendations / opinions",
    "message": "Which browser should I use?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 409,
    "category": "Generated unrelated topic",
    "message": "How did online banking develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 410,
    "category": "Generated unrelated topic",
    "message": "Tell me about movies.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 411,
    "category": "Generated unrelated topic",
    "message": "Tell me about cricket.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 412,
    "category": "Generated unrelated topic",
    "message": "How does cricket work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 413,
    "category": "Generated unrelated topic",
    "message": "Are people using operating systems more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 414,
    "category": "Generated unrelated topic",
    "message": "Why is economics popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 415,
    "category": "Personal / casual",
    "message": "Guess what?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 416,
    "category": "Random / noise",
    "message": "random random random",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 417,
    "category": "Meta / Pulse",
    "message": "How were you made?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 418,
    "category": "Generated unrelated topic",
    "message": "Why is cryptocurrency popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 419,
    "category": "Positive control",
    "message": "Our budget will be decided after discussing it with the team.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 420,
    "category": "Random / noise",
    "message": "!!! ???",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 421,
    "category": "Science / education",
    "message": "How does electricity work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 422,
    "category": "Meta / Pulse",
    "message": "Why do you need this information?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 423,
    "category": "Generated unrelated topic",
    "message": "What are the problems with football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 424,
    "category": "Generated unrelated topic",
    "message": "Tell me about operating systems.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 425,
    "category": "General knowledge",
    "message": "Who invented the telephone?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 426,
    "category": "Generated unrelated topic",
    "message": "How does history work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 427,
    "category": "People - unrelated",
    "message": "What is the developer's background?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 428,
    "category": "Generated unrelated topic",
    "message": "Does space travel require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 429,
    "category": "Generated unrelated topic",
    "message": "Do people like cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 430,
    "category": "Incoherent questions",
    "message": "Why who what?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 431,
    "category": "Generated unrelated topic",
    "message": "When did psychology become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 432,
    "category": "Nonsense / gibberish",
    "message": "lkjhgfdsap",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 433,
    "category": "Generated unrelated topic",
    "message": "Who is famous for fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 434,
    "category": "Generated unrelated topic",
    "message": "Where did cricket originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 435,
    "category": "Generated unrelated topic",
    "message": "Who invented photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 436,
    "category": "Recommendations / opinions",
    "message": "Which phone has the best camera?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 437,
    "category": "Generated unrelated topic",
    "message": "How does robotics work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 438,
    "category": "Generated unrelated topic",
    "message": "How did operating systems develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 439,
    "category": "Generated unrelated topic",
    "message": "Who invented programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 440,
    "category": "General knowledge",
    "message": "When did World War II end?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 441,
    "category": "Generated unrelated topic",
    "message": "Tell me about space travel.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 442,
    "category": "Personal / casual",
    "message": "What can you do?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 443,
    "category": "Generated unrelated topic",
    "message": "What is music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 444,
    "category": "Meta / Pulse",
    "message": "Can you explain your internal logic?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 445,
    "category": "Generated unrelated topic",
    "message": "How does cooking work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 446,
    "category": "Programming",
    "message": "What is Java?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 447,
    "category": "Generated unrelated topic",
    "message": "Where did stock markets originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 448,
    "category": "Generated unrelated topic",
    "message": "Who invented medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 449,
    "category": "Generated unrelated topic",
    "message": "Where did online banking originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 450,
    "category": "Generated unrelated topic",
    "message": "Where did weather originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 451,
    "category": "People - unrelated",
    "message": "Why is Shiva famous?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 452,
    "category": "Nonsense / gibberish",
    "message": "jshdfkjshdf",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 453,
    "category": "Generated unrelated topic",
    "message": "Who is famous for online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 454,
    "category": "Entertainment / sports",
    "message": "When is the next Olympics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 455,
    "category": "Generated unrelated topic",
    "message": "Could medicine change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 456,
    "category": "Generated unrelated topic",
    "message": "Does cricket require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 457,
    "category": "Math / unrelated task",
    "message": "Calculate the square root of 144.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 458,
    "category": "Generated unrelated topic",
    "message": "Why do people use operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 459,
    "category": "General technology",
    "message": "What is an operating system?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 460,
    "category": "Generated unrelated topic",
    "message": "What is video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 461,
    "category": "Generated unrelated topic",
    "message": "How does fashion work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 462,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 463,
    "category": "Generated unrelated topic",
    "message": "Is economics difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 464,
    "category": "Personal / casual",
    "message": "Are you intelligent?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 465,
    "category": "Entertainment / sports",
    "message": "Which game is most popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 466,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 467,
    "category": "Nonsense / gibberish",
    "message": "qweqweqwe",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 468,
    "category": "Generated unrelated topic",
    "message": "How does cars work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 469,
    "category": "Incoherent questions",
    "message": "When how what?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 470,
    "category": "Generated unrelated topic",
    "message": "Who is famous for music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 471,
    "category": "People - unrelated",
    "message": "Who is the CEO?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 472,
    "category": "Generated unrelated topic",
    "message": "Do people like programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 473,
    "category": "Generated unrelated topic",
    "message": "Are people using social media more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 474,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 475,
    "category": "ACEVA - general",
    "message": "Why was ACEVA created?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 476,
    "category": "People - unrelated",
    "message": "Who works there?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 477,
    "category": "Personal / casual",
    "message": "Do you remember me?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 478,
    "category": "Generated unrelated topic",
    "message": "Can you explain laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 479,
    "category": "Generated unrelated topic",
    "message": "How does smartphones work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 480,
    "category": "Generated unrelated topic",
    "message": "Could robotics change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 481,
    "category": "Science / education",
    "message": "Why do earthquakes happen?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 482,
    "category": "Generated unrelated topic",
    "message": "Do people like fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 483,
    "category": "Entertainment / sports",
    "message": "What is the highest movie rating?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 484,
    "category": "Generated unrelated topic",
    "message": "Who is famous for photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 485,
    "category": "Generated unrelated topic",
    "message": "Could social media change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 486,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 487,
    "category": "People - unrelated",
    "message": "Who is responsible for this company?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 488,
    "category": "Meta / Pulse",
    "message": "Who are you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 489,
    "category": "Generated unrelated topic",
    "message": "Which databases is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 490,
    "category": "News / current events",
    "message": "What are people talking about today?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 491,
    "category": "General knowledge",
    "message": "How do airplanes fly?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 492,
    "category": "Personal / casual",
    "message": "Are you a robot?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 493,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 494,
    "category": "Recommendations / opinions",
    "message": "What book should I read?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 495,
    "category": "Science / education",
    "message": "Why does metal rust?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 496,
    "category": "Generated unrelated topic",
    "message": "Does geography require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 497,
    "category": "Generated unrelated topic",
    "message": "How did social media develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 498,
    "category": "Science / education",
    "message": "How does the human heart work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 499,
    "category": "Generated unrelated topic",
    "message": "Where did fashion originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 500,
    "category": "Generated unrelated topic",
    "message": "What are the problems with photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 501,
    "category": "Programming",
    "message": "What is recursion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 502,
    "category": "Generated unrelated topic",
    "message": "Is smartphones difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 503,
    "category": "Random / noise",
    "message": "??????",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 504,
    "category": "Programming",
    "message": "Why do developers use Git?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 505,
    "category": "People - unrelated",
    "message": "Who is that person?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 506,
    "category": "General knowledge",
    "message": "What is the capital of Pakistan?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 507,
    "category": "Math / unrelated task",
    "message": "Solve x+5=10.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 508,
    "category": "Generated unrelated topic",
    "message": "Do people like universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 509,
    "category": "Generated unrelated topic",
    "message": "Is psychology difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 510,
    "category": "Generated unrelated topic",
    "message": "Who is famous for laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 511,
    "category": "Generated unrelated topic",
    "message": "What are the problems with weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 512,
    "category": "Generated unrelated topic",
    "message": "What is history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 513,
    "category": "Generated unrelated topic",
    "message": "Are people using video games more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 514,
    "category": "Generated unrelated topic",
    "message": "What is football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 515,
    "category": "Generated unrelated topic",
    "message": "What are the problems with space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 516,
    "category": "Generated unrelated topic",
    "message": "Tell me about programming.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 517,
    "category": "Generated unrelated topic",
    "message": "Who invented social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 518,
    "category": "Generated unrelated topic",
    "message": "Which photography is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 519,
    "category": "Programming",
    "message": "What is Ruby?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 520,
    "category": "People - unrelated",
    "message": "Who is the project manager?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 521,
    "category": "Generated unrelated topic",
    "message": "Tell me about astronomy.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 522,
    "category": "Generated unrelated topic",
    "message": "Tell me about cryptocurrency.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 523,
    "category": "Generated unrelated topic",
    "message": "Which stock markets is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 524,
    "category": "Entertainment / sports",
    "message": "Who is the most famous actor?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 525,
    "category": "Mixed intent",
    "message": "I want an e-commerce website. What is blockchain?",
    "classification": "partial",
    "progressBehavior": "Count e-commerce requirement only."
  },
  {
    "id": 526,
    "category": "Science / education",
    "message": "Why does ice float?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 527,
    "category": "Generated unrelated topic",
    "message": "Which operating systems is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 528,
    "category": "Recommendations / opinions",
    "message": "Which database is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 529,
    "category": "Recommendations / opinions",
    "message": "What movie should I watch?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 530,
    "category": "Generated unrelated topic",
    "message": "Should I learn about social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 531,
    "category": "Generated unrelated topic",
    "message": "Who invented economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 532,
    "category": "News / current events",
    "message": "What is trending today?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 533,
    "category": "Generated unrelated topic",
    "message": "Does fashion require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 534,
    "category": "ACEVA - general",
    "message": "How does ACEVA make money?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 535,
    "category": "ACEVA - general",
    "message": "What is ACEVA Technologies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 536,
    "category": "Generated unrelated topic",
    "message": "Can you explain universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 537,
    "category": "Generated unrelated topic",
    "message": "Could economics change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 538,
    "category": "Generated unrelated topic",
    "message": "Which medicine is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 539,
    "category": "Generated unrelated topic",
    "message": "Why do people use psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 540,
    "category": "Generated unrelated topic",
    "message": "Which astronomy is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 541,
    "category": "Positive control",
    "message": "The app should allow users to receive notifications.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 542,
    "category": "Meta / Pulse",
    "message": "How does this system work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 543,
    "category": "Incoherent questions",
    "message": "What can why be?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 544,
    "category": "Entertainment / sports",
    "message": "Why do people like horror movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 545,
    "category": "Generated unrelated topic",
    "message": "When did geography become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 546,
    "category": "Generated unrelated topic",
    "message": "Tell me about photography.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 547,
    "category": "Generated unrelated topic",
    "message": "Could online banking change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 548,
    "category": "Entertainment / sports",
    "message": "What song is trending?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 549,
    "category": "Generated unrelated topic",
    "message": "How did psychology develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 550,
    "category": "Programming",
    "message": "How do I learn programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 551,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 552,
    "category": "Greeting",
    "message": "Hey",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 553,
    "category": "Generated unrelated topic",
    "message": "Tell me about databases.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 554,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 555,
    "category": "Generated unrelated topic",
    "message": "Who is famous for cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 556,
    "category": "Science / education",
    "message": "Explain photosynthesis.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 557,
    "category": "Generated unrelated topic",
    "message": "Which movies is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 558,
    "category": "Generated unrelated topic",
    "message": "Who invented robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 559,
    "category": "Generated unrelated topic",
    "message": "Who invented video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 560,
    "category": "Generated unrelated topic",
    "message": "Who invented electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 561,
    "category": "Generated unrelated topic",
    "message": "Why is video games popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 562,
    "category": "Generated unrelated topic",
    "message": "What are the problems with history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 563,
    "category": "Generated unrelated topic",
    "message": "What are the problems with smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 564,
    "category": "Generated unrelated topic",
    "message": "Why do people use football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 565,
    "category": "Generated unrelated topic",
    "message": "Do people like music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 566,
    "category": "Generated unrelated topic",
    "message": "Why do people use space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 567,
    "category": "Generated unrelated topic",
    "message": "Who invented football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 568,
    "category": "Generated unrelated topic",
    "message": "How did programming develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 569,
    "category": "Random / noise",
    "message": "---___---",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 570,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 571,
    "category": "Generated unrelated topic",
    "message": "When did music become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 572,
    "category": "Generated unrelated topic",
    "message": "Does cars require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 573,
    "category": "Incoherent questions",
    "message": "Which is how when?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 574,
    "category": "Generated unrelated topic",
    "message": "When did online banking become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 575,
    "category": "Incoherent questions",
    "message": "How which is that?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 576,
    "category": "Generated unrelated topic",
    "message": "What is databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 577,
    "category": "Generated unrelated topic",
    "message": "How did databases develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 578,
    "category": "Generated unrelated topic",
    "message": "Why do people use laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 579,
    "category": "Generated unrelated topic",
    "message": "What are the problems with robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 580,
    "category": "Generated unrelated topic",
    "message": "Does databases require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 581,
    "category": "Generated unrelated topic",
    "message": "Is databases difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 582,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 583,
    "category": "Generated unrelated topic",
    "message": "Is stock markets difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 584,
    "category": "Programming",
    "message": "What is React?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 585,
    "category": "Generated unrelated topic",
    "message": "Why do people use universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 586,
    "category": "Incoherent questions",
    "message": "Which who then why?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 587,
    "category": "Entertainment / sports",
    "message": "Who is the most popular singer?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 588,
    "category": "Generated unrelated topic",
    "message": "How does psychology work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 589,
    "category": "Meta / Pulse",
    "message": "Can Pulse answer anything?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 590,
    "category": "Greeting",
    "message": "Hello",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 591,
    "category": "Generated unrelated topic",
    "message": "Are people using databases more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 592,
    "category": "Generated unrelated topic",
    "message": "Could astronomy change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 593,
    "category": "Generated unrelated topic",
    "message": "Which psychology is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 594,
    "category": "Generated unrelated topic",
    "message": "What are the problems with psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 595,
    "category": "People - unrelated",
    "message": "Who is Shiva?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 596,
    "category": "Generated unrelated topic",
    "message": "Where did operating systems originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 597,
    "category": "Math / unrelated task",
    "message": "Convert 5 kilograms to grams.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 598,
    "category": "Generated unrelated topic",
    "message": "Does cryptocurrency require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 599,
    "category": "Generated unrelated topic",
    "message": "Who invented universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 600,
    "category": "Generated unrelated topic",
    "message": "Should I learn about cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 601,
    "category": "Generated unrelated topic",
    "message": "Where did video games originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 602,
    "category": "Generated unrelated topic",
    "message": "How did smartphones develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 603,
    "category": "Positive control",
    "message": "I want customers to place orders through the app.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 604,
    "category": "Generated unrelated topic",
    "message": "What are the problems with laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 605,
    "category": "Generated unrelated topic",
    "message": "Tell me about medicine.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 606,
    "category": "Generated unrelated topic",
    "message": "Why is movies popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 607,
    "category": "Recommendations / opinions",
    "message": "Which university is better?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 608,
    "category": "Generated unrelated topic",
    "message": "Why is cars popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 609,
    "category": "Generated unrelated topic",
    "message": "Can you explain cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 610,
    "category": "Generated unrelated topic",
    "message": "Does medicine require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 611,
    "category": "Generated unrelated topic",
    "message": "Who invented stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 612,
    "category": "Generated unrelated topic",
    "message": "Who is famous for cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 613,
    "category": "Generated unrelated topic",
    "message": "Do people like weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 614,
    "category": "Generated unrelated topic",
    "message": "Who invented music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 615,
    "category": "Greeting",
    "message": "Hi",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 616,
    "category": "Generated unrelated topic",
    "message": "How did weather develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 617,
    "category": "Generated unrelated topic",
    "message": "How did robotics develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 618,
    "category": "Generated unrelated topic",
    "message": "Why do people use programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 619,
    "category": "Generated unrelated topic",
    "message": "Can you explain electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 620,
    "category": "Generated unrelated topic",
    "message": "Who is famous for electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 621,
    "category": "Generated unrelated topic",
    "message": "Why is astronomy popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 622,
    "category": "Generated unrelated topic",
    "message": "Do people like photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 623,
    "category": "Generated unrelated topic",
    "message": "Can you explain stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 624,
    "category": "Random / noise",
    "message": "nan",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 625,
    "category": "Generated unrelated topic",
    "message": "Do people like laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 626,
    "category": "Generated unrelated topic",
    "message": "How did movies develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 627,
    "category": "Generated unrelated topic",
    "message": "Who is famous for space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 628,
    "category": "Programming",
    "message": "Why is Python popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 629,
    "category": "Generated unrelated topic",
    "message": "Do people like medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 630,
    "category": "Greeting",
    "message": "Hello Pulse",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 631,
    "category": "Greeting",
    "message": "Nice to meet you",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 632,
    "category": "Generated unrelated topic",
    "message": "How did economics develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 633,
    "category": "Generated unrelated topic",
    "message": "Is fashion difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 634,
    "category": "Entertainment / sports",
    "message": "Which team is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 635,
    "category": "Generated unrelated topic",
    "message": "Is cooking difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 636,
    "category": "Generated unrelated topic",
    "message": "Should I learn about stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 637,
    "category": "Generated unrelated topic",
    "message": "Are people using cars more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 638,
    "category": "Generated unrelated topic",
    "message": "Could football change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 639,
    "category": "Generated unrelated topic",
    "message": "Could fashion change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 640,
    "category": "Generated unrelated topic",
    "message": "When did cricket become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 641,
    "category": "Generated unrelated topic",
    "message": "Why is fashion popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 642,
    "category": "Generated unrelated topic",
    "message": "Should I learn about universities?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 643,
    "category": "Generated unrelated topic",
    "message": "How does electric cars work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 644,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 645,
    "category": "ACEVA - general",
    "message": "How many people work at ACEVA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 646,
    "category": "Generated unrelated topic",
    "message": "What are the problems with stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 647,
    "category": "Generated unrelated topic",
    "message": "What is electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 648,
    "category": "Generated unrelated topic",
    "message": "Does astronomy require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 649,
    "category": "Generated unrelated topic",
    "message": "When did history become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 650,
    "category": "Generated unrelated topic",
    "message": "Tell me about weather.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 651,
    "category": "General technology",
    "message": "How does blockchain work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 652,
    "category": "Generated unrelated topic",
    "message": "Tell me about social media.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 653,
    "category": "Generated unrelated topic",
    "message": "Are people using universities more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 654,
    "category": "Generated unrelated topic",
    "message": "Why do people use astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 655,
    "category": "General technology",
    "message": "How does GPS work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 656,
    "category": "Generated unrelated topic",
    "message": "Do people like football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 657,
    "category": "Generated unrelated topic",
    "message": "Are people using psychology more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 658,
    "category": "Generated unrelated topic",
    "message": "How did laptops develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 659,
    "category": "Generated unrelated topic",
    "message": "What are the problems with cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 660,
    "category": "Generated unrelated topic",
    "message": "Who invented smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 661,
    "category": "Generated unrelated topic",
    "message": "How does geography work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 662,
    "category": "General technology",
    "message": "How does the internet work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 663,
    "category": "Generated unrelated topic",
    "message": "Are people using weather more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 664,
    "category": "Generated unrelated topic",
    "message": "Why do people use music?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 665,
    "category": "Generated unrelated topic",
    "message": "Why do people use social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 666,
    "category": "Generated unrelated topic",
    "message": "Should I learn about weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 667,
    "category": "Generated unrelated topic",
    "message": "Tell me about geography.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 668,
    "category": "Incoherent questions",
    "message": "What is you are?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 669,
    "category": "General knowledge",
    "message": "Which country is largest?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 670,
    "category": "Incoherent questions",
    "message": "Is what why there?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 671,
    "category": "Generated unrelated topic",
    "message": "Why do people use cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 672,
    "category": "Generated unrelated topic",
    "message": "Who is famous for psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 673,
    "category": "Generated unrelated topic",
    "message": "Tell me about cooking.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 674,
    "category": "Generated unrelated topic",
    "message": "How did history develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 675,
    "category": "Generated unrelated topic",
    "message": "Who is famous for medicine?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 676,
    "category": "Math / unrelated task",
    "message": "What is pi?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 677,
    "category": "ACEVA - general",
    "message": "Who works at ACEVA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 678,
    "category": "Generated unrelated topic",
    "message": "Who is famous for robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 679,
    "category": "Generated unrelated topic",
    "message": "Should I learn about fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 680,
    "category": "Generated unrelated topic",
    "message": "Can you explain cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 681,
    "category": "Generated unrelated topic",
    "message": "What are the problems with cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 682,
    "category": "Recommendations / opinions",
    "message": "What laptop is good for students?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 683,
    "category": "Personal / casual",
    "message": "Who are you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 684,
    "category": "Generated unrelated topic",
    "message": "Where did photography originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 685,
    "category": "Programming",
    "message": "What is C++?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 686,
    "category": "Generated unrelated topic",
    "message": "Why is geography popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 687,
    "category": "Generated unrelated topic",
    "message": "Do people like economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 688,
    "category": "General technology",
    "message": "What is cloud computing?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 689,
    "category": "General knowledge",
    "message": "Where is Mount Everest?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 690,
    "category": "Meta / Pulse",
    "message": "Can I change how you work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 691,
    "category": "Generated unrelated topic",
    "message": "Who invented fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 692,
    "category": "Generated unrelated topic",
    "message": "Who invented weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 693,
    "category": "Generated unrelated topic",
    "message": "Which economics is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 694,
    "category": "Generated unrelated topic",
    "message": "Who is famous for football?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 695,
    "category": "Generated unrelated topic",
    "message": "How did music develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 696,
    "category": "People - unrelated",
    "message": "What does Shiva do?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 697,
    "category": "News / current events",
    "message": "Who won the election?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 698,
    "category": "Generated unrelated topic",
    "message": "Can you explain fashion?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 699,
    "category": "Generated unrelated topic",
    "message": "Tell me about football.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 700,
    "category": "Generated unrelated topic",
    "message": "Is laptops difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 701,
    "category": "Math / unrelated task",
    "message": "What is 15 times 8?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 702,
    "category": "Generated unrelated topic",
    "message": "Who invented astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 703,
    "category": "News / current events",
    "message": "Why did the market fall today?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 704,
    "category": "Nonsense / gibberish",
    "message": "mnbvcxzasdf",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 705,
    "category": "Generated unrelated topic",
    "message": "Are people using space travel more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 706,
    "category": "Generated unrelated topic",
    "message": "Could cars change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 707,
    "category": "ACEVA - general",
    "message": "Who leads ACEVA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 708,
    "category": "Generated unrelated topic",
    "message": "Does psychology require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 709,
    "category": "General technology",
    "message": "What is machine learning?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 710,
    "category": "Random / noise",
    "message": "###",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 711,
    "category": "Generated unrelated topic",
    "message": "What is weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 712,
    "category": "Generated unrelated topic",
    "message": "Where did history originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 713,
    "category": "People - unrelated",
    "message": "What does this employee do?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 714,
    "category": "Generated unrelated topic",
    "message": "How did cars develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 715,
    "category": "Generated unrelated topic",
    "message": "Should I learn about laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 716,
    "category": "Random / noise",
    "message": "123456789",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 717,
    "category": "People - unrelated",
    "message": "Tell me about Shiva.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 718,
    "category": "Generated unrelated topic",
    "message": "Is football difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 719,
    "category": "Generated unrelated topic",
    "message": "Which online banking is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 720,
    "category": "Nonsense / gibberish",
    "message": "sdfghjklqwerty",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 721,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of cricket?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 722,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 723,
    "category": "Generated unrelated topic",
    "message": "Could electric cars change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 724,
    "category": "Generated unrelated topic",
    "message": "When did fashion become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 725,
    "category": "ACEVA - general",
    "message": "Who is ACEVA's CEO?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 726,
    "category": "Generated unrelated topic",
    "message": "Should I learn about space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 727,
    "category": "Generated unrelated topic",
    "message": "Tell me about robotics.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 728,
    "category": "Generated unrelated topic",
    "message": "Could smartphones change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 729,
    "category": "Generated unrelated topic",
    "message": "Tell me about history.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 730,
    "category": "Generated unrelated topic",
    "message": "Which music is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 731,
    "category": "Generated unrelated topic",
    "message": "Why do people use electric cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 732,
    "category": "Greeting",
    "message": "Good morning",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 733,
    "category": "Generated unrelated topic",
    "message": "Why is music popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 734,
    "category": "Recommendations / opinions",
    "message": "Should I buy an iPhone?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 735,
    "category": "Nonsense / gibberish",
    "message": "mnbvcxzlkj",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 736,
    "category": "General technology",
    "message": "How does facial recognition work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 737,
    "category": "Personal / casual",
    "message": "Make me laugh.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 738,
    "category": "Generated unrelated topic",
    "message": "Should I learn about video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 739,
    "category": "Incoherent questions",
    "message": "Where does who why?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 740,
    "category": "Science / education",
    "message": "How does a telescope work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 741,
    "category": "Generated unrelated topic",
    "message": "Where did movies originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 742,
    "category": "Generated unrelated topic",
    "message": "Where did music originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 743,
    "category": "Generated unrelated topic",
    "message": "Are people using smartphones more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 744,
    "category": "Generated unrelated topic",
    "message": "Which weather is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 745,
    "category": "Generated unrelated topic",
    "message": "How does football work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 746,
    "category": "Generated unrelated topic",
    "message": "Tell me about music.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 747,
    "category": "Personal / casual",
    "message": "What do you think?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 748,
    "category": "Generated unrelated topic",
    "message": "Can you explain space travel?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 749,
    "category": "Nonsense / gibberish",
    "message": "asdasdasd",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 750,
    "category": "Generated unrelated topic",
    "message": "Is history difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 751,
    "category": "General knowledge",
    "message": "How far is the moon?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 752,
    "category": "Programming",
    "message": "What is Python?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 753,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of photography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 754,
    "category": "Generated unrelated topic",
    "message": "How does universities work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 755,
    "category": "Generated unrelated topic",
    "message": "Does social media require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 756,
    "category": "Generated unrelated topic",
    "message": "Who is famous for movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 757,
    "category": "Generated unrelated topic",
    "message": "What is cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 758,
    "category": "Meta / Pulse",
    "message": "What is Pulse?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 759,
    "category": "Random / noise",
    "message": "00000000",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 760,
    "category": "Generated unrelated topic",
    "message": "Could stock markets change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 761,
    "category": "Nonsense / gibberish",
    "message": "xczvbnmqwer",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 762,
    "category": "Greeting",
    "message": "Hey there",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 763,
    "category": "Generated unrelated topic",
    "message": "Should I learn about astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 764,
    "category": "Generated unrelated topic",
    "message": "Do people like cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 765,
    "category": "General technology",
    "message": "How do mobile phones work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 766,
    "category": "General knowledge",
    "message": "Which planet is largest?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 767,
    "category": "General technology",
    "message": "What is cybersecurity?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 768,
    "category": "Generated unrelated topic",
    "message": "What are the problems with operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 769,
    "category": "Meta / Pulse",
    "message": "How does Pulse work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 770,
    "category": "Generated unrelated topic",
    "message": "Does football require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 771,
    "category": "Generated unrelated topic",
    "message": "Who is famous for economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 772,
    "category": "Generated unrelated topic",
    "message": "Are people using history more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 773,
    "category": "Generated unrelated topic",
    "message": "Which cooking is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 774,
    "category": "Generated unrelated topic",
    "message": "How does medicine work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 775,
    "category": "Generated unrelated topic",
    "message": "Who is famous for history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 776,
    "category": "Generated unrelated topic",
    "message": "Where did space travel originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 777,
    "category": "Greeting",
    "message": "Good evening",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 778,
    "category": "Generated unrelated topic",
    "message": "Who is famous for cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 779,
    "category": "Generated unrelated topic",
    "message": "Is electric cars difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 780,
    "category": "Generated unrelated topic",
    "message": "When did social media become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 781,
    "category": "Generated unrelated topic",
    "message": "Do people like stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 782,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 783,
    "category": "Math / unrelated task",
    "message": "How many seconds are in an hour?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 784,
    "category": "Math / unrelated task",
    "message": "What is 7 cubed?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 785,
    "category": "Generated unrelated topic",
    "message": "Who is famous for social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 786,
    "category": "General knowledge",
    "message": "Who discovered gravity?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 787,
    "category": "Generated unrelated topic",
    "message": "How did video games develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 788,
    "category": "Generated unrelated topic",
    "message": "What is laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 789,
    "category": "Generated unrelated topic",
    "message": "Who invented cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 790,
    "category": "Generated unrelated topic",
    "message": "When did football become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 791,
    "category": "Generated unrelated topic",
    "message": "What is stock markets?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 792,
    "category": "Generated unrelated topic",
    "message": "Is space travel difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 793,
    "category": "News / current events",
    "message": "Where did the incident happen?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 794,
    "category": "Generated unrelated topic",
    "message": "Who is famous for operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 795,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 796,
    "category": "Generated unrelated topic",
    "message": "Can you explain cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 797,
    "category": "Generated unrelated topic",
    "message": "Who is famous for databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 798,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 799,
    "category": "Generated unrelated topic",
    "message": "Why is online banking popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 800,
    "category": "Greeting",
    "message": "Hi Pulse",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 801,
    "category": "Generated unrelated topic",
    "message": "Tell me about smartphones.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 802,
    "category": "Incoherent questions",
    "message": "Why what then?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 803,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of geography?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 804,
    "category": "Generated unrelated topic",
    "message": "Tell me about video games.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 805,
    "category": "Generated unrelated topic",
    "message": "Why do people use weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 806,
    "category": "Generated unrelated topic",
    "message": "Could music change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 807,
    "category": "Meta / Pulse",
    "message": "Who created Pulse?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 808,
    "category": "Generated unrelated topic",
    "message": "Why do people use databases?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 809,
    "category": "Science / education",
    "message": "How are stars formed?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 810,
    "category": "Generated unrelated topic",
    "message": "Which geography is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 811,
    "category": "Math / unrelated task",
    "message": "What is 20 percent of 500?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 812,
    "category": "Generated unrelated topic",
    "message": "How does online banking work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 813,
    "category": "Greeting",
    "message": "How are you doing?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 814,
    "category": "Programming",
    "message": "How does a compiler work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 815,
    "category": "Entertainment / sports",
    "message": "What is the latest Netflix show?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 816,
    "category": "Generated unrelated topic",
    "message": "Who invented history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 817,
    "category": "Meta / Pulse",
    "message": "What are you?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 818,
    "category": "Incoherent questions",
    "message": "What what is who?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 819,
    "category": "Generated unrelated topic",
    "message": "Which football is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 820,
    "category": "Nonsense / gibberish",
    "message": "hdgjsabdasvjvdahs",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 821,
    "category": "Science / education",
    "message": "How does the brain work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 822,
    "category": "Generated unrelated topic",
    "message": "What is economics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 823,
    "category": "ACEVA - general",
    "message": "When was ACEVA founded?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 824,
    "category": "Entertainment / sports",
    "message": "When is the next cricket match?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 825,
    "category": "Generated unrelated topic",
    "message": "What is cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 826,
    "category": "Science / education",
    "message": "Why do atoms bond?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 827,
    "category": "Generated unrelated topic",
    "message": "Do people like video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 828,
    "category": "Generated unrelated topic",
    "message": "How does music work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 829,
    "category": "Entertainment / sports",
    "message": "Why is football so popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 830,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 831,
    "category": "General knowledge",
    "message": "Who wrote Hamlet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 832,
    "category": "Generated unrelated topic",
    "message": "Who invented laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 833,
    "category": "Generated unrelated topic",
    "message": "Who invented online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 834,
    "category": "ACEVA - general",
    "message": "How are things handled internally at ACEVA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 835,
    "category": "Generated unrelated topic",
    "message": "Why do people use robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 836,
    "category": "Generated unrelated topic",
    "message": "What are the problems with movies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 837,
    "category": "Science / education",
    "message": "What is DNA?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 838,
    "category": "Entertainment / sports",
    "message": "Who won the match?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 839,
    "category": "General technology",
    "message": "How does AI work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 840,
    "category": "Recommendations / opinions",
    "message": "What is the best social media platform?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 841,
    "category": "Generated unrelated topic",
    "message": "Can you explain social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 842,
    "category": "Generated unrelated topic",
    "message": "Do people like astronomy?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 843,
    "category": "Generated unrelated topic",
    "message": "Why is electric cars popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 844,
    "category": "Personal / casual",
    "message": "Tell me a joke.",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 845,
    "category": "Generated unrelated topic",
    "message": "Where did social media originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 846,
    "category": "Generated unrelated topic",
    "message": "Does movies require the internet?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 847,
    "category": "Generated unrelated topic",
    "message": "Where did programming originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 848,
    "category": "Generated unrelated topic",
    "message": "Why do people use video games?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 849,
    "category": "Generated unrelated topic",
    "message": "What is cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 850,
    "category": "Generated unrelated topic",
    "message": "Is operating systems difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 851,
    "category": "Incoherent questions",
    "message": "Does why happen which?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 852,
    "category": "Generated unrelated topic",
    "message": "Is photography difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 853,
    "category": "Generated unrelated topic",
    "message": "When did economics become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 854,
    "category": "Programming",
    "message": "What is object-oriented programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 855,
    "category": "Generated unrelated topic",
    "message": "How did medicine develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 856,
    "category": "Generated unrelated topic",
    "message": "Can you explain robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 857,
    "category": "Programming",
    "message": "Which programming language is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 858,
    "category": "Generated unrelated topic",
    "message": "Should I learn about robotics?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 859,
    "category": "ACEVA - general",
    "message": "What are ACEVA's policies?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 860,
    "category": "Generated unrelated topic",
    "message": "Why do people use cooking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 861,
    "category": "Generated unrelated topic",
    "message": "Should I learn about psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 862,
    "category": "Entertainment / sports",
    "message": "Where was this movie filmed?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 863,
    "category": "Generated unrelated topic",
    "message": "When did smartphones become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 864,
    "category": "Generated unrelated topic",
    "message": "Could weather change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 865,
    "category": "Generated unrelated topic",
    "message": "Could operating systems change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 866,
    "category": "Generated unrelated topic",
    "message": "Which electric cars is the best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 867,
    "category": "Generated unrelated topic",
    "message": "Do people like cryptocurrency?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 868,
    "category": "Generated unrelated topic",
    "message": "Where did electric cars originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 869,
    "category": "Recommendations / opinions",
    "message": "Which laptop is best?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 870,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of laptops?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 871,
    "category": "Positive control",
    "message": "We need customer accounts and staff accounts.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 872,
    "category": "Generated unrelated topic",
    "message": "Should I learn about operating systems?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 873,
    "category": "Nonsense / gibberish",
    "message": "jkhgfdsa",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 874,
    "category": "Generated unrelated topic",
    "message": "Who is famous for programming?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 875,
    "category": "Generated unrelated topic",
    "message": "Can you explain online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 876,
    "category": "Generated unrelated topic",
    "message": "Who invented cars?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 877,
    "category": "Mixed intent",
    "message": "Our target users are students. Why is Java popular?",
    "classification": "partial",
    "progressBehavior": "Count target-audience information only."
  },
  {
    "id": 878,
    "category": "Generated unrelated topic",
    "message": "Where did robotics originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 879,
    "category": "Generated unrelated topic",
    "message": "Could psychology change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 880,
    "category": "Generated unrelated topic",
    "message": "Where did smartphones originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 881,
    "category": "Generated unrelated topic",
    "message": "What is smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 882,
    "category": "Positive control",
    "message": "I want the platform to work on both web and mobile.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 883,
    "category": "Random / noise",
    "message": "....",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 884,
    "category": "Generated unrelated topic",
    "message": "Why is cricket popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 885,
    "category": "Generated unrelated topic",
    "message": "Where did cooking originate?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 886,
    "category": "Nonsense / gibberish",
    "message": "qwepoiuyasd",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 887,
    "category": "Generated unrelated topic",
    "message": "Can you explain weather?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 888,
    "category": "General knowledge",
    "message": "What is photosynthesis?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 889,
    "category": "Generated unrelated topic",
    "message": "When did movies become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 890,
    "category": "People - unrelated",
    "message": "Who manages the team?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 891,
    "category": "Generated unrelated topic",
    "message": "Are people using movies more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 892,
    "category": "Generated unrelated topic",
    "message": "Who invented psychology?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 893,
    "category": "Generated unrelated topic",
    "message": "When did photography become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 894,
    "category": "Positive control",
    "message": "I want to start a new project.",
    "classification": "valid",
    "progressBehavior": "Relevant project information may increase progress"
  },
  {
    "id": 895,
    "category": "Generated unrelated topic",
    "message": "Are people using electric cars more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 896,
    "category": "Generated unrelated topic",
    "message": "Could geography change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 897,
    "category": "Generated unrelated topic",
    "message": "When did cryptocurrency become popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 898,
    "category": "ACEVA - general",
    "message": "What is ACEVA's internal process?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 899,
    "category": "Meta / Pulse",
    "message": "What can Pulse do?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 900,
    "category": "Generated unrelated topic",
    "message": "Is astronomy difficult to understand?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 901,
    "category": "Generated unrelated topic",
    "message": "Could cooking change the future?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 902,
    "category": "Generated unrelated topic",
    "message": "Are people using photography more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 903,
    "category": "Math / unrelated task",
    "message": "What is the area of a circle?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 904,
    "category": "Generated unrelated topic",
    "message": "Why is medicine popular?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 905,
    "category": "Generated unrelated topic",
    "message": "What are the benefits of smartphones?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 906,
    "category": "Generated unrelated topic",
    "message": "How did universities develop?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 907,
    "category": "Generated unrelated topic",
    "message": "Are people using fashion more now?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 908,
    "category": "Generated unrelated topic",
    "message": "What is online banking?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 909,
    "category": "People - unrelated",
    "message": "Where does Shiva work?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 910,
    "category": "Generated unrelated topic",
    "message": "What are the problems with social media?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 911,
    "category": "Generated unrelated topic",
    "message": "Why do people use history?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 912,
    "category": "News / current events",
    "message": "What happened yesterday?",
    "classification": "invalid",
    "progressBehavior": "No progress"
  },
  {
    "id": 913,
    "category": "Generated unrelated topic",
    "message": "How does economics work?",
    "classification": "invalid",
    "progressBehavior": "No progressPulse — Worst-Case Relevance Test Dataset"
  }
];

describe("Pulse 913-Case Relevance Test Dataset", () => {
  it.each(dataset)(
    "Case #$id ($category): '$message' -> $classification",
    ({ message, classification }) => {
      const isValid = isProjectDiscoveryInput(message);
      const expectedValid = classification === "valid" || classification === "partial";
      expect(isValid).toBe(expectedValid);
    }
  );
});
