"use client";
import React, { useState, useEffect, useRef } from "react";
import styles from "./pulse.module.css";
import { PulseAction, PulseContextData, PulseState } from "./types";
import { usePulse } from "./PulseContext";
import PulseInput from "./PulseInput";
import PulseFormattedText from "./PulseFormattedText";
import { downloadPulseBlueprintDocx } from "@/lib/pulse/docxGenerator";
import { getRecommendedModules, formatEnrichedProjectContext } from "@/lib/pulse/modules";
import { cleanUserMappedValue, distillTimelineText, distillBudgetText } from "@/lib/pulse/format";
import { DISCOVERY_STEPS } from "@/lib/pulse/discoverySteps";
import { describeApiError } from "@/lib/api/errorCodes";

interface PulseMessagesProps {
  state: PulseState;
  dispatch: React.Dispatch<PulseAction>;
}

export const INTENT_OPTIONS = [
  "Start something new",
  "Improve what I have",
  "Automate something",
  "Sell something",
  "Solve a problem",
  "I don't know yet",
] as const;

export type PulseIntent = (typeof INTENT_OPTIONS)[number];

/** The opening message each intent sends on the user's behalf. */
export const INTENT_PROMPTS: Record<PulseIntent, string> = {
  "Start something new": "I want to start something new.",
  "Improve what I have": "I want to improve what I have.",
  "Automate something": "I want to automate something.",
  "Sell something": "I want to sell something online.",
  "Solve a problem": "I want to solve a business problem.",
  "I don't know yet": "I'm not sure yet, can you help me figure out what I need?",
};

/**
 * Ordered intent signals. First match wins, so the more specific intents are
 * checked before "Solve a problem", which is the broadest of the six.
 */
const INTENT_RULES: readonly { test: RegExp; intent: PulseIntent }[] = [
  {
    intent: "I don't know yet",
    test: /\b(not sure|unsure|no idea|don'?t know|dont know|haven'?t decided|just (exploring|looking)|explore options|where do i start|help me (figure|decide))\b/i,
  },
  {
    intent: "Automate something",
    test: /\b(automate|automating|automation|manual|manually|by hand|repetitive|paperwork|spreadsheets?|data entry|streamline|workflow)\b/i,
  },
  {
    intent: "Sell something",
    test: /\b(sell|selling|e-?commerce|online store|storefront|checkout|payments?|subscriptions?|take orders)\b/i,
  },
  {
    intent: "Improve what I have",
    test: /\b(improve|improving|redesign|modernis[ez]|modernize|upgrade|rebuild|revamp|refresh|migrate|existing|current|outdated|legacy|already have|our site|our app)\b/i,
  },
  {
    intent: "Start something new",
    test: /\b(start|starting|build|building|create|creating|launch|launching|new|from scratch|mvp|prototype|greenfield)\b/i,
  },
  {
    intent: "Solve a problem",
    test: /\b(problem|issue|broken|bug|failing|bottleneck|stuck|slow|pain|friction|fix|losing|missing|costing|wrong|errors?|mistakes?|delays?|chasing)\b/i,
  },
];

/**
 * Classifies free text at the intent stage.
 *
 * Every free-text entry used to be filed as "Solve a problem" regardless of
 * what was typed, so "I want to automate invoicing" was recorded — and carried
 * into the blueprint and the lead email — as a problem to fix.
 */
export function inferIntentFromText(text: string): PulseIntent {
  const clean = text.trim();
  if (!clean) return "I don't know yet";

  for (const rule of INTENT_RULES) {
    if (rule.test.test(clean)) return rule.intent;
  }

  // Describing a business without naming an action is someone starting out.
  return "Start something new";
}

/**
 * Plain-language starting points for a visitor who picked "I don't know yet".
 *
 * Picking one commits to a real intent, so the blueprint and the lead email
 * record what they actually want rather than the placeholder. Previously this
 * card dropped them straight into the same five questions, which open by
 * asking about a project they have just said they cannot describe.
 */
export const EXPLORE_OPTIONS: readonly { label: string; hint: string; intent: PulseIntent; prompt: string }[] = [
  {
    label: "Customers can't find or book me online",
    hint: "A website or booking page people can actually use",
    intent: "Start something new",
    prompt: "Customers struggle to find and book us online, and I would like somewhere they can do that.",
  },
  {
    label: "Too much of my day is manual",
    hint: "Replace the spreadsheets, paperwork and re-typing",
    intent: "Automate something",
    prompt: "A lot of our day goes on manual work — spreadsheets, paperwork and re-typing the same details.",
  },
  {
    label: "I want to sell online",
    hint: "Orders, payments and delivery in one place",
    intent: "Sell something",
    prompt: "I want to sell online and handle orders, payments and delivery in one place.",
  },
  {
    label: "What I have already is slow or dated",
    hint: "Improve the system you are running today",
    intent: "Improve what I have",
    prompt: "What we run today feels slow and dated, and I would like it improved.",
  },
  {
    label: "Something keeps going wrong",
    hint: "Find the bottleneck and fix it",
    intent: "Solve a problem",
    prompt: "Something in how we work keeps going wrong and I need help finding the bottleneck.",
  },
];

// Defined in lib/pulse/discoverySteps so the chat route can pin the same
// question the heading is showing.
const WIZARD_STEPS = DISCOVERY_STEPS;

export const INDUSTRY_RULES = [
  { test: /\b(restaurants?|cafe|cafes|food|dining|kitchen|bakery|catering|takeaway|fast food)\b/i, industry: "Hospitality & Restaurant", business: "Restaurant operation", friction: ["Manual order taking", "Lack of direct online ordering"], goals: ["Direct online ordering", "Faster kitchen throughput"] },
  { test: /\b(dairy|farms?|cattle|milk|agriculture|livestock|crops?)\b/i, industry: "Dairy & Agriculture", business: "Farm & dairy operation", friction: ["Manual yield logging", "Distributor tracking gaps"], goals: ["Automated milk/yield logging", "Streamlined distribution"] },
  { test: /\b(hotels?|resort|motel|guest house|airbnb|rooms?|hospitality)\b/i, industry: "Hotels & Hospitality", business: "Hotel & accommodation", friction: ["High third-party OTA fees", "Manual guest check-in"], goals: ["Direct room booking engine", "Automated guest portal"] },
  { test: /\b(clinics?|doctors?|health|healthcare|medical|telehealth|hospital|dental|dentist|patients?|pharma|pharmacy)\b/i, industry: "Healthcare & Clinics", business: "Medical clinic practice", friction: ["High appointment no-shows", "Paper prescription records"], goals: ["Online appointment booking", "Secure patient portal"] },
  { test: /\b(real estate|property|properties|landlord|tenants?|realtor|leasing)\b/i, industry: "Real Estate & Property", business: "Real estate & property management", friction: ["Manual rent collection", "Unorganized maintenance tickets"], goals: ["Property listing portal", "Tenant payment & service dashboard"] },
  { test: /\b(shops?|stores?|e-?commerce|retail|boutique|merchandise|sales)\b/i, industry: "E-Commerce & Retail", business: "Retail & e-commerce brand", friction: ["Checkout drop-off", "Inventory sync issues"], goals: ["Conversion-optimized online store", "Automated inventory management"] },
  { test: /\b(logistics|fleet|delivery|deliveries|warehouse|freight|courier|transport|cargo)\b/i, industry: "Logistics & Transport", business: "Transport & logistics fleet", friction: ["Lack of live vehicle tracking", "Paper proof of delivery"], goals: ["Live dispatch control tower", "Driver mobile app with e-signature"] },
  { test: /\b(construction|contractors?|builder|renovation|architect)\b/i, industry: "Construction & Field Services", business: "Construction & contracting firm", friction: ["Unclear jobsite progress", "Manual daily worker logs"], goals: ["Field activity reporting portal", "Project timeline & cost tracker"] },
  { test: /\b(law|lawyer|lawyers|legal|attorney|firm|accounting|consulting|agency)\b/i, industry: "Professional Services", business: "Legal or consulting practice", friction: ["Unqualified lead intake", "Manual document generation"], goals: ["Qualified client intake portal", "Automated matter & billing workflow"] },
  { test: /\b(salon|spa|beauty|barber|grooming|hair|hairdresser)\b/i, industry: "Beauty & Wellness", business: "Salon or spa practice", friction: ["Booking calendar gaps", "Manual client follow-ups"], goals: ["Online self-booking calendar", "Automated client retention reminders"] },
  { test: /\b(gym|fitness|workout|trainer|sports|crossfit)\b/i, industry: "Fitness & Sports", business: "Fitness center or gym", friction: ["Manual membership renewal", "Class scheduling friction"], goals: ["Member check-in & booking app", "Automated membership billing"] },
  { test: /\b(school|university|education|college|academy|tutor|courses?|lms)\b/i, industry: "Education & E-Learning", business: "Educational institution or academy", friction: ["Manual grade & fee tracking", "Fragmented lesson materials"], goals: ["Student & parent portal", "Online tuition payment & course platform"] },
  { test: /\b(startups?|software|saas|platforms?|apps?|tech|technology|technologies)\b/i, industry: "Software & Technology", business: "Digital product or SaaS platform", friction: ["Slow development velocity", "Unclear product roadmap"], goals: ["Scalable core web/mobile app", "Admin & analytics dashboard"] },
  { test: /\b(events?|tickets?|ticketing|conference|festival|venue)\b/i, industry: "Events & Ticketing", business: "Event management or venue", friction: ["Long entry lines", "Third-party ticket fees"], goals: ["Direct ticket purchasing portal", "QR code check-in scanner"] },
  { test: /\b(finance|financial|fintech|bank|banking|microfinance|loans?|credit)\b/i, industry: "Finance & Fintech", business: "Financial services practice", friction: ["Slow manual loan approval", "Complex client onboarding"], goals: ["Digital onboarding & verification", "Secure customer loan/wallet portal"] },
  { test: /\b(tours?|travel|trip|agency|vacation|itinerary)\b/i, industry: "Travel & Tourism", business: "Tour & travel agency", friction: ["Manual quote generation", "Unorganized travel documents"], goals: ["Interactive tour booking engine", "Digital itinerary & customer portal"] },
  { test: /\b(charity|nonprofit|non-profit|ngo|foundation|donations?)\b/i, industry: "Nonprofit & NGO", business: "Nonprofit organization", friction: ["Manual donor tracking", "Low recurring donation rates"], goals: ["Recurring donation engine", "Impact reporting & volunteer portal"] },
  { test: /\b(factory|manufacturing|plant|production|assembly)\b/i, industry: "Manufacturing & Industrial", business: "Manufacturing operation", friction: ["Unplanned downtime", "Manual shift logs"], goals: ["Production shift scheduler", "Inventory & quality control dashboard"] },
  { test: /\b(website|web page|landing page|corporate site)\b/i, industry: "Web Experience", business: "Custom web platform", friction: ["Outdated website design", "Low visitor conversion"], goals: ["High-converting custom website", "Customer portal & lead engine"] },
  { test: /\b(mobile app|mobile apps|ios|android|native app)\b/i, industry: "Mobile Product", business: "Custom mobile application", friction: ["Lack of mobile presence", "Manual client messaging"], goals: ["Custom iOS & Android app", "Push notification & customer portal"] },
];

function extractPhrases(text: string, fallback: string[]) {
  const cleanText = cleanUserMappedValue(text);
  const parts = cleanText.split(/,| and |\.|;/).map((p) => p.trim()).filter((p) => p.length > 3).slice(0, 3);
  return parts.length ? parts.map((p) => cleanUserMappedValue(p)) : fallback;
}

/** Two-digit ordinal for the numbered lists. `0{n}` printed "010" past nine. */
export function stepNumber(n: number): string {
  return String(n).padStart(2, "0");
}

/** The placeholder industry used until a rule actually recognises the domain. */
const GENERIC_INDUSTRY = "Business Services";

function isGenericIndustry(value?: string): boolean {
  return !value || value === GENERIC_INDUSTRY || value === "General Business";
}

/** A launch window. Word-bounded so "sometimes" and "overtime" are not timelines. */
const TIMELINE_SIGNAL =
  /\b(asap|urgent|immediately|soon|days?|weeks?|months?|quarters?|q[1-4]|years?|timeline|timeframe|time frame|launch|deadline|flexible|tbd)\b/i;

/** A budget figure or a deliberate deferral of one. */
const BUDGET_SIGNAL =
  /\$|\b(\d+\s*k|budget|budgets|cost|costs|price|pricing|spend|invest|investment|thousand|dollars?|usd|rate|rates|quote|discuss|team|negotiate|tbd|undecided)\b/i;

/**
 * Isolates the clause of a combined answer that carries a given signal.
 *
 * Step 4 asks for timeline and budget together, so "Target launch in 4-6 weeks,
 * budget around $15k" is one string holding two facts. Handing the whole string
 * to `distillBudgetText` makes its range pattern match the `4-6` of the
 * *timeline* and report a budget of "4 – 6". Each distiller gets only the
 * clause that mentions its own subject.
 */
function clauseFor(text: string, signal: RegExp): string | undefined {
  const clauses = text
    .split(/[,;]|\band\b|\bbut\b/i)
    .map((clause) => clause.trim())
    .filter(Boolean);

  const matching = clauses.find((clause) => signal.test(clause));
  if (matching) return matching;

  // Single-clause answers still need distilling, e.g. "As soon as possible".
  return signal.test(text) ? text : undefined;
}

/**
 * Maps one wizard answer onto the project context.
 *
 * Each field is written only by the step that actually asks for it. The previous
 * version ended with `if (isTimelineText || stepIndex >= 3) timeline = text`,
 * which filed the step-3 *goals* answer as the launch timeline, and matched
 * `time`/`team` unbounded so a friction answer like "my team spends too much
 * time on orders" became the timeline too. `budget` was declared on
 * PulseContextData but never assigned by anything.
 *
 * `existing` is consulted so industry detection can run on every step without
 * letting a later answer overwrite a domain already identified.
 */
export function inferContextFromText(
  text: string,
  stepIndex: number,
  existing?: PulseContextData
) {
  const cleanText = cleanUserMappedValue(text);
  const contextUpdate: Record<string, unknown> = {};

  // Industry detection runs on every step: a domain is just as often named in
  // the friction or scale answer as in the first one. It only ever fills a
  // generic placeholder, so it cannot downgrade an industry already pinned.
  const match = INDUSTRY_RULES.find((r) => r.test.test(text));
  if (match && isGenericIndustry(existing?.industry)) {
    contextUpdate.industry = match.industry;
    contextUpdate.business = match.business;
    // The rule's canned friction and goals are a starting point only, and must
    // never replace words the user has already given us.
    if (!existing?.friction?.length) contextUpdate.friction = match.friction;
    if (!existing?.goals?.length) contextUpdate.goals = match.goals;
  }

  if (stepIndex === 0) {
    if (!contextUpdate.industry && isGenericIndustry(existing?.industry)) {
      contextUpdate.industry = GENERIC_INDUSTRY;
      contextUpdate.business = cleanText.slice(0, 80);
    }
  }

  if (stepIndex === 1) {
    contextUpdate.current = cleanText.slice(0, 100);
    contextUpdate.friction = extractPhrases(text, ["Manual handoffs", "Limited visibility"]);
  }

  if (stepIndex === 2) {
    contextUpdate.scale = cleanText.slice(0, 80);
    if (/\b(new york|nyc)\b/i.test(cleanText)) contextUpdate.market = "New York";
  }

  // Step 3 asks what success looks like, so it writes goals and nothing else.
  if (stepIndex === 3) {
    contextUpdate.goals = extractPhrases(text, ["Operational clarity", "Measurable growth"]);
  }

  // Step 4 asks for timeline and budget together, so one answer can carry both.
  // Each is distilled independently and only when its own signal is present.
  if (stepIndex === 4) {
    const timelineClause = clauseFor(text, TIMELINE_SIGNAL);
    if (timelineClause) contextUpdate.timeline = distillTimelineText(timelineClause);

    const budgetClause = clauseFor(text, BUDGET_SIGNAL);
    if (budgetClause) contextUpdate.budget = distillBudgetText(budgetClause);
  }

  return contextUpdate;
}

/**
 * Stop while a turn is in flight, Retry once one has failed.
 *
 * Stop stays available for the whole turn, not just once tokens start, because
 * the wait before the first token is the part worth escaping.
 */
function StreamControls({
  busy,
  canRetry,
  onStop,
  onRetry,
}: {
  busy: boolean;
  canRetry: boolean;
  onStop: () => void;
  onRetry: () => void;
}) {
  if (!busy && !canRetry) return null;

  return (
    <div className={styles.streamControls}>
      {busy && (
        <button type="button" className={styles.stopBtn} onClick={onStop}>
          STOP ■
        </button>
      )}
      {!busy && canRetry && (
        <button type="button" className={styles.retryBtn} onClick={onRetry}>
          RETRY ↻
        </button>
      )}
    </div>
  );
}

export default function PulseMessages({ state, dispatch }: PulseMessagesProps) {
  const { sendChatMessage, stopStreaming, retryLastMessage } = usePulse();
  const [contactName, setContactName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [contactMethod, setContactMethod] = useState<"Email" | "Phone" | "Text">("Email");
  const [submittingLead, setSubmittingLead] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [copyError, setCopyError] = useState("");
  // Second screen of the intent stage, shown after "I don't know yet".
  const [exploring, setExploring] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState("");
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

  /** Commits an intent and opens discovery with its first message. */
  const beginWithIntent = (intent: PulseIntent, prompt: string) => {
    dispatch({ type: "INTENT", value: intent });
    sendChatMessage(prompt);
  };

  // Stage 1: Intent Selection
  if (state.stage === "intent") {
    // Typed against PulseIntent so a card can only name an intent that exists.
    const INTENT_DETAILS: { title: PulseIntent; desc: string }[] = [
      { title: "Start something new", desc: "Launch MVP or custom platform" },
      { title: "Improve what I have", desc: "Modernize existing software & UI" },
      { title: "Automate something", desc: "Streamline workflows & APIs" },
      { title: "Sell something", desc: "E-commerce & transaction portal" },
      { title: "Solve a problem", desc: "Fix operational friction & scale" },
      { title: "I don't know yet", desc: "Explore recommendations & scope" },
    ];

    if (exploring) {
      return (
        <div className={styles.introBlock}>
          <div className={styles.heroBadge}>
            <span className={styles.badgePulseDot} />
            <span>ACEVA PULSE • LET&apos;S NARROW IT DOWN</span>
          </div>

          <h2>
            NO PROBLEM.<br />
            <i>WHICH SOUNDS CLOSEST?</i>
          </h2>

          <p className={styles.directionCopy} style={{ marginBottom: "1.8rem" }}>
            You don&apos;t need to know the solution — just pick whichever of these
            is nearest to your situation, and I&apos;ll take it from there.
          </p>

          <div className={styles.intentGrid}>
            {EXPLORE_OPTIONS.map((option, i) => (
              <button
                key={option.label}
                type="button"
                onClick={() => beginWithIntent(option.intent, option.prompt)}
              >
                <span>{stepNumber(i + 1)}</span>
                <div className={styles.intentTextGroup}>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </div>
                <b>↗</b>
              </button>
            ))}
          </div>

          <PulseInput
            placeholder="Or just describe what is on your mind, however rough"
            buttonText="MAP THIS ↗"
            onSubmit={(text) => {
              dispatch({ type: "INTENT", value: inferIntentFromText(text) });
              const inferred = inferContextFromText(text, 0, state.context);
              sendChatMessage(text, inferred);
            }}
          />

          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className={styles.finishEarly}
              onClick={() => setExploring(false)}
            >
              ◂ BACK TO ALL OPTIONS
            </button>
          </div>
        </div>
      );
    }

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
                // Not knowing yet is not an answer to "what do you want to
                // build" — it opens a chooser instead of starting the wizard.
                if (item.title === "I don't know yet") {
                  setExploring(true);
                  return;
                }
                beginWithIntent(item.title, INTENT_PROMPTS[item.title]);
              }}
            >
              <span>{stepNumber(i + 1)}</span>
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
            dispatch({ type: "INTENT", value: inferIntentFromText(text) });
            const inferred = inferContextFromText(text, 0, state.context);
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
              {state.loading && !state.streaming && (
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

          <StreamControls
            busy={Boolean(state.loading)}
            canRetry={Boolean(state.retry)}
            onStop={stopStreaming}
            onRetry={retryLastMessage}
          />

          {!state.loading && !state.retry && (
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
          {stepNumber(state.step + 2)} / {currentStep.label}
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
            {state.loading && !state.streaming && (
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

        <StreamControls
          busy={Boolean(state.loading)}
          canRetry={Boolean(state.retry)}
          onStop={stopStreaming}
          onRetry={retryLastMessage}
        />

        <PulseInput
          multiline
          autoFocus
          disabled={state.loading}
          placeholder={currentStep.placeholder}
          buttonText={state.loading ? "PROCESSING..." : "MAP THIS ↗"}
          onSubmit={(text) => {
            const inferred = inferContextFromText(text, state.step, state.context);
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
    const modules = getRecommendedModules(state.context.industry, state.context, state.answers);

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
              <span>{stepNumber(idx + 1)}</span>
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
            setSubmitError(
              describeApiError(data, "Failed to save project direction. Please try again.")
            );
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

    /**
     * Copy, with the failure cases actually handled.
     *
     * `navigator.clipboard` is undefined on an insecure origin and its write
     * rejects when the page lacks permission or focus. Both used to be silent:
     * the button simply did nothing and never said why.
     */
    const handleCopyId = async () => {
      setCopyError("");

      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setCopyError("Copying isn't available here — select the ID above and copy it manually.");
        return;
      }

      try {
        await navigator.clipboard.writeText(pulseId);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } catch {
        setCopyError("Couldn't copy automatically — select the ID above and copy it manually.");
      }
    };

    /**
     * Mails the blueprint to the address the direction was saved under.
     *
     * The contact is sent back as proof of ownership: the server will only mail
     * an address that already matches the stored one, so a guessed PULSE ID
     * cannot be used to mail a stranger.
     */
    const handleEmailBlueprint = async () => {
      if (emailState === "sending") return;
      setEmailState("sending");
      setEmailError("");

      try {
        const res = await fetch("/api/pulse/email-blueprint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pulseId, contact: state.lead?.contact ?? "" }),
        });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.ok) {
          setEmailState("sent");
          return;
        }

        setEmailState("idle");
        setEmailError(describeApiError(data, "We couldn't send that email. Please try again."));
      } catch {
        setEmailState("idle");
        setEmailError("Network error. Please check your connection and try again.");
      }
    };

    const handleDownloadBlueprint = () => {
      downloadPulseBlueprintDocx(state, pulseId);
    };

    // A direction saved against a phone number has nowhere to send.
    const canEmailBlueprint = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.lead?.contact?.trim() ?? "");

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
            {canEmailBlueprint && (
              <button
                type="button"
                className={styles.copyBtn}
                onClick={handleEmailBlueprint}
                disabled={emailState !== "idle"}
              >
                {emailState === "sending"
                  ? "SENDING…"
                  : emailState === "sent"
                  ? "SENT! ✓"
                  : "EMAIL ME MY BLUEPRINT ✉"}
              </button>
            )}
            <button type="button" className={styles.primaryCta} onClick={handleOk}>
              RETURN TO CHAT <b>↗</b>
            </button>
          </div>
        </div>

        {copyError && (
          <p className={styles.actionNote} role="status">
            {copyError}
          </p>
        )}
        {emailError && (
          <p className={styles.actionNote} role="status">
            {emailError}
          </p>
        )}
        {emailState === "sent" && (
          <p className={styles.actionNote} role="status">
            Blueprint sent. Check your inbox — it may take a minute to arrive.
          </p>
        )}

        <p className={styles.demoNote}>
          Your project direction and preferred contact details have been submitted securely to Aceva. Our team will review your context and reach out via {state.lead?.method || "Email"}.
        </p>
      </div>
    );
  }

  return null;
}
