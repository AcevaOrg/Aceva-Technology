import { PulseContextData } from "@/components/pulse/types";
import { cleanUserMappedValue, distillTimelineText, distillBudgetText } from "./format";

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

  if (/order|cart|menu|ordering/i.test(combinedText)) {
    featureList.push("Digital Product/Menu Catalog & Cart Ordering Engine");
  }
  if (/kitchen|kds|prep|dispatch/i.test(combinedText)) {
    featureList.push("Kitchen Display System (KDS) & Real-time Queue Dispatch");
  }
  if (/track|status|sms|notification/i.test(combinedText)) {
    featureList.push("Live Order Progress Tracking & Automated SMS/Push Alerts");
  }
  if (/mobile|app|ios|android/i.test(combinedText)) {
    featureList.push("Native iOS & Android Mobile User Experience");
  }
  if (/refactor|java|kotlin|codebase|migrate/i.test(combinedText)) {
    featureList.push("Automated Code Migration, Null-Safety, & Coroutine Async Refactoring");
  }
  if (/account|user|auth|login|profile/i.test(combinedText)) {
    featureList.push("User Authentication Vault & Customer Self-Service Profile");
  }
  if (/admin|dashboard|owner|management|analytics/i.test(combinedText)) {
    featureList.push("Centralized Operational Admin Console & Real-time Revenue Telemetry");
  }
  if (/pay|checkout|stripe|billing/i.test(combinedText)) {
    featureList.push("Integrated Payment Gateway Checkout & Digital Invoicing");
  }
  if (/milk|farm|yield|dairy/i.test(combinedText)) {
    featureList.push("Milk Production & Daily Yield Logging Vault");
    featureList.push("Distributor Distribution & Delivery Tracking Module");
  }

  if (featureList.length > 0) {
    return featureList.join("; ");
  }

  // Domain-specific feature fallbacks if user text was broad (e.g., "Yes I want all specified features")
  if (/dairy|farm|milk/i.test(combinedText)) {
    return "Milk Production & Daily Yield Logging; Distributor Tracking Vault; Customer Delivery Ordering; Operational Management Dashboard.";
  }
  if (/restaurant|food/i.test(combinedText)) {
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
  if (/restaurant|food|cafe|dining|kitchen|takeaway|bakery/i.test(lower)) {
    industryFocus = "Restaurant & Food Service Operations";
  } else if (/dairy|farm|cattle|milk|agriculture|livestock/i.test(lower)) {
    industryFocus = "Dairy & Agricultural Operations";
  } else if (/clinic|health|doctor|medical|telehealth|hospital|dental|patient/i.test(lower)) {
    industryFocus = "Healthcare & Telehealth Services";
  } else if (/e-?commerce|retail|shop|store|boutique|merchandise/i.test(lower)) {
    industryFocus = "E-Commerce & Retail Brand";
  } else if (/real estate|property|tenant|landlord|realtor|leasing/i.test(lower)) {
    industryFocus = "Real Estate & Property Management";
  } else if (/logistics|fleet|delivery|warehouse|freight|courier|transport/i.test(lower)) {
    industryFocus = "Logistics & Transport Fleet";
  } else if (/construction|contractor|builder|renovation|field/i.test(lower)) {
    industryFocus = "Construction & Field Contracting";
  } else if (/education|school|university|academy|lms|course|tutor/i.test(lower)) {
    industryFocus = "Education & E-Learning Platform";
  } else if (/beauty|salon|spa|barber|grooming/i.test(lower)) {
    industryFocus = "Beauty & Wellness Operations";
  } else if (/fitness|gym|workout|trainer|sports/i.test(lower)) {
    industryFocus = "Fitness & Sports Center";
  } else if (/law|legal|attorney|consulting|agency|firm/i.test(lower)) {
    industryFocus = "Professional Services & Consulting Practice";
  } else if (/event|ticket|conference|festival|show/i.test(lower)) {
    industryFocus = "Events & Ticketing Operations";
  } else if (/finance|fintech|bank|microfinance|loan|wallet/i.test(lower)) {
    industryFocus = "Financial Services & Fintech";
  } else if (/java|kotlin|refactor|migrate|codebase|legacy|upgrade|rewrite/i.test(lower)) {
    industryFocus = "Software Engineering & Codebase Refactoring";
  } else if (ctx.industry && ctx.industry !== "General Business") {
    industryFocus = ctx.industry;
  }

  // 2. Primary Intent / Product Purpose
  let primaryIntent = "Custom Platform & Digital System Architecture";
  if (/mobile app|ios|android|native app/i.test(lower)) {
    primaryIntent = "Custom Mobile Application (iOS & Android)";
  } else if (/java|kotlin|refactor|migrate|codebase|legacy/i.test(lower)) {
    primaryIntent = "Codebase Modernization & Language Migration";
  } else if (/e-?commerce|sell|online store|checkout/i.test(lower)) {
    primaryIntent = "E-Commerce Storefront & Transaction Engine";
  } else if (/automate|workflow|internal tool|dashboard/i.test(lower)) {
    primaryIntent = "Automated Operational Workflow & Admin Portal";
  } else if (/website|landing page|web platform/i.test(lower)) {
    primaryIntent = "Custom Web Platform & Customer Portal";
  } else if (ctx.intent && ctx.intent !== "Start something new" && ctx.intent !== "Custom Solution") {
    primaryIntent = ctx.intent;
  }

  // 3. Project Scale (Small / Medium / Large based on budget, timeline, users, locations)
  const projectScale = calculateProjectScale(ctx, answers);

  // 4. Primary Goals (Exact Application Features & Capabilities)
  const primaryGoals = extractPrimaryGoalFeatures(ctx, answers);

  // 5. Target Timeline Extraction
  // 5. Target Timeline Extraction
  let targetTimeline = "To be aligned upon technical discovery review";
  for (const text of [...answers].reverse()) {
    if (!text) continue;
    if (/month|week|quarter|asap|urgent|flexible|year|immediately|soon|q1|q2|q3|q4/i.test(text)) {
      targetTimeline = distillTimelineText(text);
      break;
    }
  }

  // 6. Budget Allocation Extraction
  let budgetAllocation = "To be discussed directly with the ACEVA engineering team";
  for (const text of answers) {
    if (!text) continue;
    if (/\$|budget|cost|dollar|k\b|discuss|limit|range|flexible|aceva/i.test(text)) {
      budgetAllocation = distillBudgetText(text);
      break;
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
 * Generate concise, developer-focused, implementation-oriented modules based directly on discovered requirements.
 * Replaces vague corporate labels with explicit developer technical specifications.
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

  const isMobile = /mobile|app|ios|android|native/i.test(combinedText);
  const isRefactor = /java|kotlin|refactor|migrate|codebase|legacy|upgrade|rewrite/i.test(combinedText);
  const isRestaurant = /restaurant|food|cafe|dining|kitchen|takeaway|bakery/i.test(combinedText);
  const isHealthcare = /clinic|health|doctor|medical|telehealth|hospital|patient/i.test(combinedText);
  const isCommerce = /e-?commerce|retail|shop|store|sell|checkout/i.test(combinedText);
  const isRealEstate = /real estate|property|tenant|landlord|realtor|leasing/i.test(combinedText);
  const isLogistics = /logistics|fleet|delivery|warehouse|freight|courier|transport/i.test(combinedText);
  const isFinance = /finance|fintech|bank|loan|wallet|credit/i.test(combinedText);

  // 1. Refactoring & Code Modernization Projects (e.g. Java to Kotlin)
  if (isRefactor) {
    return [
      "Codebase Audit & Dependency Mapping — Automated AST analysis, legacy dependency inventory, and target framework compatibility matrix.",
      "Automated Syntax & Language Migration Pipeline — Transpilation/refactoring pipeline, null-safety enforcement, coroutine async model, and code cleanup.",
      "API Contract & Interface Preservation Harness — Schema verification, REST/gRPC endpoint backward compatibility checks, and payload validation.",
      "Regression Test & Continuous Integration Suite — Unit/integration test migration, automated test coverage telemetry, and CI/CD build pipeline integration.",
      "Performance Telemetry & Runtime Execution Metrics — Comparative benchmark analysis, memory footprint profiling, and execution latency monitoring.",
    ];
  }

  // 2. Restaurant & Food Service Operations
  if (isRestaurant) {
    return [
      isMobile
        ? "Native Mobile Application (iOS & Android) — Cross-platform menu catalog, cart management, item customization, and instant checkout."
        : "Digital Ordering & Menu Catalog Engine — Responsive web menu catalog, cart management, dietary tags, and direct online ordering.",
      "Kitchen Display System (KDS) & Order Pipeline — Real-time kitchen order queue, ticket status state machine, and prep timer controls.",
      "Order Tracking & Automated Customer Notifications — Real-time order progress tracking, SMS/push status alerts, and delivery ETA updates.",
      "Customer Account & Loyalty Management — User authentication (OAuth/JWT), order history, saved addresses, and loyalty rewards.",
      "Multi-Branch Admin & Inventory Dashboard — Multi-location management console, item availability toggles, sales reporting, and revenue analytics.",
    ];
  }

  // 3. Healthcare & Telehealth
  if (isHealthcare) {
    return [
      "Patient Telehealth & Appointment Booking Portal — Patient registration, doctor availability calendar, online booking, and video consultation interface.",
      "Practitioner Schedule & Consultation Queue Manager — Doctor appointment calendar, patient queue control, and consultation notes repository.",
      "HIPAA-Compliant Encrypted Health Records Vault — Secure patient record storage, digital prescription management, and audited access controls.",
      "Automated Patient Notification & Reminder Service — Automated SMS/email appointment reminders, pre-visit instructions, and follow-up alerts.",
      "Clinic Operations & Revenue Analytics Dashboard — Appointment throughput analytics, billing/claims tracking, and operational reporting.",
    ];
  }

  // 4. E-Commerce & Retail
  if (isCommerce) {
    return [
      isMobile
        ? "Mobile Shopping Application (iOS & Android) — Mobile product catalog, cart engine, biometric checkout, and push notification marketing."
        : "High-Conversion Custom Storefront — Responsive product catalog, dynamic search & filtering, cart engine, and optimized checkout flow.",
      "Multi-Warehouse Inventory & SKU Sync Engine — Real-time inventory tracking, low-stock alerts, multi-warehouse sync, and supplier management.",
      "Payment Gateway & Financial Settlement Engine — Integrated payment gateways (Stripe/PayPal), multi-currency support, and refund processing.",
      "Order Fulfillment & Shipping Logistics Tracker — Carrier API integration (FedEx/UPS/DHL), shipping label generation, and live package tracking.",
      "Merchant Admin & Funnel Analytics Dashboard — Product management console, customer order management, conversion funnels, and revenue metrics.",
    ];
  }

  // 5. Real Estate & Property Management
  if (isRealEstate) {
    return [
      "Property Listing Portal & Showcase Engine — Interactive property listings, search filters, high-resolution media galleries, and virtual tour scheduling.",
      "Tenant Application & Screening Workflow — Online lease applications, document upload, credit/background check integration, and approval workflow.",
      "Automated Rent Collection & Payment Gateway — Recurring rent auto-pay, online portal payments, invoice generation, and balance ledger.",
      "Maintenance Request & Contractor Dispatch System — Tenant maintenance ticketing, photo uploads, contractor dispatch, and repair status tracking.",
      "Portfolio Yield & Occupancy Analytics Dashboard — Multi-property occupancy metrics, financial yield reports, and landlord accounting dashboard.",
    ];
  }

  // 6. Logistics & Transport Fleet
  if (isLogistics) {
    return [
      "Real-Time GPS Fleet & Dispatch Control Tower — Live vehicle location tracking, interactive map dispatch, job assignment, and route monitoring.",
      "Driver Mobile Application (iOS & Android) — Driver task queue, turn-by-turn navigation, digital proof-of-delivery (e-signature/photo), and status toggles.",
      "Automated Route Optimization & Fuel Calculator — Algorithmic multi-stop route optimization, distance calculation, and fuel cost tracking.",
      "Shipment Handoff & Customer Milestone Alerts — Live tracking links for customers, automated SMS/email milestone alerts, and delivery confirmations.",
      "Logistics Margin & Fleet Utilization Dashboard — Vehicle maintenance logs, driver performance metrics, fuel efficiency analytics, and margin reporting.",
    ];
  }

  // 7. Financial Services & Fintech
  if (isFinance) {
    return [
      "Digital Customer Onboarding & KYC Verification — Identity verification (ID scan/liveness test), document upload, and compliance audit trail.",
      "Secure Customer Account & Wallet Dashboard — Multi-asset wallet balances, transaction history, fund transfers, and security controls.",
      "Payment Gateway & Ledger Settlement Engine — Automated payment processing, bank API integrations, transaction ledger, and payout distribution.",
      "Loan/Credit Application & Approval Workflow — Credit risk scoring, automated loan approval rules, repayment schedules, and collection tracking.",
      "Financial Compliance & Risk Audit Dashboard — Real-time fraud detection alerts, transaction monitoring, and regulatory audit reporting.",
    ];
  }

  // 8. General Mobile App Requirement
  if (isMobile) {
    return [
      "Cross-Platform Native Mobile Client (iOS & Android) — Responsive mobile user interface, offline data caching, and native device feature access.",
      "Mobile App Backend & API Gateway — RESTful/GraphQL API layer, business logic processing, real-time data sync, and database access.",
      "User Authentication & Profile Management — Secure login (OAuth/JWT/Biometrics), user profile management, and role-based permissions.",
      "Push Notification & Messaging Service — Targeted push notification dispatcher, in-app messaging, and automated event triggers.",
      "Mobile Analytics & Performance Telemetry — App usage tracking, crash reporting, session analytics, and user engagement monitoring.",
    ];
  }

  // 9. Standard Custom Web / Software Platform
  return [
    "Core Web Application Interface & User Portal — Responsive web frontend, intuitive user interface, interactive workflow forms, and customer portal.",
    "Application API & Business Logic Server — RESTful/GraphQL backend services, business rules engine, micro-service architecture, and data persistence.",
    "Identity & Access Control (RBAC) Vault — User authentication (JWT/OAuth2), profile management, multi-tier staff permissions, and role access control.",
    "Notification & Automated Communication Engine — Transactional email dispatcher, SMS alert integration, and event-driven messaging service.",
    "Operational Admin Console & Reporting Dashboard — Multi-tenant admin management panel, system metrics monitoring, and operational BI reporting.",
  ];
}

/**
 * Generate concise (1 to 1.5 line) module descriptions specifically for Stage 3 UI screen rendering.
 * Keeps UI modules clean and uncluttered while preserving deeply defined modules in the .docx file and saved records.
 */
export function getConciseUIModules(
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

  const isMobile = /mobile|app|ios|android|native/i.test(combinedText);
  const isRefactor = /java|kotlin|refactor|migrate|codebase|legacy|upgrade|rewrite/i.test(combinedText);
  const isRestaurant = /restaurant|food|cafe|dining|kitchen|takeaway|bakery/i.test(combinedText);
  const isDairy = /dairy|farm|milk|cattle|agriculture/i.test(combinedText);
  const isHealthcare = /clinic|health|doctor|medical|telehealth|hospital|patient/i.test(combinedText);
  const isCommerce = /e-?commerce|retail|shop|store|sell|checkout/i.test(combinedText);
  const isRealEstate = /real estate|property|tenant|landlord|realtor|leasing/i.test(combinedText);
  const isLogistics = /logistics|fleet|delivery|warehouse|freight|courier|transport/i.test(combinedText);

  if (isRefactor) {
    return [
      "Codebase Audit — AST dependency analysis & framework compatibility matrix.",
      "Language Migration — Code conversion, null-safety, & coroutine refactoring.",
      "API Contract Harness — Schema verification & backward compatibility checks.",
      "Regression Suite — Unit test migration & CI/CD build pipeline integration.",
      "Telemetry Dashboard — Benchmark profiling & runtime execution metrics.",
    ];
  }

  if (isDairy) {
    return [
      "Daily Yield Logging Vault — Milk production & batch yield tracking.",
      "Distributor Logistics — Route dispatch & delivery tracking workflow.",
      "Direct Ordering Catalog — Customer subscription & order cart engine.",
      "Automated SMS Alerts — Dispatch notifications & delivery status updates.",
      "Farm Management Console — Multi-location inventory & yield analytics.",
    ];
  }

  if (isRestaurant) {
    return [
      isMobile
        ? "Native Mobile Application — Menu catalog, cart engine, & instant checkout."
        : "Digital Ordering Engine — Responsive web menu catalog & cart ordering.",
      "Kitchen Display System (KDS) — Real-time kitchen queue & order prep timers.",
      "Order Tracking & Alerts — Delivery progress & instant push notifications.",
      "Customer Accounts — User login, saved addresses, & loyalty rewards.",
      "Operational Dashboard — Multi-branch inventory & sales analytics.",
    ];
  }

  if (isHealthcare) {
    return [
      "Patient Telehealth Portal — Doctor calendar, booking, & video room.",
      "Practitioner Scheduler — Doctor calendar & patient queue control.",
      "Encrypted Records Vault — Secure medical records & prescriptions.",
      "Patient SMS Service — Automated appointment & pre-visit alerts.",
      "Clinic Operations — Billing tracking & throughput analytics.",
    ];
  }

  if (isCommerce) {
    return [
      isMobile
        ? "Mobile Shopping App — Mobile product catalog, cart, & biometric checkout."
        : "Custom Web Storefront — Product catalog, cart engine, & checkout.",
      "Inventory SKU Sync — Multi-warehouse inventory & low-stock alerts.",
      "Payment Settlement Engine — Gateway checkout & digital invoices.",
      "Shipping Logistics Tracker — Carrier API integration & package tracking.",
      "Merchant Admin Console — Catalog controls, order queue, & sales BI.",
    ];
  }

  if (isRealEstate) {
    return [
      "Property Listing Portal — Property showcase, search filters, & tour booking.",
      "Tenant Screening Workflow — Lease applications & background checks.",
      "Automated Rent Gateway — Recurring rent auto-pay & invoice ledger.",
      "Maintenance Dispatch System — Tenant ticketing & contractor dispatch.",
      "Portfolio Yield Analytics — Occupancy metrics & landlord accounting.",
    ];
  }

  if (isLogistics) {
    return [
      "GPS Fleet Control Tower — Vehicle location tracking & map dispatch.",
      "Driver Mobile App — Job queue, navigation, & digital proof-of-delivery.",
      "Route Optimization — Algorithmic route planning & fuel cost calculator.",
      "Shipment Handoff Alerts — Tracking links & customer milestone confirmations.",
      "Fleet Margin Dashboard — Vehicle maintenance logs & efficiency metrics.",
    ];
  }

  if (isMobile) {
    return [
      "Native Mobile Client — Cross-platform UI, caching, & native device access.",
      "Mobile Backend API — RESTful API layer, business logic, & data sync.",
      "Access Control Vault — User authentication & role-based permissions.",
      "Messaging Service — Targeted push notifications & in-app alerts.",
      "Mobile Telemetry — Usage tracking, crash logs, & engagement metrics.",
    ];
  }

  return [
    "Responsive Web Client — Frontend UI & customer portal.",
    "Application API Server — RESTful backend & business logic engine.",
    "Access Control Vault — User authentication & role permissions.",
    "Notification Engine — Automated email & SMS communication service.",
    "Operational Admin Panel — System monitoring & management metrics.",
  ];
}
