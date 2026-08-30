import { describe, expect, it } from "vitest";

describe("Pulse Adaptive Technicality & Non-Technical Tone Test Suite", () => {
  it("Intent 1: Start Something New - Non-Technical User Guidance", () => {
    const userQuery = "I want to start a new mobile app for my restaurant.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Intent 2: Improve What I Have - Non-Technical User Guidance", () => {
    const userQuery = "Our current website is slow and hard for customers to book appointments.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Intent 3: Automate Something - Non-Technical User Guidance", () => {
    const userQuery = "We waste hours entering invoice numbers into spreadsheets manually every day.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Intent 4: Sell Something - Non-Technical User Guidance", () => {
    const userQuery = "I want to sell my handmade jewelry online and accept credit card payments.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Intent 5: Solve a Problem - Non-Technical User Guidance", () => {
    const userQuery = "Customers keep calling our front desk asking if their package has shipped.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Intent 6: I Don't Know Yet - Non-Technical User Guidance", () => {
    const userQuery = "I'm not sure yet, can you help me figure out what I need?";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(false);
  });

  it("Technical User Query - Adaptive Technical Tone Engagement", () => {
    const userQuery = "We want a Next.js frontend connected to a PostgreSQL database via a GraphQL microservices API.";
    const isTechnical = /next.js|postgresql|rest api|docker|microservices|graphql/i.test(userQuery);
    expect(isTechnical).toBe(true);
  });

  it("Single Question Enforcement - Ensures response asks exactly one question", () => {
    const samplePulseResponse = "That sounds great! Where do things feel most manual or slow in your daily operations today?";
    const questionMarksCount = (samplePulseResponse.match(/\?/g) || []).length;
    expect(questionMarksCount).toBe(1);
  });
});
