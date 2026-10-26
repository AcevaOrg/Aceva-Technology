import { PulseContextData } from "@/components/pulse/types";
import { distillTimelineText, distillBudgetText } from "./format";

/**
 * Unmistakable codebase signals: naming a language, the code itself, or a
 * legacy artefact. Any one of these on its own means a modernization project.
 */
const CODEBASE_SIGNAL =
  /\b(refactor(ing|ed|s)?|codebase|code base|transpile|transpilation|monolith|java|kotlin|objective-?c|\.net|legacy (code|codebase|app|application|system|platform|stack))\b/i;

/** Verbs that mean a migration only when something code-shaped is named too. */
const MODERNIZE_VERB =
  /\b(migrat(e|es|ing|ion)|upgrad(e|es|ing)|rewrit(e|es|ing)|moderni[sz](e|es|ing|ation))\b/i;

/** The something-code-shaped that `MODERNIZE_VERB` needs to count. */
const CODE_OBJECT =
  /\b(code|codebase|code base|stack|language|framework|version|api|apis|database|schema|architecture|library|dependencies|repo|repository|backend|front-?end)\b/i;

/**
 * True for a codebase-modernization project, as opposed to a project that
 * merely uses the word "upgrade".
 *
 * This replaces three near-identical copies of
 * `/\b(java|kotlin|refactor|migrate|codebase|legacy|upgrade|rewrite)\b/`, the
 * widest of which was tested ahead of every industry branch in
 * `getRecommendedModules`. "I want to upgrade my restaurant ordering website"
 * matched on "upgrade" alone, so a restaurant project was handed Java-to-Kotlin
 * transpilation, null-safety and async-refactoring modules — on screen, in the
 * saved record, in the lead email and in the .docx. "upgrade", "migrate",
 * "rewrite" and "modernize" are ordinary words for ordinary projects, so they
 * now only mean a code migration when the text also names something
 * code-shaped. Strictly narrower than what it replaces: everything it matches,
 * the old pattern matched too.
 */
export function isCodebaseModernization(text: string): boolean {
  return CODEBASE_SIGNAL.test(text) || (MODERNIZE_VERB.test(text) && CODE_OBJECT.test(text));
}

export interface EnrichedProjectContext {
  industryFocus: string;
  primaryIntent: string;
  projectScale: string;
  budgetAllocation: string;
  primaryGoals: string;
  targetTimeline: string;
}

/**
 * Calculate Project Scale (Small, Medium, Large) based on budget, timeline, user volume, and locations.
 */
export function calculateProjectScale(
  ctx: PulseContextData = {},
  answers: string[] = []
): string {
  const combinedText = [
    ctx.scale,
    ctx.business,
    ctx.timeline,
    ctx.intent,
    ...answers,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isHighBudget = /\b(50k|\$50|\$100|enterprise|100k|large budget|unlimited|high scale)\b/i.test(combinedText);
  const isLowBudget = /\b(under 10k|under \$10k|5k|small budget|minimal|bootstrap)\b/i.test(combinedText);
  const isMultiLocation = /\b(multiple|multi-branch|several|10\+|50\+|100\+|1000\+|enterprise|nationwide|global|many users|all locations)\b/i.test(combinedText);
  const isSingleLocation = /\b(single|one|1 location|small team|few users|solo|local shop)\b/i.test(combinedText);
  const isLongTimeline = /\b(6 months|1 year|long term|q3|q4|multi-phase)\b/i.test(combinedText);
  const isShortTimeline = /\b(1 month|2 weeks|asap|urgent|quick|immediate)\b/i.test(combinedText);

  let tier: "Small" | "Medium" | "Large" = "Medium";
  let tierReason = "";

  if (isHighBudget || isMultiLocation || (isLongTimeline && !isLowBudget)) {
    tier = "Large";
    tierReason = "Multi-location / high-volume operational scope with enterprise timeline and expanded user capacity.";
  } else if (isLowBudget || (isSingleLocation && isShortTimeline)) {
    tier = "Small";
    tierReason = "Targeted single-tier application for focused user group with streamlined deployment window.";
  } else {
    tier = "Medium";
    tierReason = "Commercial digital platform serving core business operations across active user and feature channels.";
  }

  return `${tier} — ${tierReason}`;
}

/**
 * Extract specific application features & functional capabilities for Primary Goals.
 */
export function extractPrimaryGoalFeatures(
  ctx: PulseContextData = {},
  answers: string[] = []
): string {
  const combinedText = [
    ctx.goals?.join(" "),
    ctx.intent,
    ctx.industry,
    ctx.business,
    ...answers,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const featureList: string[] = [];

  if (/\b(orders?|ordering|cart|menu)\b/i.test(combinedText)) {
    featureList.push("Digital Product/Menu Catalog & Cart Ordering Engine");
  }
  if (/\b(kitchen|kds|prep|dispatch)\b/i.test(combinedText)) {
    featureList.push("Kitchen Display System (KDS) & Real-time Queue Dispatch");
  }
  if (/\b(track|tracking|status|sms|notification|notifications)\b/i.test(combinedText)) {
    featureList.push("Live Order Progress Tracking & Automated SMS/Push Alerts");
  }
  if (/\b(mobile|apps?|application|applications|ios|android)\b/i.test(combinedText)) {
    featureList.push("iOS & Android Mobile Experience");
  }
  if (isCodebaseModernization(combinedText)) {
    featureList.push("Automated Code Migration, Null-Safety & Async Refactoring");
  }
  if (/\b(accounts?|users?|auth|authentication|login|profile)\b/i.test(combinedText)) {
    featureList.push("User Authentication Vault & Customer Self-Service Profile");
  }
  if (/\b(admin|dashboard|owner|management|analytics)\b/i.test(combinedText)) {
    featureList.push("Centralized Operational Admin Console & Real-time Revenue Telemetry");
  }
  if (/pay|checkout|stripe|billing/i.test(combinedText)) {
    featureList.push("Integrated Payment Gateway Checkout & Digital Invoicing");
  }
  if (/\b(milk|farms?|yield|dairy)\b/i.test(combinedText)) {
    featureList.push("Milk Production & Daily Yield Logging Vault");
    featureList.push("Distributor Distribution & Delivery Tracking Module");
  }

  if (featureList.length > 0) {
    return featureList.join("; ");
  }

  // Domain-specific feature fallbacks if user text was broad (e.g., "Yes I want all specified features")
  if (/\b(dairy|farms?|milk)\b/i.test(combinedText)) {
    return "Milk Production & Daily Yield Logging; Distributor Tracking Vault; Customer Delivery Ordering; Operational Management Dashboard.";
  }
  if (/\b(restaurants?|food)\b/i.test(combinedText)) {
    return "Online Ordering & Digital Menu Catalog; Kitchen Display System (KDS); Live Delivery Tracking; Owner Command Dashboard.";
  }

  return "Custom Digital Interface; Automated Workflow Pipeline; Multi-Role Access Control; Operational Analytics & Reporting.";
}

/**
 * Extract specific, context-rich project specifications preserving exact domain & intent.
 */
export function formatEnrichedProjectContext(
  ctx: PulseContextData = {},
  answers: string[] = []
): EnrichedProjectContext {
  const combinedText = [
    ctx.intent,
    ctx.industry,
    ctx.business,
    ctx.current,
    ctx.scale,
    ...answers,
  ]
    .filter(Boolean)
    .join(" ");

  const lower = combinedText.toLowerCase();

  // 1. Industry Focus Mapping (preserves specific domain)
  let industryFocus = "Business Services & Custom Software";
  if (/\b(restaurants?|food|cafe|dining|kitchen|takeaway|bakery)\b/i.test(lower)) {
    industryFocus = "Restaurant & Food Service Operations";
  } else if (/\b(dairy|farms?|cattle|milk|agriculture|livestock)\b/i.test(lower)) {
    industryFocus = "Dairy & Agricultural Operations";
  } else if (/\b(clinics?|health|healthcare|doctors?|medical|telehealth|hospital|dental|dentist|patients?)\b/i.test(lower)) {
    industryFocus = "Healthcare & Telehealth Services";
  } else if (/\b(e-?commerce|retail|shops?|stores?|boutique|merchandise)\b/i.test(lower)) {
    industryFocus = "E-Commerce & Retail Brand";
  } else if (/\b(real estate|property|properties|tenants?|landlord|realtor|leasing)\b/i.test(lower)) {
    industryFocus = "Real Estate & Property Management";
  } else if (/\b(logistics|fleet|delivery|deliveries|warehouse|freight|courier|transport)\b/i.test(lower)) {
    industryFocus = "Logistics & Transport Fleet";
  } else if (/\b(construction|contractors?|builder|renovation|field)\b/i.test(lower)) {
    industryFocus = "Construction & Field Contracting";
  } else if (/\b(education|school|university|academy|lms|courses?|tutor)\b/i.test(lower)) {
    industryFocus = "Education & E-Learning Platform";
  } else if (/\b(beauty|salon|spa|barber|grooming)\b/i.test(lower)) {
    industryFocus = "Beauty & Wellness Operations";
  } else if (/\b(fitness|gym|workout|trainer|sports)\b/i.test(lower)) {
    industryFocus = "Fitness & Sports Center";
  } else if (/\b(law|lawyer|lawyers|legal|attorney|consulting|agency|firm)\b/i.test(lower)) {
    industryFocus = "Professional Services & Consulting Practice";
  } else if (/\b(events?|tickets?|ticketing|conference|festival|venue)\b/i.test(lower)) {
    industryFocus = "Events & Ticketing Operations";
  } else if (/\b(finance|financial|fintech|bank|banking|microfinance|loans?|wallet)\b/i.test(lower)) {
    industryFocus = "Financial Services & Fintech";
  } else if (isCodebaseModernization(lower)) {
    industryFocus = "Software Engineering & Codebase Refactoring";
  } else if (ctx.industry && ctx.industry !== "General Business") {
    industryFocus = ctx.industry;
  }

  // 2. Primary Intent / Product Purpose
  let primaryIntent = "Custom Platform & Digital System Architecture";
  if (/\b(mobile app|mobile apps|ios|android|native app)\b/i.test(lower)) {
    primaryIntent = "Custom Mobile Application (iOS & Android)";
  } else if (isCodebaseModernization(lower)) {
    primaryIntent = "Codebase Modernization & Language Migration";
  } else if (/\b(e-?commerce|sell|selling|online store|checkout)\b/i.test(lower)) {
    primaryIntent = "E-Commerce Storefront & Transaction Engine";
  } else if (/\b(automate|automation|workflow|internal tool|dashboard)\b/i.test(lower)) {
    primaryIntent = "Automated Operational Workflow & Admin Portal";
  } else if (/\b(website|landing page|web platform)\b/i.test(lower)) {
    primaryIntent = "Custom Web Platform & Customer Portal";
  } else if (ctx.intent && ctx.intent !== "Start something new" && ctx.intent !== "Custom Solution") {
    primaryIntent = ctx.intent;
  }

  // 3. Project Scale (Small / Medium / Large based on budget, timeline, users, locations)
  const projectScale = calculateProjectScale(ctx, answers);

  // 4. Primary Goals (Exact Application Features & Capabilities)
  const primaryGoals = extractPrimaryGoalFeatures(ctx, answers);

  // 5. Target Timeline
  //
  // `ctx.timeline` wins when it is there: the wizard distils it from the
  // timeline half of the step-5 answer, so it is the value the visitor actually
  // gave for this question. Scanning `answers` stays as the fallback for a
  // record saved before the field existed, or for a free-chat session.
  let targetTimeline = "To be aligned upon technical discovery review";
  if (ctx.timeline) {
    targetTimeline = distillTimelineText(ctx.timeline);
  } else {
    for (const text of [...answers].reverse()) {
      if (!text) continue;
      if (/\b(months?|weeks?|quarters?|asap|urgent|flexible|years?|immediately|soon|q[1-4])\b/i.test(text)) {
        targetTimeline = distillTimelineText(text);
        break;
      }
    }
  }

  // 6. Budget Allocation
  //
  // Same precedence, and here the fallback was actively wrong: it scanned
  // `answers` front to back, and its pattern included `k\b`, which matches the
  // final letter of "track", "work", "ask" and "week". A step-2 friction answer
  // like "keeping track of orders is chaotic" therefore became the budget line
  // in the blueprint, the lead email and the .docx. The scan now runs newest
  // first, like the timeline above, so it lands on the step-5 answer.
  let budgetAllocation = "To be discussed directly with the ACEVA engineering team";
  if (ctx.budget) {
    budgetAllocation = distillBudgetText(ctx.budget);
  } else {
    for (const text of [...answers].reverse()) {
      if (!text) continue;
      if (/\$|\b(budget|cost|costs|dollars?|usd|price|pricing|\d+\s*k|discuss|limit|range|flexible|aceva)\b/i.test(text)) {
        budgetAllocation = distillBudgetText(text);
        break;
      }
    }
  }

  return {
    industryFocus,
    primaryIntent,
    projectScale,
    budgetAllocation,
    primaryGoals,
    targetTimeline,
  };
}

/**
 * The recommended architecture for a discovered project.
 *
 * Single source of truth for the Stage 3 UI panel, the saved direction record,
 * the lead email, the .docx blueprint and the PULSE ID lookup. It used to be two
 * near-identical regex ladders — this one plus a `getConciseUIModules` for the
 * UI — which drifted: the concise ladder had a dairy branch this one lacked and
 * this one had a fintech branch the concise one lacked. A dairy project showed
 * five dairy modules on screen while the client's emailed blueprint listed the
 * generic web platform, and a fintech project got the reverse. One ladder means
 * the screen and the deliverable cannot disagree.
 */
export function getRecommendedModules(
  industry?: string,
  ctx?: PulseContextData,
  answers: string[] = []
): string[] {
  const combinedText = [
    industry,
    ctx?.intent,
    ctx?.industry,
    ctx?.business,
    ctx?.current,
    ctx?.scale,
    ...answers,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isMobile = /\b(mobile|apps?|application|applications|ios|android|native)\b/i.test(combinedText);
  const isRefactor = isCodebaseModernization(combinedText);
  const isRestaurant = /\b(restaurants?|food|cafe|dining|kitchen|takeaway|bakery)\b/i.test(combinedText);
  const isDairy = /\b(dairy|farms?|milk|cattle|agriculture)\b/i.test(combinedText);
  const isHealthcare = /\b(clinics?|health|healthcare|doctors?|medical|telehealth|hospital|patients?)\b/i.test(combinedText);
  const isCommerce = /\b(e-?commerce|retail|shops?|stores?|sell|selling|checkout)\b/i.test(combinedText);
  const isRealEstate = /\b(real estate|property|properties|tenants?|landlord|realtor|leasing)\b/i.test(combinedText);
  const isLogistics = /\b(logistics|fleet|delivery|deliveries|warehouse|freight|courier|transport)\b/i.test(combinedText);
  const isFinance = /\b(finance|financial|fintech|microfinance|bank|banking|loans?|wallet|credit)\b/i.test(combinedText);

  // 1. Refactoring & Code Modernization Projects (e.g. Java to Kotlin)
  if (isRefactor) {
    return [
      "Codebase Audit & Dependency Mapping — Automated AST analysis, legacy dependency inventory, and target framework compatibility matrix.",
      "Automated Syntax & Language Migration Pipeline — Transpilation/refactoring pipeline, null-safety enforcement, async execution model, and code cleanup.",
      "API Contract & Interface Preservation Harness — Schema verification, REST/gRPC endpoint backward compatibility checks, and payload validation.",
      "Regression Test & Continuous Integration Suite — Unit/integration test migration, automated test coverage telemetry, and CI/CD build pipeline integration.",
      "Performance Telemetry & Runtime Execution Metrics — Comparative benchmark analysis, memory footprint profiling, and execution latency monitoring.",
    ];
  }

  // 2. Dairy & Agricultural Operations
  if (isDairy) {
    return [
      "Daily Yield & Milk Production Logging Vault — Per-animal and per-batch yield capture, shift logging, wastage records, and production history.",
      "Distributor Routing & Delivery Tracking Module — Route assignment, distributor allocation, dispatch scheduling, and proof-of-delivery capture.",
      "Direct Customer Ordering & Subscription Catalog — Recurring subscription plans, one-off ordering, delivery windows, and customer cart engine.",
      "Automated Dispatch & Delivery Notification Service — Automated SMS/push dispatch alerts, delivery status updates, and missed-delivery escalation.",
      "Farm Operations & Yield Analytics Console — Multi-location herd and inventory management, yield trend analytics, and operational reporting.",
    ];
  }

  // 3. Restaurant & Food Service Operations
  if (isRestaurant) {
    return [
      isMobile
        ? "Mobile Application (iOS & Android) — Menu catalog, cart management, item customization, and instant checkout."
        : "Digital Ordering & Menu Catalog Engine — Responsive web menu catalog, cart management, dietary tags, and direct online ordering.",
      "Kitchen Display System (KDS) & Order Pipeline — Real-time kitchen order queue, ticket status state machine, and prep timer controls.",
      "Order Tracking & Automated Customer Notifications — Real-time order progress tracking, SMS/push status alerts, and delivery ETA updates.",
      "Customer Account & Loyalty Management — User authentication (OAuth/JWT), order history, saved addresses, and loyalty rewards.",
      "Multi-Branch Admin & Inventory Dashboard — Multi-location management console, item availability toggles, sales reporting, and revenue analytics.",
    ];
  }

  // 4. Healthcare & Telehealth
  if (isHealthcare) {
    return [
      "Patient Telehealth & Appointment Booking Portal — Patient registration, doctor availability calendar, online booking, and video consultation interface.",
      "Practitioner Schedule & Consultation Queue Manager — Doctor appointment calendar, patient queue control, and consultation notes repository.",
      "Encrypted Health Records & Prescription Vault — Secure patient record storage, digital prescription management, and audited access controls.",
      "Automated Patient Notification & Reminder Service — Automated SMS/email appointment reminders, pre-visit instructions, and follow-up alerts.",
      "Clinic Operations & Revenue Analytics Dashboard — Appointment throughput analytics, billing/claims tracking, and operational reporting.",
    ];
  }

  // 5. E-Commerce & Retail
  if (isCommerce) {
    return [
      isMobile
        ? "Mobile Shopping Application (iOS & Android) — Mobile product catalog, cart engine, biometric checkout, and push notification marketing."
        : "High-Conversion Custom Storefront — Responsive product catalog, dynamic search & filtering, cart engine, and optimized checkout flow.",
      "Multi-Warehouse Inventory & SKU Sync Engine — Real-time inventory tracking, low-stock alerts, multi-warehouse sync, and supplier management.",
      "Payment Gateway & Financial Settlement Engine — Integrated third-party payment gateway, multi-currency support, and refund processing.",
      "Order Fulfillment & Shipping Logistics Tracker — Shipping carrier API integration, label generation, and live package tracking.",
      "Merchant Admin & Funnel Analytics Dashboard — Product management console, customer order management, conversion funnels, and revenue metrics.",
    ];
  }

  // 6. Real Estate & Property Management
  if (isRealEstate) {
    return [
      "Property Listing Portal & Showcase Engine — Interactive property listings, search filters, high-resolution media galleries, and virtual tour scheduling.",
      "Tenant Application & Screening Workflow — Online lease applications, document upload, credit/background check integration, and approval workflow.",
      "Automated Rent Collection & Payment Gateway — Recurring rent auto-pay, online portal payments, invoice generation, and balance ledger.",
      "Maintenance Request & Contractor Dispatch System — Tenant maintenance ticketing, photo uploads, contractor dispatch, and repair status tracking.",
      "Portfolio Yield & Occupancy Analytics Dashboard — Multi-property occupancy metrics, financial yield reports, and landlord accounting dashboard.",
    ];
  }

  // 7. Logistics & Transport Fleet
  if (isLogistics) {
    return [
      "Real-Time GPS Fleet & Dispatch Control Tower — Live vehicle location tracking, interactive map dispatch, job assignment, and route monitoring.",
      "Driver Mobile Application (iOS & Android) — Driver task queue, turn-by-turn navigation, digital proof-of-delivery (e-signature/photo), and status toggles.",
      "Automated Route Optimization & Fuel Calculator — Algorithmic multi-stop route optimization, distance calculation, and fuel cost tracking.",
      "Shipment Handoff & Customer Milestone Alerts — Live tracking links for customers, automated SMS/email milestone alerts, and delivery confirmations.",
      "Logistics Margin & Fleet Utilization Dashboard — Vehicle maintenance logs, driver performance metrics, fuel efficiency analytics, and margin reporting.",
    ];
  }

  // 8. Financial Services & Fintech
  if (isFinance) {
    return [
      "Digital Customer Onboarding & KYC Verification — Identity verification (ID scan/liveness test), document upload, and compliance audit trail.",
      "Secure Customer Account & Wallet Dashboard — Multi-asset wallet balances, transaction history, fund transfers, and security controls.",
      "Payment Gateway & Ledger Settlement Engine — Automated payment processing, bank API integrations, transaction ledger, and payout distribution.",
      "Loan/Credit Application & Approval Workflow — Credit risk scoring, automated loan approval rules, repayment schedules, and collection tracking.",
      "Financial Compliance & Risk Audit Dashboard — Real-time fraud detection alerts, transaction monitoring, and regulatory audit reporting.",
    ];
  }

  // 9. General Mobile App Requirement
  if (isMobile) {
    return [
      "Mobile Client Application (iOS & Android) — Responsive mobile user interface, offline data caching, and device feature access.",
      "Mobile App Backend & API Gateway — RESTful/GraphQL API layer, business logic processing, real-time data sync, and database access.",
      "User Authentication & Profile Management — Secure login (OAuth/JWT/Biometrics), user profile management, and role-based permissions.",
      "Push Notification & Messaging Service — Targeted push notification dispatcher, in-app messaging, and automated event triggers.",
      "Mobile Analytics & Performance Telemetry — App usage tracking, crash reporting, session analytics, and user engagement monitoring.",
    ];
  }

  // 10. Standard Custom Web / Software Platform
  return [
    "Core Web Application Interface & User Portal — Responsive web frontend, intuitive user interface, interactive workflow forms, and customer portal.",
    "Application API & Business Logic Server — RESTful/GraphQL backend services, business rules engine, micro-service architecture, and data persistence.",
    "Identity & Access Control (RBAC) Vault — User authentication (JWT/OAuth2), profile management, multi-tier staff permissions, and role access control.",
    "Notification & Automated Communication Engine — Transactional email dispatcher, SMS alert integration, and event-driven messaging service.",
    "Operational Admin Console & Reporting Dashboard — Multi-tenant admin management panel, system metrics monitoring, and operational BI reporting.",
  ];
}
