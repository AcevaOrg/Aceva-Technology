import type { DocumentCategory } from "@/lib/documents/types";

/**
 * Copy for /documents and /verify, kept out of the markup so it can be read (and edited) in one
 * place. Category names, blurbs and anchors come from lib/documents/categories.ts, not from here.
 */

export const DOCS_HERO = {
  eyebrow: "Documents",
  lead: "Proof you can ",
  emphasis: "check",
  tail: " instead of promises.",
  lede: "Financial statements, registrations, certifications and the people who have built with us. We publish them when they are ready, and anyone can confirm a record in seconds by scanning its QR code.",
} as const;

/**
 * Categories whose records are listed publicly. The remaining one (experience letters) is unlisted
 * by design: it is explained, inside the combined "Certifications & letters" section, instead.
 */
export const LISTED_CATEGORIES = ["financial_report", "company_identity", "certification", "program_record"] as const;
export type ListedCategory = (typeof LISTED_CATEGORIES)[number];

export const UNLISTED_CATEGORIES = ["experience_letter"] as const;
export type UnlistedCategory = (typeof UNLISTED_CATEGORIES)[number];

export function isListedCategory(category: DocumentCategory): category is ListedCategory {
  return (LISTED_CATEGORIES as readonly string[]).includes(category);
}

export const EMPTY_TITLE = "Nothing published yet";

/** Shown instead of a list when a section has no public records. Never a placeholder document. */
export const EMPTY_BODY: Record<ListedCategory, string> = {
  financial_report: "We list a report only when it is final, never as a draft. Our published statements will appear here.",
  company_identity: "Registration and licence documents appear here as we publish them. If you need one for due diligence, ask us directly.",
  certification: "Certificates we hold, and certificates we issue, appear here with a QR code anyone can scan.",
  program_record: "People appear here only with their written consent. Nobody is listed until they have agreed.",
};

/**
 * The one public section that carries two categories: certifications (listed) and experience
 * letters (never listed, only explained). The data model keeps them apart; only the page merges them.
 * The id stays `certifications` so every old link to it keeps working.
 */
export const CERTS_LETTERS_SECTION = {
  slug: "certifications",
  eyebrow: "Certifications & letters",
  plural: "Certifications & letters",
  blurb:
    "Standards we hold, certificates we issue, and the experience letters we give to staff and interns. Each one carries a QR code anyone can scan to confirm it is real.",
} as const;

/** The id of the empty anchor inside that section, so an old `#experience-letters` link still lands there. */
export const LETTERS_ANCHOR_ID = "experience-letters";

/** Labels for the two filter rows of the combined section. */
export const CERTS_LETTERS_FILTER = {
  viewLabel: "Show",
  directionLabel: "Certificates",
  views: { all: "All", certifications: "Certifications", letters: "Experience letters" },
  directions: { all: "All", held: "Held by ACEVA", issued: "Issued by ACEVA" },
} as const;

/** The sticky index and the section numbers follow this order. */
export const PUBLIC_SECTIONS = ["financial_report", "company_identity", "certifications_letters", "program_record"] as const;
export type PublicSection = (typeof PUBLIC_SECTIONS)[number];

/** Labels for the Team section's department filter. */
export const TEAM_FILTER = {
  groupLabel: "Department",
  all: "All",
} as const;

export const UNAVAILABLE_TITLE = "Temporarily unavailable";
export const UNAVAILABLE_BODY = "We could not load this section just now. Please try again in a minute. Verifying a document by its code still works.";

export const REGISTRY_NOTICE = {
  title: "The registry is taking a moment.",
  body: "Documents will appear here as soon as it responds. You can still check a document by its code.",
} as const;

export const QR_PANELS: Record<UnlistedCategory, { kicker: string; title: string; body: string; codeLabel: string }> = {
  experience_letter: {
    kicker: "Verified by QR",
    title: "Every letter carries its own proof.",
    body: "Experience letters are never listed here. Each one has a QR code and a short code printed beneath it. An employer scans the code, or types it below, and sees at once whether the letter is genuine and still valid.",
    codeLabel: "Code from an experience letter",
  },
};

export const QR_PANEL_LABELS = {
  sees: "A verifier sees",
  hidden: "Always kept private",
} as const;

export const HOW_IT_WORKS = {
  eyebrow: "How verification works",
  title: "Three steps, no account, nothing to install.",
  steps: [
    {
      kicker: "Step 01 · Scan",
      title: "Point a phone camera at the QR",
      body: "The code on the document opens a page on this site. Check the address bar says acevatech.com before you trust what it shows.",
    },
    {
      kicker: "Step 02 · Check",
      title: "Read the record, live",
      body: "The page asks our registry and shows the status right now: valid, expired or revoked, with the details we have chosen to make public.",
    },
    {
      kicker: "Step 03 · Trust",
      title: "Compare the file's fingerprint",
      body: "Where a file is attached you can compare its SHA-256 fingerprint with your copy. If they match, your copy is exactly the one we published.",
    },
  ],
} as const;

export const DOCS_CLOSE = {
  lines: ["If a document matters to your decision,", "check it before you rely on it."],
} as const;

/* ------------------------------------------------------------------ *
 * /verify                                                              *
 * ------------------------------------------------------------------ */

export const VERIFY_HERO = {
  eyebrow: "Verify",
  title: "Check a document.",
  lede: "Type or paste the code printed under the QR, or scan the QR itself. The answer comes straight from ACEVA's registry, not from the paper in your hand.",
} as const;

export const VERIFY_HINTS = [
  {
    title: "Scan",
    body: "Scan the QR on the document with your phone camera. It opens this page automatically.",
  },
  {
    title: "Type",
    body: "Codes look like ACV-7K3M-9QXD-4TRH. Capital letters, hyphens and spaces don't matter.",
  },
  {
    title: "No sign-in",
    body: "You never need an account, and we never ask for personal details to verify.",
  },
] as const;

export type VerifyKind = "valid" | "expired" | "revoked" | "not_found" | "rate_limited" | "unavailable";

/** What each verdict says. The not-found wording is the same for a typo, an unknown code and a hidden record. */
export const VERDICTS: Record<VerifyKind, { badge: string; headline: string; body: string }> = {
  valid: {
    badge: "Valid",
    headline: "This record is valid.",
    body: "ACEVA Technology issued it, and it is in good standing today.",
  },
  expired: {
    badge: "Expired",
    headline: "This record has expired.",
    body: "It was genuine, but its validity period has ended. Ask the holder for a current one if you need to rely on it today.",
  },
  revoked: {
    badge: "Revoked",
    headline: "This record has been revoked.",
    body: "ACEVA Technology has withdrawn it. Do not rely on any copy you hold. If this is a surprise, write to us and we will help.",
  },
  not_found: {
    badge: "Not found",
    headline: "We could not verify this code.",
    body: "It does not match a record we can verify. Check each character against the document and try again. If someone gave you this code, ask them to confirm it with us.",
  },
  rate_limited: {
    badge: "Please wait",
    headline: "Too many lookups just now.",
    body: "Please wait a minute and try again. The limit keeps the registry available for everyone.",
  },
  unavailable: {
    badge: "Unavailable",
    headline: "Verification is temporarily unavailable.",
    body: "We could not reach the registry just now. This is not a verdict on your code. Please try again in a minute.",
  },
};

export const VERIFY_STATES_SECTION = {
  eyebrow: "What you will see",
  title: "Four answers, never a guess.",
  lede: "The page always says plainly what it found, and what it cannot tell you.",
} as const;

export const HASH_HELP = {
  summary: "How to compare this with your copy",
  intro: "A SHA-256 fingerprint is a 64-character code worked out from every byte of a file. If your copy produces the same code, it is identical to the one we published. If even one character differs, the file has been changed.",
  windows: "Get-FileHash .\\your-file.pdf -Algorithm SHA256",
  unix: "shasum -a 256 your-file.pdf",
} as const;
