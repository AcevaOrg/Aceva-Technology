import type {
  CategorySpec,
  DocumentCategory,
  FieldOption,
  FieldSpec,
  HierarchyLevel,
} from "./types";
import { DOCUMENT_CATEGORY_KEYS, HIERARCHY_LEVELS } from "./types";

/**
 * The document registry's single schema. The admin editor renders its inputs from these
 * specs, the server validates against them, and the public pages show only the fields marked
 * `public: true` — so a field added here appears in all three places and can never be shown
 * publicly by accident.
 */

const opts = (...pairs: Array<[string, string]>): FieldOption[] => pairs.map(([value, label]) => ({ value, label }));

/** Appended to every category: a private scratchpad that is never shown outside /admin. */
const INTERNAL_NOTES: FieldSpec = {
  key: "internal_notes",
  label: "Internal notes",
  type: "textarea",
  group: "Internal",
  maxLength: 2000,
  public: false,
  placeholder: "Anything the team should know. Never shown publicly.",
};

/** Admin-facing names for the team levels. `Record<HierarchyLevel, …>` makes a new level fail to compile until it is named. */
const HIERARCHY_LABELS: Record<HierarchyLevel, string> = {
  leadership: "Leadership",
  management: "Management",
  team_lead: "Team lead",
  member: "Team member",
  trainee: "Intern / trainee",
};

const CURRENCIES = opts(
  ["PKR", "PKR — Pakistani rupee"],
  ["USD", "USD — US dollar"],
  ["EUR", "EUR — Euro"],
  ["GBP", "GBP — Pound sterling"],
  ["AED", "AED — UAE dirham"],
  ["SAR", "SAR — Saudi riyal"],
  ["CAD", "CAD — Canadian dollar"],
  ["AUD", "AUD — Australian dollar"],
);

export const CATEGORIES: Record<DocumentCategory, CategorySpec> = {
  /* ------------------------------ Financial reports ------------------------------ */
  financial_report: {
    key: "financial_report",
    label: "Financial report",
    plural: "Financial reports",
    slug: "financial-reports",
    eyebrow: "Financial reports",
    blurb: "Annual statements, audits and filings. Published when we choose to, so the numbers are never a surprise.",
    adminHelp: "Annual and periodic statements, audit reports and filings. Defaults to private until you publish it.",
    personal: false,
    verifiable: false,
    allowedVisibility: ["public", "unlisted", "private"],
    defaultVisibility: "private",
    hasPhoto: false,
    photoRequired: false,
    fileRequired: true,
    referencePrefix: "ACV/FIN",
    base: {
      title: { label: "Report title", required: true, placeholder: "FY 2025–26 Audited Financial Statements" },
      summary: { label: "Summary", required: false, placeholder: "One or two sentences on what this report covers." },
      holderName: { label: "Entity", required: false, hidden: true },
      referenceNo: { label: "Report reference", required: false, placeholder: "ACV/FIN/2026/001" },
      issuedOn: { label: "Published on", required: true },
      expiresOn: { label: "Valid until", required: false, hidden: true },
    },
    fields: [
      {
        key: "report_type",
        label: "Report type",
        type: "select",
        group: "Report",
        required: true,
        public: true,
        options: opts(
          ["annual_report", "Annual report"],
          ["audited_statements", "Audited financial statements"],
          ["quarterly_report", "Quarterly report"],
          ["half_year_report", "Half-year report"],
          ["tax_filing", "Tax return / filing"],
          ["audit_report", "Audit report"],
          ["budget_forecast", "Budget & forecast"],
          ["investor_update", "Investor update"],
          ["other", "Other"],
        ),
      },
      {
        key: "fiscal_year",
        label: "Fiscal year",
        type: "text",
        group: "Report",
        required: true,
        public: true,
        maxLength: 20,
        placeholder: "2025–26",
      },
      {
        key: "period",
        label: "Reporting period",
        type: "select",
        group: "Report",
        required: true,
        public: true,
        options: opts(
          ["full_year", "Full year"],
          ["h1", "First half"],
          ["h2", "Second half"],
          ["q1", "Q1"],
          ["q2", "Q2"],
          ["q3", "Q3"],
          ["q4", "Q4"],
          ["custom", "Custom range"],
        ),
      },
      {
        key: "period_start",
        label: "Period start",
        type: "date",
        group: "Report",
        public: true,
        requiredWhen: { key: "period", equals: "custom" },
      },
      {
        key: "period_end",
        label: "Period end",
        type: "date",
        group: "Report",
        public: true,
        requiredWhen: { key: "period", equals: "custom" },
      },
      { key: "currency", label: "Reporting currency", type: "select", group: "Report", required: true, public: true, options: CURRENCIES },
      { key: "audited", label: "Independently audited", type: "boolean", group: "Assurance", public: true, defaultValue: false },
      {
        key: "auditor",
        label: "Auditor",
        type: "text",
        group: "Assurance",
        public: true,
        maxLength: 160,
        placeholder: "Audit firm name",
        showWhen: { key: "audited", equals: true },
        requiredWhen: { key: "audited", equals: true },
      },
      { key: "prepared_by", label: "Prepared by", type: "text", group: "Assurance", public: true, maxLength: 160, placeholder: "Finance team / accountant" },
      {
        key: "highlights",
        label: "Highlights",
        type: "textarea",
        group: "Assurance",
        public: true,
        maxLength: 1200,
        help: "Optional key figures or notes shown on the public card.",
      },
      INTERNAL_NOTES,
    ],
    cardMeta: ["report_type", "fiscal_year", "period"],
  },

  /* ------------------------------ Company identity ------------------------------ */
  company_identity: {
    key: "company_identity",
    label: "Company identity document",
    plural: "Company identity",
    slug: "company-identity",
    eyebrow: "Company identity",
    blurb: "Who we are on paper: registration, tax standing, licences and the brand assets that represent us.",
    adminHelp: "Registration and tax documents, licences, profiles and brand assets.",
    personal: false,
    verifiable: false,
    allowedVisibility: ["public", "unlisted", "private"],
    defaultVisibility: "public",
    hasPhoto: false,
    photoRequired: false,
    fileRequired: true,
    referencePrefix: "ACV/ID",
    base: {
      title: { label: "Document title", required: true, placeholder: "Certificate of Incorporation" },
      summary: { label: "Summary", required: false, placeholder: "What this document establishes." },
      holderName: { label: "Legal entity", required: false, placeholder: "ACEVA Technology (Private) Limited" },
      referenceNo: { label: "Registration / licence no.", required: false, placeholder: "0123456-7" },
      issuedOn: { label: "Issued on", required: false },
      expiresOn: { label: "Valid until", required: false, help: "Leave empty for documents that do not expire." },
    },
    fields: [
      {
        key: "identity_type",
        label: "Document type",
        type: "select",
        group: "Document",
        required: true,
        public: true,
        options: opts(
          ["incorporation_certificate", "Certificate of incorporation"],
          ["tax_registration", "Tax registration"],
          ["business_licence", "Business licence"],
          ["memorandum_articles", "Memorandum & articles"],
          ["company_profile", "Company profile"],
          ["brand_guidelines", "Brand guidelines"],
          ["logo_pack", "Logo pack"],
          ["letterhead", "Letterhead template"],
          ["bank_letter", "Bank account letter"],
          ["address_proof", "Address proof"],
          ["other", "Other"],
        ),
      },
      { key: "issuing_authority", label: "Issuing authority", type: "text", group: "Document", public: true, maxLength: 160, placeholder: "Securities & Exchange Commission" },
      { key: "jurisdiction", label: "Jurisdiction", type: "text", group: "Document", public: true, maxLength: 120, placeholder: "Pakistan" },
      { key: "registered_address", label: "Registered address", type: "textarea", group: "Document", public: true, maxLength: 400 },
      INTERNAL_NOTES,
    ],
    cardMeta: ["identity_type", "issuing_authority", "jurisdiction"],
  },

  /* ------------------------------ Certifications ------------------------------ */
  certification: {
    key: "certification",
    label: "Certification",
    plural: "Certifications",
    slug: "certifications",
    eyebrow: "Certifications",
    blurb: "Standards we hold and certificates we issue. Every one carries a QR code anyone can scan to confirm it is real.",
    adminHelp: "Certifications held by ACEVA and certificates ACEVA issues to people. A QR verification code is created automatically.",
    personal: false,
    verifiable: true,
    allowedVisibility: ["public", "unlisted", "private"],
    defaultVisibility: "public",
    hasPhoto: false,
    photoRequired: false,
    fileRequired: true,
    referencePrefix: "ACV/CERT",
    base: {
      title: { label: "Certification title", required: true, placeholder: "ISO/IEC 27001:2022 — Information Security" },
      summary: { label: "Summary", required: false, placeholder: "What was achieved or completed." },
      holderName: { label: "Awarded to", required: true, placeholder: "ACEVA Technology — or the recipient's full name" },
      referenceNo: { label: "Certificate no.", required: true, placeholder: "ACV/CERT/2026/0042" },
      issuedOn: { label: "Issued on", required: true },
      expiresOn: { label: "Valid until", required: false, help: "Leave empty for certificates that never expire." },
    },
    fields: [
      {
        key: "direction",
        label: "Held or issued",
        type: "select",
        group: "Certificate",
        required: true,
        public: true,
        options: opts(["held", "Held by ACEVA"], ["issued", "Issued by ACEVA"]),
      },
      { key: "issuing_body", label: "Issuing body", type: "text", group: "Certificate", required: true, public: true, maxLength: 160, placeholder: "ACEVA Technology / BSI / AWS" },
      { key: "standard_scope", label: "Standard or scope", type: "text", group: "Certificate", public: true, maxLength: 240, placeholder: "Software design, development and support" },
      { key: "level", label: "Level or grade", type: "text", group: "Certificate", public: true, maxLength: 80, placeholder: "Distinction / Level 2" },
      { key: "skills", label: "Skills covered", type: "tags", group: "Certificate", public: true, maxLength: 40, help: "Up to 12 short tags, comma separated." },
      { key: "credential_url", label: "External credential URL", type: "url", group: "Certificate", public: true, maxLength: 300, placeholder: "https://" },
      INTERNAL_NOTES,
    ],
    cardMeta: ["direction", "issuing_body", "level"],
  },

  /* ------------------------------ Team ------------------------------ */
  // The key stays `program_record` (it is stored in the database and in printed QR codes); only the
  // wording changed when the category grew from "interns and programs" into the whole team.
  program_record: {
    key: "program_record",
    label: "Team member",
    plural: "Team",
    slug: "team",
    eyebrow: "Team",
    blurb: "The people behind ACEVA, from leadership to interns, shown with who they report to. Listed only with their consent.",
    adminHelp:
      "Team members at every level, from leadership to interns. Public listing needs the person's written consent; otherwise keep the profile unlisted or private.",
    personal: true,
    verifiable: true,
    allowedVisibility: ["public", "unlisted", "private"],
    defaultVisibility: "unlisted",
    hasPhoto: true,
    photoRequired: false,
    fileRequired: false,
    referencePrefix: "ACV/PRG",
    base: {
      title: { label: "Profile headline", required: true, placeholder: "Head of Engineering" },
      summary: { label: "Summary", required: false, placeholder: "A line about their work with us." },
      holderName: { label: "Full name", required: true, placeholder: "Aisha Khan" },
      referenceNo: { label: "Staff / person ID", required: false, placeholder: "ACV/PRG/2026/014" },
      issuedOn: { label: "Profile created on", required: false },
      expiresOn: { label: "Valid until", required: false, hidden: true },
    },
    fields: [
      {
        key: "hierarchy_level",
        label: "Level in the team",
        type: "select",
        group: "Position",
        required: true,
        public: true,
        options: HIERARCHY_LEVELS.map((value) => ({ value, label: HIERARCHY_LABELS[value] })),
        help: "Where they sit in the team. The public Team section lists the levels in this order.",
      },
      {
        key: "reports_to",
        label: "Reports to",
        type: "text",
        group: "Position",
        public: true,
        maxLength: 120,
        placeholder: "Their manager's full name",
        help: "Used to show reporting lines.",
      },
      { key: "role_title", label: "Role / job title", type: "text", group: "Position", required: true, public: true, maxLength: 120, placeholder: "Frontend Engineer" },
      { key: "department", label: "Department / team", type: "text", group: "Position", public: true, maxLength: 120, placeholder: "Engineering" },
      {
        key: "record_kind",
        label: "Relationship",
        type: "select",
        group: "Position",
        required: true,
        public: true,
        options: opts(
          ["intern", "Intern"],
          ["employee", "Employee"],
          ["trainee", "Trainee"],
          ["fellow", "Fellow"],
          ["apprentice", "Apprentice"],
          ["volunteer", "Volunteer"],
          ["contractor", "Contractor"],
          ["ambassador", "Ambassador"],
          ["program_participant", "Program participant"],
        ),
      },
      { key: "program_name", label: "Program (interns and fellows)", type: "text", group: "Program", public: true, maxLength: 160, placeholder: "Summer Internship 2026" },
      { key: "cohort", label: "Cohort", type: "text", group: "Program", public: true, maxLength: 80, placeholder: "Cohort 03" },
      { key: "start_date", label: "Start date", type: "date", group: "Dates & status", required: true, public: true },
      { key: "end_date", label: "End date", type: "date", group: "Dates & status", public: true },
      {
        key: "record_status",
        label: "Status",
        type: "select",
        group: "Dates & status",
        required: true,
        public: true,
        options: opts(
          ["active", "Active"],
          ["completed", "Completed"],
          ["alumni", "Alumni"],
          ["on_leave", "On leave"],
          ["withdrawn", "Withdrawn"],
          ["terminated", "Terminated"],
        ),
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "select",
        group: "Dates & status",
        public: true,
        options: opts(
          ["completed_successfully", "Completed successfully"],
          ["with_distinction", "Completed with distinction"],
          ["converted_full_time", "Converted to full-time"],
          ["certificate_issued", "Certificate issued"],
          ["not_applicable", "Not applicable"],
        ),
      },
      { key: "bio", label: "Short bio", type: "textarea", group: "Profile", public: true, maxLength: 600 },
      { key: "skills", label: "Skills", type: "tags", group: "Profile", public: true, maxLength: 40, help: "Up to 12 short tags, comma separated." },
      { key: "linkedin_url", label: "LinkedIn URL", type: "url", group: "Profile", public: true, maxLength: 300, placeholder: "https://www.linkedin.com/in/…" },
      { key: "contact_email", label: "Contact email", type: "email", group: "Private contact", public: false, maxLength: 200, help: "Never shown publicly." },
      {
        key: "consent_to_publish",
        label: "Consent to be listed publicly",
        type: "boolean",
        group: "Consent",
        public: false,
        defaultValue: false,
        help: "Required before a record can be Public. Confirm the person agreed in writing.",
      },
      {
        key: "show_photo",
        label: "Show photo on public pages",
        type: "boolean",
        group: "Consent",
        public: false,
        defaultValue: false,
      },
      INTERNAL_NOTES,
    ],
    cardMeta: ["hierarchy_level", "role_title", "department"],
  },

  /* ------------------------------ Experience letters ------------------------------ */
  experience_letter: {
    key: "experience_letter",
    label: "Experience letter",
    plural: "Experience letters",
    slug: "experience-letters",
    eyebrow: "Experience letters",
    blurb: "Letters we have issued to staff and interns. Employers can confirm each one by scanning its QR code.",
    adminHelp: "Upload the signed letter. It stays unlisted: the QR code reveals only name, role, dates and status.",
    personal: true,
    verifiable: true,
    allowedVisibility: ["unlisted", "private"],
    defaultVisibility: "unlisted",
    hasPhoto: false,
    photoRequired: false,
    fileRequired: true,
    referencePrefix: "ACV/EL",
    base: {
      title: { label: "Letter title", required: true, placeholder: "Experience letter — Software Engineer" },
      summary: { label: "Summary", required: false, hidden: true },
      holderName: { label: "Employee / intern name", required: true, placeholder: "Bilal Ahmed" },
      referenceNo: { label: "Letter reference", required: true, placeholder: "ACV/EL/2026/0007" },
      issuedOn: { label: "Date of issue", required: true },
      expiresOn: { label: "Valid until", required: false, hidden: true },
    },
    fields: [
      { key: "designation", label: "Designation", type: "text", group: "Employment", required: true, public: true, maxLength: 120, placeholder: "Software Engineer" },
      { key: "department", label: "Department", type: "text", group: "Employment", public: true, maxLength: 120 },
      {
        key: "employment_type",
        label: "Employment type",
        type: "select",
        group: "Employment",
        required: true,
        public: true,
        options: opts(
          ["full_time", "Full-time"],
          ["part_time", "Part-time"],
          ["internship", "Internship"],
          ["contract", "Contract"],
          ["freelance", "Freelance"],
        ),
      },
      { key: "start_date", label: "Start date", type: "date", group: "Employment", required: true, public: true },
      { key: "currently_employed", label: "Currently employed", type: "boolean", group: "Employment", public: true, defaultValue: false },
      {
        key: "end_date",
        label: "End date",
        type: "date",
        group: "Employment",
        public: true,
        showWhen: { key: "currently_employed", equals: false },
        requiredWhen: { key: "currently_employed", equals: false },
      },
      { key: "signatory_name", label: "Signed by", type: "text", group: "Issuer", required: true, public: true, maxLength: 120, placeholder: "Full name of the signatory" },
      { key: "signatory_title", label: "Signatory title", type: "text", group: "Issuer", public: true, maxLength: 120, placeholder: "Head of People" },
      { key: "responsibilities", label: "Responsibilities", type: "textarea", group: "Letter content", public: false, maxLength: 1200, help: "For the team's record. Not shown on the verify page." },
      { key: "remarks", label: "Remarks", type: "textarea", group: "Letter content", public: false, maxLength: 800 },
      { key: "contact_email", label: "Contact email", type: "email", group: "Private contact", public: false, maxLength: 200, help: "Never shown publicly." },
      INTERNAL_NOTES,
    ],
    cardMeta: ["designation", "employment_type"],
  },
};

export const CATEGORY_LIST: readonly CategorySpec[] = DOCUMENT_CATEGORY_KEYS.map((key) => CATEGORIES[key]);

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return typeof value === "string" && (DOCUMENT_CATEGORY_KEYS as readonly string[]).includes(value);
}

export function getCategory(key: DocumentCategory): CategorySpec {
  return CATEGORIES[key];
}

/** Resolves a `/documents` anchor or `?category=` slug back to its category. */
export function categoryFromSlug(slug: string): CategorySpec | undefined {
  return CATEGORY_LIST.find((category) => category.slug === slug);
}

/** Keys of `data` values that may appear on public surfaces for this category. */
export function publicFieldKeys(category: DocumentCategory): string[] {
  return CATEGORIES[category].fields.filter((field) => field.public).map((field) => field.key);
}

/** Human label for a stored select value, falling back to the raw value. */
export function optionLabel(category: DocumentCategory, fieldKey: string, value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const field = CATEGORIES[category].fields.find((f) => f.key === fieldKey);
  return field?.options?.find((option) => option.value === value)?.label ?? value;
}
