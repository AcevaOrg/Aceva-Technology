import Image from "next/image";
import Link from "next/link";
import { CAPS } from "@/lib/data/caps";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Eyebrow from "@/components/ui/Eyebrow";
import Card from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import ArrowLink from "@/components/ui/ArrowLink";
import { ArrowRightIcon } from "@/components/ui/icons";
import PathChooser from "@/components/features/PathChooser";

const CAP_ICONS: Record<string, React.ReactNode> = {
  digital: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3B7CFF" strokeWidth="1.6" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  software: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3B7CFF" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  mobile: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3B7CFF" strokeWidth="1.6" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  ),
  intelligence: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3B7CFF" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  ),
  rescue: (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#7FB2FF" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M9.2 12l2 2 3.6-3.6" />
    </svg>
  ),
};

const CAP_HOME_BLURBS: Record<string, string> = {
  digital: "Premium websites, e-commerce, portals and customer-facing platforms.",
  software: "SaaS products, dashboards, marketplaces and internal business systems.",
  mobile: "iOS, Android and cross-platform applications for customers and teams.",
  intelligence: "AI assistants, workflow automation, integrations, knowledge systems and reporting.",
  rescue: "Audit, stabilize, secure and modernize unfinished, outdated or AI-generated software.",
};

const COMPETE_POINTS = [
  { n: "01", title: "Proof Sprint", body: "Before a large commitment, we solve or demonstrate one narrow part of the problem and hand over a roadmap." },
  { n: "02", title: "Rescue Sprint", body: "Audit, risk list, save-or-replace recommendation and a recovery roadmap as a clear first engagement." },
  { n: "03", title: "Human-reviewed AI", body: "AI is used for speed. Senior engineers stay responsible for quality, architecture and security." },
  { n: "04", title: "Client ownership", body: "Code, accounts and data stay under clear client ownership. No developer personally owns your infrastructure." },
  { n: "05", title: "Weekly proof", body: "Working progress, decisions, risks and tests every week — instead of hiding until the deadline." },
];

const PROCESS_STEPS = [
  { n: "01", title: "Understand", body: "Requirements, goals, constraints and feasibility before any code." },
  { n: "02", title: "Design", body: "UX, interface and architecture planning with acceptance criteria." },
  { n: "03", title: "Build", body: "Senior-reviewed sprints with weekly working demos." },
  { n: "04", title: "Launch", body: "QA, security basics, deployment and analytics under your accounts." },
  { n: "05", title: "Improve", body: "Monitoring, iteration and a modernization roadmap you can act on." },
];

const PROOF_CARDS = [
  { badge: "LIVE PROOF", title: "This website", body: "Digital Experiences, demonstrated by the thing you are using now.", variant: "flagship" as const, ice: true },
  { badge: "CONCEPT DEMO", title: "Operations dashboard", body: "Users, permissions, tasks, data and reporting in one realistic workflow.", variant: "flagship" as const, ice: true },
  { badge: "CONCEPT DEMO", title: "Mobile journey", body: "One complete journey from sign-in to a useful outcome — not ten loose screens.", variant: "flagship" as const, ice: true },
  { badge: "CONCEPT DEMO", title: "Automation with approval", body: "Request, lookup, proposed action, human approval, system update.", variant: "flagship" as const, ice: true },
  { badge: "SAMPLE REPORT", title: "Rescue Report", body: "Findings, severity, what to keep, what to replace, and a 30/60/90-day plan.", variant: "flagship" as const, ice: true },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="hero" style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--hairline)" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <Image src="/images/used/Aceva.png" alt="" fill sizes="100vw" className="ac-section-image ac-section-image--hero bg-pan-slow" priority />
          <div className="hero-overlay" />
        </div>
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "clamp(110px,14vw,160px) clamp(20px,4vw,48px) clamp(48px,6vw,72px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "var(--font-jetbrains-mono)", fontSize: 11.5, letterSpacing: ".2em", color: "var(--ice)", margin: "0 0 clamp(24px,4vw,38px)", animation: "acTrackIn 900ms cubic-bezier(.16,1,.3,1) both" }}>
            <span style={{ width: 22, height: 1, background: "var(--electric)" }} />
            ACEVA HOLDINGS / SOFTWARE DIVISION
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 8px rgba(47,190,122,.5)", animation: "acPulseDot 2.8s ease-in-out infinite" }} />
          </p>
          <h1 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(38px,6.6vw,72px)", lineHeight: 1.04, letterSpacing: "-.03em", margin: "0 auto", maxWidth: 800, animation: "acMaskUp 900ms cubic-bezier(.16,1,.3,1) 80ms both" }}>
            <span className="ac-text-shimmer">
              Build what your business <span className="hero-title-accent">needs next.</span>
            </span>
          </h1>
          <p style={{ fontSize: "clamp(16.5px,1.5vw,19.5px)", lineHeight: 1.62, color: "var(--muted)", maxWidth: "60ch", margin: "clamp(22px,3vw,30px) auto 0", animation: "acBlurIn 800ms cubic-bezier(.16,1,.3,1) 160ms both" }}>
            Aceva designs digital experiences, custom software, mobile products and intelligent systems — and rescues products that need a stronger path forward.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: "clamp(30px,4vw,42px)", animation: "acBlurIn 800ms cubic-bezier(.16,1,.3,1) 260ms both" }}>
            <Link href={ROUTES.contact} className="ac-btn-primary" style={{ minHeight: 52, padding: "16px 26px" }}>
              Start a Project
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
            <Link href={ROUTES.work} className="ac-btn-ghost" style={{ minHeight: 52, padding: "16px 26px" }}>
              Explore Experiments
              <ArrowRightIcon width={15} height={15} />
            </Link>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "clamp(28px,4vw,40px) 0 0", animation: "acBlurIn 800ms cubic-bezier(.16,1,.3,1) 360ms both" }}>
            For buyers with a clear idea or problem — or visitors who want to see how Aceva thinks and builds.
          </p>
          <p className="ac-scroll-cue" aria-hidden="true" style={{ margin: "clamp(32px,5vw,64px) auto 0" }}>
            <span>Scroll</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 4v16m0 0-6-6m6 6 6-6" />
            </svg>
          </p>
        </div>
      </section>

      {/* Paths */}
      <section id="paths" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)" }}>
          <Reveal style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
            <div>
              <Eyebrow>01 — ORIENTATION</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-.02em", margin: 0 }}>Where are you right now?</h2>
            </div>
            <p style={{ fontSize: 15, color: "var(--muted)", margin: 0, maxWidth: "34ch" }}>Choose the sentence that fits. The page below adapts to your situation.</p>
          </Reveal>
          <PathChooser />
        </div>
      </section>

      {/* Five capabilities */}
      <section className="capabilities" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <Image src="/images/used/holographic.png" alt="" fill sizes="100vw" className="ac-section-image ac-section-image--contain bg-pan" />
          <div className="capabilities-overlay" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0A0A0C 0%, transparent 15%, transparent 85%, #0A0A0C 100%)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)" }}>
          <Reveal>
            <Eyebrow>02 — THE OFFER</Eyebrow>
            <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-.025em", margin: 0, maxWidth: "22ch" }}>
              Five capabilities. One accountable engineering partner.
            </h2>
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14, marginTop: "clamp(30px,4vw,48px)" }}>
            {CAPS.map((cap) => (
              <Reveal key={cap.key}>
                <Card variant="flagship" href={capabilityRoute(cap.key)} style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12, minHeight: 230 }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".16em", color: "var(--ice)" }}>
                    {cap.key === "rescue" ? `${cap.num} · FLAGSHIP` : cap.num}
                    {CAP_ICONS[cap.key]}
                  </span>
                  <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 22, fontWeight: 500, letterSpacing: "-.01em", marginTop: 6 }}>{cap.name}</span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.62, color: "#c3c8d4" }}>{CAP_HOME_BLURBS[cap.key]}</span>
                  <span className="ac-link" style={{ marginTop: "auto", fontSize: 13.5 }}>
                    Learn more
                    <ArrowRightIcon />
                  </span>
                </Card>
              </Reveal>
            ))}
            <Reveal>
              <Card variant="flagship" href={ROUTES.services} style={{ padding: 28, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 10, minHeight: 230 }}>
                <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>All capabilities in detail</span>
                <span style={{ fontSize: 14, color: "#c3c8d4" }}>What each one includes, when to buy it, and what we will not promise.</span>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Differentiator strip */}
      <section style={{ borderBottom: "1px solid var(--hairline)", background: "rgba(15,15,19,.72)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,7vw,88px) clamp(20px,4vw,48px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 2 }}>
          {[
            { n: "01", text: "AI-accelerated. Senior-reviewed. Production-ready." },
            { n: "02", text: "Your code. Your accounts. Your data." },
            { n: "03", text: "New York market insight. Global engineering execution." },
          ].map((item, i, arr) => (
            <Reveal key={item.n} style={{ padding: "26px 28px", borderRight: i < arr.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--electric)", margin: "0 0 12px" }}>{item.n}</p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(18px,1.9vw,22px)", fontWeight: 500, lineHeight: 1.34, letterSpacing: "-.01em", margin: 0 }}>{item.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How we compete */}
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(30px,5vw,72px)" }}>
            <Reveal>
              <Eyebrow>03 — HOW WE COMPETE</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-.025em", margin: 0 }}>
                The five capabilities are the offer. The delivery experience is the difference.
              </h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "22px 0 0", maxWidth: "46ch" }}>
                We are not claiming these services are unique — global firms already sell them. Aceva differentiates through clarity, proof, Product Rescue, client ownership and transparent delivery.
              </p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: "clamp(19px,2.2vw,25px)", fontWeight: 500, lineHeight: 1.32, letterSpacing: "-.015em", margin: "32px 0 0", paddingLeft: 22, borderLeft: "2px solid var(--royal)" }}>
                We will not compete by saying more. We will compete by proving more.
              </p>
            </Reveal>
            <Reveal style={{ display: "flex", flexDirection: "column" }}>
              {COMPETE_POINTS.map((pt, i) => (
                <div key={pt.n} style={{ display: "flex", gap: 18, padding: "22px 0", borderTop: "1px solid var(--hairline)", borderBottom: i === COMPETE_POINTS.length - 1 ? "1px solid var(--hairline)" : undefined }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--electric)", paddingTop: 4 }}>{pt.n}</span>
                  <div>
                    <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 500, margin: 0 }}>{pt.title}</p>
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "6px 0 0" }}>{pt.body}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* Process strip */}
      <section className="process" style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <Image src="/images/used/process-bg.png" alt="" fill sizes="100vw" className="ac-section-image ac-section-image--process bg-pan-fast" />
          <div className="process-overlay" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0A0A0C 0%, transparent 15%, transparent 85%, #0A0A0C 100%)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)" }}>
          <Reveal style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
            <div>
              <Eyebrow>04 — PROCESS</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-.025em", margin: 0 }}>Understand, design, build, launch, improve.</h2>
            </div>
            <Link href={ROUTES.process} className="ac-btn-ghost" style={{ minHeight: 48, padding: "13px 20px" }}>
              Full process
              <ArrowRightIcon />
            </Link>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 0, marginTop: "clamp(30px,4vw,50px)", borderTop: "1px solid var(--hairline)" }}>
            {PROCESS_STEPS.map((step, i, arr) => (
              <Reveal key={step.n} style={{ padding: "26px 22px", borderRight: i < arr.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--electric)", margin: "0 0 14px" }}>STEP {step.n}</p>
                <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, margin: 0 }}>{step.title}</p>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--muted)", margin: "8px 0 0" }}>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Proof, not portfolio */}
      <section className="experiments" style={{ borderBottom: "1px solid var(--hairline)", background: "rgba(15,15,19,.72)" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <Image src="/images/used/twin-visions.jpg" alt="" fill sizes="100vw" className="ac-section-image ac-section-image--proof bg-pan" />
          <div className="experiments-overlay" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, #0A0A0C 0%, transparent 20%, transparent 80%, #0A0A0C 100%)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)" }}>
          <Reveal style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
            <div>
              <Eyebrow>05 — PROOF, NOT PORTFOLIO</Eyebrow>
              <h2 style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.1, letterSpacing: "-.025em", margin: 0, maxWidth: "24ch" }}>
                Honest demonstrations, clearly labeled. Never presented as client work.
              </h2>
            </div>
            <Link href={ROUTES.work} className="ac-btn-ghost" style={{ minHeight: 48, padding: "13px 20px" }}>
              Open Experiments
              <ArrowRightIcon />
            </Link>
          </Reveal>
          <div className="ac-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14, marginTop: "clamp(30px,4vw,48px)" }}>
            {PROOF_CARDS.map((c) => (
              <Reveal key={c.title}>
                <Card variant={c.variant} href={ROUTES.work} style={{ padding: 24, minHeight: 180, display: "flex", flexDirection: "column", gap: 10 }}>
                  <Tag variant="outline-ice" style={c.ice ? undefined : { color: "var(--muted)", borderColor: "var(--hairline)" }}>
                    {c.badge}
                  </Tag>
                  <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 18, fontWeight: 500, marginTop: 6 }}>{c.title}</span>
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: c.variant === "flagship" ? "#c3c8d4" : "var(--muted)" }}>{c.body}</span>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Teaser row */}
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div className="ac-card-grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(64px,9vw,116px) clamp(20px,4vw,48px)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          <Reveal>
            <Card variant="flagship" className="home-teaser-card" style={{ padding: 30, height: "100%" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>CLIENT FEEDBACK</p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, lineHeight: 1.34, letterSpacing: "-.01em", margin: 0 }}>Coming soon.</p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "12px 0 0" }}>We publish quotes only after real engagements close. Nothing here is invented.</p>
              <ArrowLink href={ROUTES.testimonials} style={{ marginTop: 22, fontSize: 14 }}>
                Our policy on proof
              </ArrowLink>
            </Card>
          </Reveal>
          <Reveal>
            <Card variant="flagship" className="home-teaser-card" style={{ padding: 30, height: "100%" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>CAREERS</p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, lineHeight: 1.34, letterSpacing: "-.01em", margin: 0 }}>Five seniors. Five juniors. Every change reviewed.</p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--muted)", margin: "12px 0 0" }}>No junior change reaches production without a named senior review. That is how people grow here.</p>
              <ArrowLink href={ROUTES.careers} style={{ marginTop: 22, fontSize: 14 }}>
                How the team works
              </ArrowLink>
            </Card>
          </Reveal>
          <Reveal>
            <Card variant="flagship" className="home-teaser-card" style={{ padding: 30, height: "100%" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, letterSpacing: ".18em", color: "var(--muted)", margin: "0 0 16px" }}>COMMON QUESTIONS</p>
              {["How do we start?", "Fixed scope or dedicated team?"].map((q) => (
                <p key={q} style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 16, fontWeight: 500, lineHeight: 1.4, margin: "0 0 10px", paddingBottom: 12, borderBottom: "1px solid var(--hairline)" }}>
                  {q}
                </p>
              ))}
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 16, fontWeight: 500, lineHeight: 1.4, margin: 0 }}>Who owns the code?</p>
              <ArrowLink href={ROUTES.faq} style={{ marginTop: 22, fontSize: 14 }}>
                All questions
              </ArrowLink>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ac-hairline" style={{ position: "relative", overflow: "hidden" }}>
        <div aria-hidden="true" style={{ position: "absolute", bottom: "-40%", left: "50%", transform: "translateX(-50%)", width: "100vw", height: "60vw", maxHeight: 700, background: "radial-gradient(ellipse at 50% 100%, rgba(59,124,255,.20), rgba(106,79,224,.10) 40%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "clamp(72px,10vw,140px) clamp(20px,4vw,48px)", textAlign: "left" }}>
          <Reveal as="h2" style={{ fontFamily: "var(--font-space-grotesk)", fontWeight: 600, fontSize: "clamp(32px,5vw,58px)", lineHeight: 1.05, letterSpacing: "-.03em", margin: 0, maxWidth: "20ch" }}>
            Tell us what is costing you the most time, money or customer trust.
          </Reveal>
          <Reveal style={{ fontSize: "clamp(16px,1.5vw,18.5px)", lineHeight: 1.6, color: "var(--muted)", margin: "24px 0 0", maxWidth: "52ch" }}>
            A short qualification form, then a meeting. We reply from acevatechnology@gmail.com.
          </Reveal>
          <Reveal style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34 }}>
            <Link href={ROUTES.contact} className="ac-btn-primary" style={{ minHeight: 52, padding: "16px 26px" }}>
              Start a Project
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
            <a href="mailto:acevatechnology@gmail.com" className="ac-btn-ghost" style={{ minHeight: 52, padding: "16px 26px" }}>
              Email us directly
            </a>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
