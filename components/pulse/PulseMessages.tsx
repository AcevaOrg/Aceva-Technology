"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./pulse.module.css";
import { PulseAction, PulseContextData, PulseState, WizardStepSpec } from "./types";
import { usePulse } from "./PulseContext";
import PulseInput from "./PulseInput";

import PulseFormattedText from "./PulseFormattedText";
import { downloadPulseBlueprintDocx } from "@/lib/pulse/docxGenerator";
import { getRecommendedModules, getConciseUIModules, formatEnrichedProjectContext } from "@/lib/pulse/modules";
import { cleanUserMappedValue } from "@/lib/pulse/format";

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
    title: "Tell us about your business or project.",
    helper: "What do you do, or what would you like to build, and who is it for?",
    placeholder: "e.g. We run a neighborhood restaurant in New York and want a direct online ordering website...",
  },
  {
    label: "MAPPING FRICTION",
    title: "Where do things feel slow or manual today?",
    helper: "Describe what takes too much time, feels confusing, or needs fixing.",
    placeholder: "e.g. Taking orders over WhatsApp is chaotic and hard to keep track of...",
  },
  {
    label: "BUILDING CONTEXT",
    title: "What does your operation look like today?",
    helper: "Share your team size, locations, daily customers, or general scale.",
    placeholder: "e.g. 2 locations, 15 team members, around 300 orders per day...",
  },
  {
    label: "FORMING DIRECTION",
    title: "What would success look like for you?",
    helper: "Tell us what key results or main capabilities matter most to you.",
    placeholder: "e.g. Customers can order online directly, and kitchen staff see orders on one simple screen...",
  },
  {
    label: "TIMELINE & BUDGET FIT",
    title: "What is your target launch timeline and budget window?",
    helper: "Specify your target launch timeframe and budget range (or if you prefer to discuss directly with ACEVA's team).",
    placeholder: "e.g. Target launch in 4-6 weeks, budget range to be discussed directly with the ACEVA team...",
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
  const cleanText = cleanUserMappedValue(text);
  const parts = cleanText.split(/,| and |\.|;/).map((p) => p.trim()).filter((p) => p.length > 3).slice(0, 3);
  return parts.length ? parts.map((p) => cleanUserMappedValue(p)) : fallback;
}

function inferContextFromText(text: string, stepIndex: number) {
  const cleanText = cleanUserMappedValue(text);
  const match = INDUSTRY_RULES.find((r) => r.test.test(text));
  const isTimelineText = /week|month|day|quarter|asap|urgent|year|time|soon|as soon as possible|decide|team|contact/i.test(text);

  const contextUpdate: Record<string, unknown> = {};

  if (match && stepIndex === 0) {
    contextUpdate.industry = match.industry;
    contextUpdate.business = match.business;
    contextUpdate.friction = match.friction;
    contextUpdate.goals = match.goals;
  }

  if (stepIndex === 0 && !contextUpdate.industry) {
    contextUpdate.industry = "Business Services";
    contextUpdate.business = cleanText.slice(0, 80);
  }
  if (stepIndex === 1) {
    contextUpdate.current = cleanText.slice(0, 100);
    contextUpdate.friction = extractPhrases(text, ["Manual handoffs", "Limited visibility"]);
  }
  if (stepIndex === 2) {
    contextUpdate.scale = cleanText.slice(0, 80);
    if (/new york|nyc/i.test(cleanText)) contextUpdate.market = "New York";
  }
  if (stepIndex === 3) {
    contextUpdate.goals = extractPhrases(text, ["Operational clarity", "Measurable growth"]);
  }

  if (isTimelineText || stepIndex >= 3) {
    contextUpdate.timeline = cleanText.slice(0, 120);
  }

  return contextUpdate;
}

export default function PulseMessages({ state, dispatch }: PulseMessagesProps) {
  const { sendChatMessage } = usePulse();
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMethod, setContactMethod] = useState<"Email" | "Phone" | "Text">("Email");
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [showLookupInput, setShowLookupInput] = useState(false);
  const [lookupPulseId, setLookupPulseId] = useState("");
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [state.messages, state.loading]);

  // After the final discovery answer, Pulse's closing response stays in the
  // chat for a short pause before the direction stage takes over.
  useEffect(() => {
    if (state.stage === "discovery" && state.step >= 5 && !state.loading) {
      const timer = setTimeout(() => dispatch({ type: "COMPLETE" }), 4500);
      return () => clearTimeout(timer);
    }
  }, [state.stage, state.step, state.loading, dispatch]);

  // Stage 1: Intent Selection
  if (state.stage === "intent") {
    const INTENT_DETAILS = [
      { title: "Start something new", desc: "Launch MVP or custom platform" },
      { title: "Improve what I have", desc: "Modernize existing software & UI" },
      { title: "Automate something", desc: "Streamline workflows & APIs" },
      { title: "Sell something", desc: "E-commerce & transaction portal" },
      { title: "Solve a problem", desc: "Fix operational friction & scale" },
      { title: "I don't know yet", desc: "Explore recommendations & scope" },
    ];

    return (
      <div className={styles.introBlock}>
        <div className={styles.heroBadge}>
          <span className={styles.badgePulseDot} />
          <span>ACEVA PULSE • SYSTEM ARCHITECT</span>
        </div>

        <h2>
          TURN YOUR VISION INTO A<br />
          <i>SYSTEM BLUEPRINT.</i>
        </h2>

        <p className={styles.directionCopy} style={{ marginBottom: "1.8rem" }}>
          Hello! I&apos;m Aceva Pulse, ACEVA&apos;s AI assistant. Tell me what you&apos;d like to build or improve, and I&apos;ll help map out your project.
        </p>

        <div className={styles.intentGrid}>
          {INTENT_DETAILS.map((item, i) => (
            <button
              key={item.title}
              type="button"
              onClick={() => {
                dispatch({ type: "INTENT", value: item.title });
                const promptText =
                  item.title === "Start something new"
                    ? "I want to start something new."
                    : item.title === "Improve what I have"
                    ? "I want to improve what I have."
                    : item.title === "Automate something"
                    ? "I want to automate something."
                    : item.title === "Sell something"
                    ? "I want to sell something online."
                    : item.title === "Solve a problem"
                    ? "I want to solve a business problem."
                    : "I'm not sure yet, can you help me figure out what I need?";
                sendChatMessage(promptText);
              }}
            >
              <span>0{i + 1}</span>
              <div className={styles.intentTextGroup}>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </div>
              <b>↗</b>
            </button>
          ))}
        </div>

        <PulseInput
          placeholder="Or describe your project vision in your own wording"
          buttonText="MAP THIS VISION ↗"
          onSubmit={(text) => {
            dispatch({ type: "INTENT", value: "Solve a problem" });
            const inferred = inferContextFromText(text, 0);
            sendChatMessage(text, inferred);
          }}
        />

        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className={styles.finishEarly}
            onClick={() => setShowLookupInput((prev) => !prev)}
          >
            {showLookupInput ? "HIDE LOOKUP ▲" : "LOOKUP SAVED PULSE ID 🔍"}
          </button>
        </div>

        {showLookupInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (lookupPulseId.trim()) {
                dispatch({ type: "INTENT", value: "Lookup Direction" });
                sendChatMessage(lookupPulseId.trim());
                setLookupPulseId("");
              }
            }}
            style={{ marginTop: "0.8rem" }}
          >
            <div className={styles.inlineInput}>
              <div>
                <input
                  type="text"
                  value={lookupPulseId}
                  onChange={(e) => setLookupPulseId(e.target.value)}
                  placeholder="Enter reference ID (e.g. PLS-260829-123)"
                  aria-label="Enter reference PULSE ID"
                />
                <button type="submit" disabled={!lookupPulseId.trim()}>
                  LOOKUP 🔍
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    );
  }

  // Stage 2: Prompt Discovery Wizard
  if (state.stage === "discovery") {
    if (state.step >= 5) {
      return (
        <div className={styles.promptBlock}>
          <p className={styles.stepLabel}>06 / SYNTHESIS</p>

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

          {!state.loading && (
            <p className={styles.promptHelper} style={{ marginTop: "1.2rem" }}>
              Preparing your recommended architecture…
            </p>
          )}
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
            const inferred = inferContextFromText(text, state.step);
            sendChatMessage(text, inferred);
          }}
        />

        <div className={styles.actionRow}>
          {state.step > 0 && (
            <button
              type="button"
              className={styles.finishEarly}
              onClick={() => dispatch({ type: "UNDO_LAST_ANSWER" })}
              disabled={Boolean(state.loading)}
            >
              UNDO LAST ANSWER ↩
            </button>
          )}
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
    const enriched = formatEnrichedProjectContext(state.context, state.answers);
    const title = `${enriched.industryFocus.toUpperCase()}`;
    const modules = getConciseUIModules(state.context.industry, state.context, state.answers);

    return (
      <div className={styles.direction}>
        <p className={styles.stepLabel}>PULSE / SYSTEM ARCHITECTURE BLUEPRINT</p>
        <h2>{title}</h2>
        <p className={styles.directionCopy}>
          A connected system designed around the operation Pulse has mapped—not a generic list of features.
        </p>

        <ol>
          {modules.map((mod, idx) => (
            <li key={mod} style={{ marginBottom: "1rem" }}>
              <span>0{idx + 1}</span>
              <div style={{ display: "inline-block", width: "calc(100% - 3rem)", verticalAlign: "top" }}>
                <PulseFormattedText content={mod} />
              </div>
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
          <b>STRUCTURED / CUSTOM ARCHITECTURE</b>
        </div>

        <div className={styles.recommend}>
          <span>RECOMMENDED SERVICE</span>
          <strong>ACEVA Digital Product Engineering</strong>
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
              recommendedModules: getRecommendedModules(state.context.industry, state.context, state.answers),
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
    const pulseId = state.id || "PLS-260826-901";

    const handleCopyId = () => {
      if (typeof window !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(pulseId);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
    };

    const handleDownloadBlueprint = () => {
      downloadPulseBlueprintDocx(state, pulseId);
    };

    const handleOk = () => {
      dispatch({ type: "RESTART" });
    };

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
          <span>ACEVA PULSE ID</span>
          <strong>{pulseId}</strong>
          <small style={{ marginBottom: "1rem" }}>Reference this ID when speaking with Aceva.</small>

          <div className={styles.idRowActions}>
            <button type="button" className={styles.copyBtn} onClick={handleCopyId}>
              {copiedId ? "COPIED! ✓" : "COPY ID 📋"}
            </button>
            <button type="button" className={styles.copyBtn} onClick={handleDownloadBlueprint}>
              DOWNLOAD WORD BLUEPRINT (.DOCX) 📄
            </button>
            <button type="button" className={styles.primaryCta} onClick={handleOk}>
              RETURN TO CHAT <b>↗</b>
            </button>
          </div>
        </div>

        <p className={styles.demoNote}>
          Your project direction and preferred contact details have been submitted securely to Aceva. Our team will review your context and reach out via {state.lead?.method || "Email"}.
        </p>
      </div>
    );
  }

  return null;
}
