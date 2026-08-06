export interface LegalSection {
  h: string;
  p: string;
}

export interface LegalDoc {
  title: string;
  sections: LegalSection[];
}

export const LEGAL: Record<"privacy" | "terms", LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        h: "1. What this document will cover",
        p: "The categories of personal information Aceva collects through this website and during client engagements, why it is collected, and the lawful basis for processing it.",
      },
      {
        h: "2. Information collected through forms",
        p: "The qualification form collects a name, work email, optional company, situation, capability of interest, optional budget range and a description of the problem. Describe here exactly how long it is retained and who can read it.",
      },
      {
        h: "3. Analytics and cookies",
        p: "State which analytics tool is used, whether it sets cookies, whether IP addresses are anonymized, and how a visitor can opt out.",
      },
      {
        h: "4. Client data during engagements",
        p: "Set out access control, secrets handling, subprocessors, breach notification timelines and the deletion process at the end of an engagement.",
      },
      {
        h: "5. Your rights and how to exercise them",
        p: "Access, correction, deletion and portability requests, the response window, and the contact route for making a request.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        h: "1. Scope of these terms",
        p: "What the terms govern: use of this website, and the relationship between Aceva and a client before a separate engagement agreement is signed.",
      },
      {
        h: "2. Engagements, scope and acceptance",
        p: "How scope, milestones and acceptance criteria are agreed in writing, and what happens when scope changes mid-engagement.",
      },
      {
        h: "3. Intellectual property and ownership",
        p: "Confirm the operating principle stated across this site: the client owns the delivered code, accounts and data on the agreed terms. Record any exceptions here explicitly.",
      },
      {
        h: "4. Payment, cancellation and liability",
        p: "Invoicing schedule, late payment, cancellation notice, warranty period and the limitation of liability. This section in particular needs legal review.",
      },
      {
        h: "5. Governing law and disputes",
        p: "The jurisdiction whose law applies and the dispute resolution route.",
      },
    ],
  },
};
