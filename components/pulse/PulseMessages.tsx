"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./pulse.module.css";
import { PulseAction, PulseContextData, PulseState, WizardStepSpec } from "./types";
import { usePulse } from "./PulseContext";
import PulseInput from "./PulseInput";

import PulseFormattedText from "./PulseFormattedText";

interface PulseMessagesProps {
  state: PulseState;
  dispatch: React.Dispatch<PulseAction>;
}

const INTENT_OPTIONS = [
  "Start something new",
  "Improve what I have",
  "Automate something",
  "Sell something",
  "Solve a problem",
  "I don't know yet",
];

const WIZARD_STEPS: WizardStepSpec[] = [
  {
    label: "READING THE SYSTEM",
    title: "Tell us about the business.",
    helper: "What do you do, and who do you do it for?",
    placeholder: "We run three neighborhood restaurants in New York…",
  },
  {
    label: "MAPPING FRICTION",
    title: "Where does the system break down?",
    helper: "Describe what feels slow, unclear, manual, or disconnected.",
    placeholder: "Orders arrive through different channels and owners lack visibility…",
  },
  {
    label: "BUILDING CONTEXT",
    title: "What does the operation look like today?",
    helper: "Locations, team, market, workflow—or anything that defines the scale.",
    placeholder: "Three locations, 45 staff, one central management team…",
  },
  {
    label: "FORMING DIRECTION",
    title: "What should be different when this works?",
    helper: "Focus on the outcome, not the feature list.",
    placeholder: "Fewer errors, faster service, and one view of performance…",
  },
  {
    label: "SYSTEM FIT",
    title: "When should the new direction begin?",
    helper: "A general window is enough. No delivery promise is being made.",
    placeholder: "We want to start planning this quarter…",
  },
];

const INDUSTRY_RULES = [
  { test: /restaurant|cafe|food|dining|kitchen|bakery|catering|takeaway|fast food/i, industry: "Hospitality & Restaurant", business: "Restaurant operation", friction: ["Manual order taking", "Lack of direct online ordering"], goals: ["Direct online ordering", "Faster kitchen throughput"] },
  { test: /dairy|farm|cattle|milk|agriculture|livestock|crops/i, industry: "Dairy & Agriculture", business: "Farm & dairy operation", friction: ["Manual yield logging", "Distributor tracking gaps"], goals: ["Automated milk/yield logging", "Streamlined distribution"] },
  { test: /hotel|resort|motel|guest house|airbnb|stay|booking/i, industry: "Hotels & Hospitality", business: "Hotel & accommodation", friction: ["High third-party OTA fees", "Manual guest check-in"], goals: ["Direct room booking engine", "Automated guest portal"] },
  { test: /clinic|doctor|health|medical|telehealth|hospital|dental|patient|pharma/i, industry: "Healthcare & Clinics", business: "Medical clinic practice", friction: ["High appointment no-shows", "Paper prescription records"], goals: ["Online appointment booking", "Secure patient portal"] },
  { test: /real estate|property|landlord|tenant|realtor|leasing/i, industry: "Real Estate & Property", business: "Real estate & property management", friction: ["Manual rent collection", "Unorganized maintenance tickets"], goals: ["Property listing portal", "Tenant payment & service dashboard"] },
  { test: /shop|store|e-?commerce|retail|boutique|merchandise|sales/i, industry: "E-Commerce & Retail", business: "Retail & e-commerce brand", friction: ["Checkout drop-off", "Inventory sync issues"], goals: ["Conversion-optimized online store", "Automated inventory management"] },
  { test: /logistics|fleet|delivery|warehouse|freight|courier|transport|cargo/i, industry: "Logistics & Transport", business: "Transport & logistics fleet", friction: ["Lack of live vehicle tracking", "Paper proof of delivery"], goals: ["Live dispatch control tower", "Driver mobile app with e-signature"] },
  { test: /construction|contractor|builder|renovation|architect/i, industry: "Construction & Field Services", business: "Construction & contracting firm", friction: ["Unclear jobsite progress", "Manual daily worker logs"], goals: ["Field activity reporting portal", "Project timeline & cost tracker"] },
  { test: /law|legal|attorney|firm|accounting|consulting|agency/i, industry: "Professional Services", business: "Legal or consulting practice", friction: ["Unqualified lead intake", "Manual document generation"], goals: ["Qualified client intake portal", "Automated matter & billing workflow"] },
  { test: /salon|spa|beauty|barber|grooming|hair/i, industry: "Beauty & Wellness", business: "Salon or spa practice", friction: ["Booking calendar gaps", "Manual client follow-ups"], goals: ["Online self-booking calendar", "Automated client retention reminders"] },
  { test: /gym|fitness|workout|trainer|sports|crossfit/i, industry: "Fitness & Sports", business: "Fitness center or gym", friction: ["Manual membership renewal", "Class scheduling friction"], goals: ["Member check-in & booking app", "Automated membership billing"] },
  { test: /school|university|education|college|academy|tutor|course|lms/i, industry: "Education & E-Learning", business: "Educational institution or academy", friction: ["Manual grade & fee tracking", "Fragmented lesson materials"], goals: ["Student & parent portal", "Online tuition payment & course platform"] },
  { test: /startup|software|saas|platform|app|tech/i, industry: "Software & Technology", business: "Digital product or SaaS platform", friction: ["Slow development velocity", "Unclear product roadmap"], goals: ["Scalable core web/mobile app", "Admin & analytics dashboard"] },
  { test: /event|ticket|conference|festival|show|venue/i, industry: "Events & Ticketing", business: "Event management or venue", friction: ["Long entry lines", "Third-party ticket fees"], goals: ["Direct ticket purchasing portal", "QR code check-in scanner"] },
  { test: /finance|fintech|bank|microfinance|loan|credit/i, industry: "Finance & Fintech", business: "Financial services practice", friction: ["Slow manual loan approval", "Complex client onboarding"], goals: ["Digital onboarding & verification", "Secure customer loan/wallet portal"] },
  { test: /tour|travel|trip|agency|vacation|itinerary/i, industry: "Travel & Tourism", business: "Tour & travel agency", friction: ["Manual quote generation", "Unorganized travel documents"], goals: ["Interactive tour booking engine", "Digital itinerary & customer portal"] },
  { test: /charity|nonprofit|ngo|foundation|donation/i, industry: "Nonprofit & NGO", business: "Nonprofit organization", friction: ["Manual donor tracking", "Low recurring donation rates"], goals: ["Recurring donation engine", "Impact reporting & volunteer portal"] },
  { test: /factory|manufacturing|plant|production|assembly/i, industry: "Manufacturing & Industrial", business: "Manufacturing operation", friction: ["Unplanned downtime", "Manual shift logs"], goals: ["Production shift scheduler", "Inventory & quality control dashboard"] },
  { test: /website|web page|landing page|corporate site/i, industry: "Web Experience", business: "Custom web platform", friction: ["Outdated website design", "Low visitor conversion"], goals: ["High-converting custom website", "Customer portal & lead engine"] },
  { test: /mobile app|ios|android|native app/i, industry: "Mobile Product", business: "Custom mobile application", friction: ["Lack of mobile presence", "Manual client messaging"], goals: ["Custom iOS & Android app", "Push notification & customer portal"] },
];

function extractPhrases(text: string, fallback: string[]) {
  const parts = text.split(/,| and |\.|;/).map((p) => p.trim()).filter((p) => p.length > 3).slice(0, 3);
  return parts.length ? parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)) : fallback;
}

function inferContextFromText(text: string, stepIndex: number) {
  const match = INDUSTRY_RULES.find((r) => r.test.test(text));
  const isTimelineText = /week|month|day|quarter|asap|urgent|year|time|soon/i.test(text);

  const contextUpdate: Record<string, unknown> = {};

  if (match && stepIndex === 0) {
    contextUpdate.industry = match.industry;
    contextUpdate.business = match.business;
    contextUpdate.friction = match.friction;
    contextUpdate.goals = match.goals;
  }

  if (stepIndex === 0 && !contextUpdate.industry) {
    contextUpdate.industry = "Business Services";
    contextUpdate.business = text.slice(0, 62);
  }
  if (stepIndex === 1) {
    contextUpdate.current = text.slice(0, 84);
    contextUpdate.friction = extractPhrases(text, ["Manual handoffs", "Limited visibility"]);
  }
  if (stepIndex === 2) {
    contextUpdate.scale = text.slice(0, 62);
    if (/new york|nyc/i.test(text)) contextUpdate.market = "New York";
  }
  if (stepIndex === 3) {
    contextUpdate.goals = extractPhrases(text, ["Operational clarity", "Measurable growth"]);
  }

  if (isTimelineText || stepIndex >= 3) {
    contextUpdate.timeline = text.trim().slice(0, 100);
  }

  return contextUpdate;
}

function getRecommendedModules(industry?: string, context?: PulseContextData): string[] {
  const ind = (industry || "").toLowerCase();
  const intent = String(context?.intent || context?.business || "").toLowerCase();

  if (ind.includes("hospitality") || ind.includes("restaurant") || intent.includes("restaurant") || intent.includes("food") || intent.includes("cafe")) {
    return [
      "Custom Digital Ordering & Menu Portal",
      "Real-Time Table Booking & Reservation Engine",
      "Kitchen Display System (KDS) & Order Tracker",
      "Customer Loyalty & Automated SMS Reminders",
      "Owner Revenue & Sales Analytics Dashboard",
    ];
  }

  if (ind.includes("dairy") || ind.includes("agriculture") || intent.includes("dairy") || intent.includes("farm") || intent.includes("milk")) {
    return [
      "Daily Milk Production & Yield Tracker",
      "Cattle Health & Veterinary Records Module",
      "Dairy Collection & Distributor Dispatch Portal",
      "Feed Inventory & Supply Management System",
      "Farm Profitability & Buyer Order Dashboard",
    ];
  }

  if (ind.includes("hotel") || intent.includes("hotel") || intent.includes("resort") || intent.includes("room")) {
    return [
      "Direct Room Reservation & Booking Engine",
      "Guest Self-Service Check-In & Concierge Portal",
      "Housekeeping & Room Maintenance Tracker",
      "Direct Online Payment Gateway Integration",
      "Occupancy & RevPAR Analytics Dashboard",
    ];
  }

  if (ind.includes("healthcare") || ind.includes("clinic") || intent.includes("clinic") || intent.includes("doctor") || intent.includes("patient")) {
    return [
      "Online Patient Appointment Scheduling Portal",
      "Doctor Directory & Specialty Slot Manager",
      "Secure Patient History & Prescription Vault",
      "Telehealth Video Consultation System",
      "Clinic Billing & Automated SMS Reminders",
    ];
  }

  if (ind.includes("real estate") || ind.includes("property") || intent.includes("estate") || intent.includes("tenant")) {
    return [
      "Interactive Property Listing & Virtual Tour Showcase",
      "Tenant Portal for Rent Collection & Lease Sign-off",
      "Maintenance Request & Work Order Dispatching",
      "Site Inspection Daily Logs & Photo Upload",
      "Property Portfolio & Revenue Dashboard",
    ];
  }

  if (ind.includes("commerce") || ind.includes("retail") || intent.includes("shop") || intent.includes("store") || intent.includes("e-commerce")) {
    return [
      "High-Converting Online Store & Product Catalog",
      "Secure Cart & Multi-Currency Payment Checkout",
      "Multi-Location Inventory Control & Sync",
      "Shipment Tracking & Automated Courier Alerts",
      "Customer Retention & Store Revenue Analytics",
    ];
  }

  if (ind.includes("logistics") || ind.includes("transport") || intent.includes("fleet") || intent.includes("delivery") || intent.includes("warehouse")) {
    return [
      "Dispatch Control Tower & Route Assignment",
      "Driver Mobile App with Electronic Proof of Delivery",
      "Live Fleet Location & Shipment Tracking",
      "Warehouse Inventory & Bin Allocation Manager",
      "Operations Throughput & Fuel Efficiency Dashboard",
    ];
  }

  if (ind.includes("construction") || intent.includes("construction") || intent.includes("builder")) {
    return [
      "Field Activity & Worker Daily Reporting Portal",
      "Subcontractor Schedule & Job Coordination",
      "Client Progress Visibility & Photo Updates",
      "Job Cost & Material Inventory Tracker",
      "Project Milestone & Margin Control Dashboard",
    ];
  }

  if (ind.includes("education") || ind.includes("school") || intent.includes("school") || intent.includes("course") || intent.includes("student")) {
    return [
      "Course Catalog & Video Lesson Portal",
      "Student & Parent Dashboard (Grades, Attendance)",
      "Online Tuition Fee Payment Gateway",
      "Automated Certificate & Quiz Engine",
      "Academic Administration Analytics Dashboard",
    ];
  }

  if (ind.includes("beauty") || ind.includes("wellness") || intent.includes("salon") || intent.includes("spa")) {
    return [
      "Online Self-Booking Calendar & Staff Scheduler",
      "Service Menu & Stylist Availability Selector",
      "Client Preference & History Record Notes",
      "Automated SMS Appointment & Birthday Reminders",
      "Salon Revenue & Service Analytics Dashboard",
    ];
  }

  if (ind.includes("fitness") || intent.includes("gym") || intent.includes("workout")) {
    return [
      "Member Mobile Check-In & Class Booking App",
      "Trainer Scheduling & Personal Session Tracker",
      "Membership Subscription Billing Portal",
      "Workout & Fitness Goal Tracking Module",
      "Gym Attendance & Revenue Analytics Dashboard",
    ];
  }

  if (ind.includes("legal") || ind.includes("professional") || intent.includes("law") || intent.includes("consulting")) {
    return [
      "Qualified Client Intake & Questionnaire Portal",
      "Matter & Document Workflow Tracker",
      "Secure Client Portal & Encrypted File Vault",
      "Automated Time Tracking & Invoicing Module",
      "Practice Performance & Billing Dashboard",
    ];
  }

  if (ind.includes("event") || intent.includes("ticket") || intent.includes("event")) {
    return [
      "Event Landing Page & Direct Ticket Checkout",
      "QR Code Ticket Scanner & Check-In App",
      "Guest RSVP & Seating Arrangement Manager",
      "Speaker Schedule & Interactive Event Agenda",
      "Ticket Sales & Attendee Demographics Dashboard",
    ];
  }

  if (ind.includes("finance") || intent.includes("fintech") || intent.includes("loan") || intent.includes("wallet")) {
    return [
      "Digital Customer Onboarding & KYC Verification",
      "Loan Application & Automated Approval Workflow",
      "Secure Customer Account & Wallet Dashboard",
      "Transaction Processing & Payment Gateway",
      "Financial Risk Assessment & Audit Dashboard",
    ];
  }

  if (ind.includes("mobile") || intent.includes("mobile app") || intent.includes("ios") || intent.includes("android")) {
    return [
      "Custom iOS & Android Mobile User Experience",
      "Push Notifications & Instant Mobile Messaging",
      "Offline Data Sync & Location Services",
      "User Profile & Authentication Security Vault",
      "Mobile App Engagement & Usage Analytics",
    ];
  }

  if (ind.includes("web") || intent.includes("website") || intent.includes("landing page")) {
    return [
      "High-Converting Custom Web Design Platform",
      "Lead Qualification & Interactive Intake Forms",
      "Content & Case Study Management System",
      "Customer Account & Inquiry Dashboard",
      "Website Analytics & Conversion Telemetry",
    ];
  }

  const customTitle = intent.length > 5 ? intent.charAt(0).toUpperCase() + intent.slice(1, 35) : "Custom Digital System";
  return [
    `Custom ${customTitle} Core Platform`,
    "Role-Based User Management & Security Vault",
    "Automated Customer & Team Workflow Engine",
    "Real-Time Operational Command Dashboard",
    "Performance Telemetry & Growth Analytics",
  ];
}

export default function PulseMessages({ state, dispatch }: PulseMessagesProps) {
  const { sendChatMessage } = usePulse();
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMethod, setContactMethod] = useState<"Email" | "Phone" | "Text">("Email");
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [state.messages, state.loading]);

  // Stage 1: Intent Selection
  if (state.stage === "intent") {
    return (
      <div className={styles.introBlock}>
        <p className={styles.stepLabel}>01 / BEGIN</p>
        <h2>
          WHAT ARE YOU<br />
          <i>TRYING TO CHANGE?</i>
        </h2>
        <p className={styles.directionCopy} style={{ marginBottom: "1.8rem" }}>
          Hello! I&apos;m PULSE, ACEVA&apos;s AI assistant. Tell me what you&apos;d like to build or improve, and I&apos;ll help map out your project.
        </p>

        <div className={styles.intentGrid}>
          {INTENT_OPTIONS.map((intent, i) => (
            <button
              key={intent}
              type="button"
              onClick={() => {
                dispatch({ type: "INTENT", value: intent });
                const promptText =
                  intent === "Start something new"
                    ? "I want to start something new."
                    : intent === "Improve what I have"
                    ? "I want to improve what I have."
                    : intent === "Automate something"
                    ? "I want to automate something."
                    : intent === "Sell something"
                    ? "I want to sell something online."
                    : intent === "Solve a problem"
                    ? "I want to solve a business problem."
                    : "I'm not sure yet, can you help me figure out what I need?";
                sendChatMessage(promptText);
              }}
            >
              <span>0{i + 1}</span>
              {intent}
              <b>↗</b>
            </button>
          ))}
        </div>

        <PulseInput
          placeholder="Describe what is on your mind…"
          buttonText="ENTER ↗"
          onSubmit={(text) => {
            dispatch({ type: "INTENT", value: "Solve a problem" });
            dispatch({ type: "ANSWER", value: text, inferred: inferContextFromText(text, 0) });
            sendChatMessage(text);
          }}
        />
      </div>
    );
  }

  // Stage 2: Prompt Discovery Wizard
  if (state.stage === "discovery") {
    if (state.step >= 5) {
      return (
        <div className={styles.forming}>
          <p className={styles.stepLabel}>06 / SYNTHESIS</p>
          <h2>
            DIRECTION<br />
            <i>READY.</i>
          </h2>
          <p>
            Pulse has mapped enough context to form an initial project direction. This is a working system brief—not a final scope, price, or delivery promise.
          </p>
          <button
            type="button"
            className={styles.primaryCta}
            onClick={() => dispatch({ type: "COMPLETE" })}
          >
            REVEAL YOUR DIRECTION <b>↗</b>
          </button>
        </div>
      );
    }

    const currentStep = WIZARD_STEPS[state.step];

    return (
      <div className={styles.promptBlock}>
        <p className={styles.stepLabel}>
          0{state.step + 2} / {currentStep.label}
        </p>
        <h2>{currentStep.title}</h2>
        <p className={styles.promptHelper}>{currentStep.helper}</p>

        {/* Previous user and Pulse messages display */}
        {state.messages.length > 0 && (
          <div ref={chatListRef} className={styles.chatList}>
            {state.messages.map((m) => (
              <div
                key={m.id}
                className={`${styles.chatBubble} ${
                  m.sender === "user" ? styles.userBubble : styles.pulseBubble
                }`}
              >
                <PulseFormattedText content={m.text} />
              </div>
            ))}
            {state.loading && (
              <div className={`${styles.chatBubble} ${styles.pulseBubble}`}>
                <div className={styles.loadingDots}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
        )}

        <PulseInput
          multiline
          autoFocus
          disabled={state.loading}
          placeholder={currentStep.placeholder}
          buttonText={state.loading ? "PROCESSING..." : "MAP THIS ↗"}
          onSubmit={(text) => {
            const nextStep = state.step + 1;
            dispatch({
              type: "ANSWER",
              value: text,
              inferred: inferContextFromText(text, state.step),
            });
            sendChatMessage(text);

            if (nextStep >= 5) {
              setTimeout(() => {
                dispatch({ type: "COMPLETE" });
              }, 1200);
            }
          }}
        />

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.finishEarly}
            onClick={() => dispatch({ type: "COMPLETE" })}
            disabled={Boolean(state.loading)}
          >
            FORM DIRECTION WITH CURRENT CONTEXT
          </button>
        </div>
      </div>
    );
  }

  // Stage 3: Generated Direction Overview
  if (state.stage === "direction") {
    const title = `${state.context.industry || "BUSINESS"} ${
      state.context.intent === "Automate something" ? "OPERATING SYSTEM" : "DIGITAL SYSTEM"
    }`;
    const modules = getRecommendedModules(state.context.industry, state.context);

    return (
      <div className={styles.direction}>
        <p className={styles.stepLabel}>PULSE / YOUR DIRECTION</p>
        <h2>{title}</h2>
        <p className={styles.directionCopy}>
          A connected system designed around the operation Pulse has mapped—not a generic list of features.
        </p>

        <ol>
          {modules.map((mod, idx) => (
            <li key={mod}>
              <span>0{idx + 1}</span>
              {mod}
              <b>—</b>
            </li>
          ))}
        </ol>

        <div className={styles.complexity}>
          <span>PROJECT COMPLEXITY</span>
          <div>
            <i />
            <i />
            <i />
            <i className={styles.off} />
          </div>
          <b>STRUCTURED / CUSTOM</b>
        </div>

        <div className={styles.recommend}>
          <span>RECOMMENDED ARCHITECTURE</span>
          <strong>ACEVA Custom Digital System</strong>
        </div>

        <button
          type="button"
          className={styles.primaryCta}
          onClick={() => dispatch({ type: "CONTACT" })}
        >
          CONTINUE WITH ACEVA <b>↗</b>
        </button>
      </div>
    );
  }

  // Stage 4: Contact & Lead Submission
  if (state.stage === "contact") {
    const handleLeadSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (contactName.trim() && contactInfo.trim() && !submittingLead) {
        setSubmittingLead(true);
        setSubmitError("");

        const dateObj = new Date();
        const dateStr = `${String(dateObj.getFullYear()).slice(-2)}${String(dateObj.getMonth() + 1).padStart(2, "0")}${String(dateObj.getDate()).padStart(2, "0")}`;
        const generatedId = `PLS-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

        try {
          const res = await fetch("/api/pulse/save-direction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pulseId: generatedId,
              lead: {
                name: contactName.trim(),
                contact: contactInfo.trim(),
                method: contactMethod,
              },
              context: state.context,
              answers: state.answers,
              recommendedModules: getRecommendedModules(state.context.industry, state.context),
            }),
          });

          const data = await res.json();
          if (res.ok && data.ok) {
            dispatch({
              type: "CONFIRM",
              lead: { name: contactName.trim(), contact: contactInfo.trim(), method: contactMethod },
              id: data.pulseId || generatedId,
            });
          } else {
            setSubmitError(data.message || "Failed to save project direction. Please try again.");
          }
        } catch {
          setSubmitError("Network error. Please check your connection and try again.");
        } finally {
          setSubmittingLead(false);
        }
      }
    };

    return (
      <div className={styles.lead}>
        <p className={styles.stepLabel}>07 / CONTINUE</p>
        <h2>
          LET’S MOVE THE<br />
          <i>DIRECTION FORWARD.</i>
        </h2>
        <p>
          Your Pulse direction will be attached to your inquiry, so the Aceva team can begin with context—not a blank page.
        </p>

        <form onSubmit={handleLeadSubmit}>
          <label>
            Name
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              autoComplete="name"
              required
              disabled={submittingLead}
              placeholder="Your full name"
            />
          </label>

          <label>
            Email or Phone
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              autoComplete="email"
              required
              disabled={submittingLead}
              placeholder="name@company.com or phone"
            />
          </label>

          <label>
            Preferred Contact Method
            <select
              value={contactMethod}
              disabled={submittingLead}
              onChange={(e) => setContactMethod(e.target.value as "Email" | "Phone" | "Text")}
            >
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
              <option value="Text">Text</option>
            </select>
          </label>

          {submitError && (
            <p style={{ color: "var(--error, #e0503b)", fontSize: "0.85rem", margin: "0.8rem 0" }}>
              {submitError}
            </p>
          )}

          <button type="submit" className={styles.primaryCta} disabled={submittingLead}>
            {submittingLead ? "SAVING DIRECTION..." : "SAVE DIRECTION ↗"}
          </button>
        </form>
      </div>
    );
  }

  // Stage 5: Saved Confirmation View
  if (state.stage === "confirmation") {
    return (
      <div className={styles.confirmation}>
        <div className={styles.savedMark}>
          <i />
          <span>01</span>
        </div>
        <p className={styles.stepLabel}>DIRECTION SAVED & SUBMITTED</p>
        <h2>
          WE HAVE<br />
          <i>THE CONTEXT.</i>
        </h2>
        <p>Your project direction is ready to travel with the conversation.</p>

        <div className={styles.sessionId}>
          <span>PULSE ID</span>
          <strong>{state.id || "PLS-260826-901"}</strong>
          <small>Reference this ID when speaking with Aceva.</small>
        </div>

        <p className={styles.demoNote}>
          Your project direction and preferred contact details have been submitted securely to Aceva. Our team will review your context and reach out via {state.lead?.method || "Email"}.
        </p>
      </div>
    );
  }

  return null;
}
