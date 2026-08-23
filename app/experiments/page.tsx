import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Callout from "@/components/ui/Callout";
import Tag from "@/components/ui/Tag";
import KeyValueRow from "@/components/ui/KeyValueRow";
import PhoneFrame from "@/components/ui/PhoneFrame";
import KpiStat from "@/components/ui/KpiStat";
import ExperimentsTabs from "@/components/features/ExperimentsTabs";
import AutomationDemo from "@/components/features/AutomationDemo";
import styles from "./experiments.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Experiments — ACEVA Technology",
  description:
    "Concept demos and internal products, honestly labeled. None of these are client projects — no client names, no results, no invented metrics.",
});

type Severity = "CRITICAL" | "HIGH" | "MEDIUM";

interface RescueRow {
  area: string;
  finding: string;
  severity: Severity;
  recommendation: string;
}

const RESCUE_ROWS: RescueRow[] = [
  {
    area: "Authentication",
    finding: "Session tokens never expire; password reset can be replayed.",
    severity: "CRITICAL",
    recommendation: "Replace with a managed provider. Week 1.",
  },
  {
    area: "Deployment",
    finding: "Production is deployed from a laptop; no rollback path exists.",
    severity: "CRITICAL",
    recommendation: "Replace with CI, staging and a rollback. Week 2.",
  },
  {
    area: "Data model",
    finding: "Schema is sound; naming is inconsistent and undocumented.",
    severity: "MEDIUM",
    recommendation: "Keep. Document and rename in place.",
  },
  {
    area: "AI-generated code",
    finding: "Payment logic was generated and never reviewed; no tests.",
    severity: "HIGH",
    recommendation: "Senior review, then tests before any change.",
  },
  {
    area: "Performance",
    finding: "Booking list loads all records before rendering.",
    severity: "HIGH",
    recommendation: "Keep the screen. Paginate the query.",
  },
];

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: "var(--error)",
  HIGH: "var(--warning)",
  MEDIUM: "var(--muted)",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  CRITICAL: "rgba(224,80,59,.35)",
  HIGH: "rgba(224,169,59,.35)",
  MEDIUM: "var(--hairline)",
};

function SitePanel() {
  return (
    <section>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: "clamp(28px,4vw,56px)",
            alignItems: "start",
          }}
        >
          <div>
            <Tag variant="outline-ice">LIVE PROOF · DIGITAL EXPERIENCES</Tag>
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontWeight: 600,
                fontSize: "clamp(26px,3.4vw,38px)",
                lineHeight: 1.1,
                letterSpacing: "-.025em",
                margin: "20px 0 0",
              }}
            >
              The proof is the thing you are using.
            </h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "18px 0 0", maxWidth: "50ch" }}>
              Aceva&apos;s own site is the first capability demonstration: a product-grade buying experience rather
              than a brochure. It adapts to your situation, it works on a phone, and it loads fast on a normal
              connection.
            </p>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 30, borderTop: "1px solid var(--hairline)" }}>
              <KeyValueRow first label="Adaptive homepage" value="Three visitor paths, one page" />
              <KeyValueRow label="Mobile behavior" value="Native menu, sticky action bar" />
              <KeyValueRow label="Accessibility target" value="WCAG AA, keyboard complete" />
              <KeyValueRow label="Lead flow" value="Qualification form → meeting" />
            </div>
            <Link
              href={ROUTES.home}
              className={styles.backHomeBtn}
              style={{
                marginTop: 26,
                display: "inline-block",
                background: "none",
                border: "1px solid var(--hairline)",
                color: "var(--ink)",
                fontSize: 15,
                fontWeight: 500,
                padding: "14px 22px",
                borderRadius: 11,
                minHeight: 48,
              }}
            >
              Back to the homepage
            </Link>
          </div>
          <div
            style={{
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(20,20,24,.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 14px",
                borderBottom: "1px solid var(--hairline)",
                background: "var(--elevated)",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--hairline)" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--hairline)" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--hairline)" }} />
              <span
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  color: "var(--muted)",
                  background: "#0F0F13",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                  padding: "5px 10px",
                }}
              >
                {(process.env.NEXT_PUBLIC_SITE_URL ?? "https://acevatech.com").replace(/^https?:\/\//, "")}
              </span>
            </div>
            <div style={{ padding: "26px 24px 30px", background: "linear-gradient(180deg,#0F0F13,#141418)" }}>
              <p
                style={{
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 9,
                  letterSpacing: ".2em",
                  color: "var(--ice)",
                  margin: "0 0 14px",
                }}
              >
                ACEVA HOLDINGS / SOFTWARE DIVISION
              </p>
              <p
                style={{
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.08,
                  letterSpacing: "-.02em",
                  margin: 0,
                }}
              >
                Build what your business needs next.
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)", margin: "12px 0 0" }}>
                Aceva designs digital experiences, custom software, mobile products and intelligent systems.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <span
                  style={{
                    background: "var(--royal)",
                    color: "#fff",
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "9px 14px",
                    borderRadius: 8,
                  }}
                >
                  Start a Project
                </span>
                <span
                  style={{
                    border: "1px solid var(--hairline)",
                    color: "var(--ink)",
                    fontSize: 11.5,
                    padding: "9px 14px",
                    borderRadius: 8,
                  }}
                >
                  Explore Experiments
                </span>
              </div>
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--hairline)", display: "flex", gap: 6 }}>
                <span style={{ flex: 1, height: 44, border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--elevated)" }} />
                <span style={{ flex: 1, height: 44, border: "1px solid var(--electric)", borderRadius: 8, background: "var(--elevated)" }} />
                <span style={{ flex: 1, height: 44, border: "1px solid var(--hairline)", borderRadius: 8, background: "var(--elevated)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashPanel() {
  return (
    <section>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
        <Tag variant="outline-ice" style={{ color: "var(--muted)", borderColor: "var(--hairline)" }}>
          CONCEPT DEMO · FICTIONAL BRIEF · CUSTOM SOFTWARE
        </Tag>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(26px,3.4vw,38px)",
            lineHeight: 1.1,
            letterSpacing: "-.025em",
            margin: "20px 0 0",
          }}
        >
          An operations dashboard for a mid-sized logistics team.
        </h2>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", maxWidth: "58ch" }}>
          Users, permissions, tasks, data and reporting in one workflow. Built by Aceva on an invented brief — the
          company, people and numbers below are fictional.
        </p>

        <Reveal
          style={{
            marginTop: "clamp(28px,4vw,44px)",
            border: "1px solid var(--hairline)",
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(15,15,19,.5)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 18px",
              borderBottom: "1px solid var(--hairline)",
              background: "rgba(20,20,24,.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                fontFamily: "var(--font-space-grotesk)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: ".02em",
              }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "linear-gradient(135deg,#1E4FD9,#3B7CFF)" }} />
              Freightline Ops
            </span>
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 10,
                letterSpacing: ".14em",
                color: "#4b4f5b",
                border: "1px solid var(--hairline)",
                borderRadius: 999,
                padding: "4px 9px",
              }}
            >
              FICTIONAL DEMO DATA
            </span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Dispatch — Amara O.</span>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--elevated)",
                  border: "1px solid var(--hairline)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "var(--ice)",
                }}
              >
                AO
              </span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,200px) minmax(0,1fr)", gap: 0 }}>
            <div
              style={{
                borderRight: "1px solid var(--hairline)",
                padding: "16px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                background: "#0D0D11",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--elevated)",
                  color: "var(--ink)",
                  fontSize: 13.5,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--electric)" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="7" height="9" />
                  <rect x="14" y="3" width="7" height="5" />
                  <rect x="14" y="12" width="7" height="9" />
                  <rect x="3" y="16" width="7" height="5" />
                </svg>
                Overview
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, color: "var(--muted)", fontSize: 13.5 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M3 7h13v10H3zM16 10h3l2 3v4h-5z" />
                  <circle cx="7" cy="18" r="1.6" />
                  <circle cx="17.5" cy="18" r="1.6" />
                </svg>
                Shipments
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, color: "var(--muted)", fontSize: 13.5 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v7H4V5h11" />
                </svg>
                Tasks
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, color: "var(--muted)", fontSize: 13.5 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
                  <path d="M17 11h4M19 9v4" />
                </svg>
                People &amp; roles
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, color: "var(--muted)", fontSize: 13.5 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M4 19V9M10 19V5M16 19v-6M22 19H2" />
                </svg>
                Reporting
              </span>
              <span style={{ marginTop: "auto", padding: 12, fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".12em", color: "#4b4f5b" }}>
                ROLE: DISPATCH
                <br />
                WRITE ACCESS: TASKS
              </span>
            </div>
            <div style={{ padding: 18, minWidth: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 16, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>OPEN JOBS</p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 27, fontWeight: 600, margin: 0, letterSpacing: "-.02em" }}>
                    <KpiStat value={128} />
                  </p>
                </div>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 16, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>ON TIME</p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 27, fontWeight: 600, margin: 0, letterSpacing: "-.02em", color: "var(--success)" }}>
                    <KpiStat value={94} suffix="%" />
                  </p>
                </div>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 16, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>OVERDUE</p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 27, fontWeight: 600, margin: 0, letterSpacing: "-.02em", color: "var(--warning)" }}>
                    <KpiStat value={7} />
                  </p>
                </div>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 16, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>AVG DWELL</p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 27, fontWeight: 600, margin: 0, letterSpacing: "-.02em" }}>
                    <KpiStat value={2.4} decimals={1} unit="days" />
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginTop: 10 }}>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--hairline)" }}>
                    <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 14.5, fontWeight: 500, margin: 0 }}>Tasks awaiting action</p>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--muted)" }}>4 OF 18</span>
                  </div>
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--hairline)" }}>
                      <span>
                        <span style={{ display: "block", fontSize: 14 }}>Reroute JOB-4412 — customs hold</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Owner: T. Reyes · Ops Manager</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--warning)", border: "1px solid rgba(224,169,59,.35)", borderRadius: 999, padding: "4px 9px" }}>BLOCKED</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--hairline)" }}>
                      <span>
                        <span style={{ display: "block", fontSize: 14 }}>Confirm dock slot — JOB-4418</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Owner: Amara O. · Dispatch</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--ice)", border: "1px solid rgba(127,178,255,.35)", borderRadius: 999, padding: "4px 9px" }}>YOURS</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--hairline)" }}>
                      <span>
                        <span style={{ display: "block", fontSize: 14 }}>Approve overtime — night crew</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Requires: Finance role</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "#4b4f5b", border: "1px solid var(--hairline)", borderRadius: 999, padding: "4px 9px" }}>LOCKED</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "13px 16px" }}>
                      <span>
                        <span style={{ display: "block", fontSize: 14 }}>Close out JOB-4390 — delivered</span>
                        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Owner: Amara O. · Dispatch</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "var(--success)", border: "1px solid rgba(47,190,122,.35)", borderRadius: 999, padding: "4px 9px" }}>READY</span>
                    </div>
                  </div>
                </div>
                <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: 16 }}>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 14.5, fontWeight: 500, margin: "0 0 4px" }}>On-time delivery, last 8 weeks</p>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "#4b4f5b", margin: "0 0 18px" }}>FICTIONAL SERIES</p>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                    <span style={{ flex: 1, height: "62%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "71%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "58%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "80%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "74%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "88%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "83%", background: "var(--elevated)", borderTop: "2px solid var(--electric)" }} />
                    <span style={{ flex: 1, height: "94%", background: "linear-gradient(180deg,rgba(59,124,255,.28),#1C1C22)", borderTop: "2px solid var(--ice)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, color: "#4b4f5b" }}>
                    <span>W1</span>
                    <span>W8</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)", margin: "20px 0 0", maxWidth: "60ch" }}>
          What this demonstrates: role-based permissions that visibly lock actions, a task queue built around
          ownership rather than status alone, and reporting a manager can read in one glance.
        </Reveal>
      </div>
    </section>
  );
}

function MobPanel() {
  return (
    <section>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
        <Tag variant="outline-ice" style={{ color: "var(--muted)", borderColor: "var(--hairline)" }}>
          CONCEPT DEMO · FICTIONAL BRIEF · MOBILE PRODUCTS
        </Tag>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(26px,3.4vw,38px)",
            lineHeight: 1.1,
            letterSpacing: "-.025em",
            margin: "20px 0 0",
          }}
        >
          One complete journey: sign in, find the job, finish it.
        </h2>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", maxWidth: "58ch" }}>
          A field-work app for the same fictional logistics brief. Four screens, one outcome — not ten disconnected
          screens.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(18px,3vw,32px)", marginTop: "clamp(30px,4vw,48px)" }}>
          <PhoneFrame footerLabel="STEP 1 / 4" caption="Sign-in with a code. One field, one button, no dead ends.">
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#1E4FD9,#3B7CFF)" }} />
            <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 22, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, margin: "18px 0 0" }}>
              Sign in to Freightline
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "8px 0 0" }}>
              Use your work email. We send a code — no password to forget.
            </p>
            <span style={{ display: "block", marginTop: 20, fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: ".14em", color: "var(--muted)" }}>
              WORK EMAIL
            </span>
            <span
              style={{
                display: "block",
                marginTop: 7,
                border: "1px solid var(--electric)",
                borderRadius: 10,
                padding: "13px 12px",
                fontSize: 13.5,
                background: "rgba(20,20,24,.55)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              amara@freightline.demo
            </span>
            <span style={{ display: "block", marginTop: 12, background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 10 }}>
              Send code
            </span>
          </PhoneFrame>

          <PhoneFrame footerLabel="STEP 2 / 4" caption="Verification with a visible resend timer — no silent failure." delay={80}>
            <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, margin: 0 }}>
              Enter the 6-digit code
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "8px 0 0" }}>Sent to amara@freightline.demo</p>
            <span style={{ display: "flex", gap: 7, marginTop: 22 }}>
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--hairline)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 16 }}>4</span>
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--hairline)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 16 }}>1</span>
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--hairline)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-jetbrains-mono)", fontSize: 16 }}>8</span>
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--electric)", borderRadius: 9, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }} />
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--hairline)", borderRadius: 9 }} />
              <span style={{ flex: 1, aspectRatio: "1", border: "1px solid var(--hairline)", borderRadius: 9 }} />
            </span>
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "16px 0 0" }}>Resend in 0:24</p>
          </PhoneFrame>

          <Reveal delay={160} style={{ width: 252, flex: "none" }}>
            <div style={{ border: "1px solid var(--hairline)", borderRadius: 30, padding: 9, background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <div style={{ borderRadius: 22, overflow: "hidden", background: "var(--void)", height: 480, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px 6px", fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, color: "var(--muted)" }}>
                  <span>9:41</span>
                  <span>▮▮▮</span>
                </div>
                <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--hairline)" }}>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>Tuesday · 3 stops left</p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 600, letterSpacing: "-.02em", margin: "5px 0 0" }}>Your route</p>
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 12, alignItems: "flex-start", background: "rgba(20,20,24,.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--electric)", marginTop: 6 }} />
                    <span>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 500 }}>JOB-4418 · Dock 3</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Pier 12 · 10:15 window</span>
                    </span>
                  </div>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--hairline)", marginTop: 6 }} />
                    <span>
                      <span style={{ display: "block", fontSize: 14 }}>JOB-4421 · Warehouse B</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Bay 4 · 12:00 window</span>
                    </span>
                  </div>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hairline)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--hairline)", marginTop: 6 }} />
                    <span>
                      <span style={{ display: "block", fontSize: 14 }}>JOB-4425 · Cross-dock</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Gate 2 · 14:30 window</span>
                    </span>
                  </div>
                </div>
                <div style={{ padding: "12px 16px 16px" }}>
                  <span style={{ display: "block", background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 10 }}>
                    Start JOB-4418
                  </span>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9, letterSpacing: ".12em", color: "#4b4f5b", textAlign: "center", margin: "12px 0 0" }}>
                    STEP 3 / 4
                  </p>
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "14px 0 0" }}>The next action is always the largest thing on screen.</p>
          </Reveal>

          <PhoneFrame footerLabel="STEP 4 / 4" caption="A real outcome, and the next action offered immediately." delay={240}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "1px solid rgba(47,190,122,.4)",
                background: "rgba(47,190,122,.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.4" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.18, margin: "18px 0 0" }}>
              JOB-4418 closed out
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "8px 0 0" }}>
              Proof of delivery uploaded. Dispatch has been notified and the customer sees the update.
            </p>
            <span style={{ display: "block", width: "100%", marginTop: 20, padding: "13px 14px", border: "1px solid var(--hairline)", borderRadius: 10, fontSize: 12.5, color: "var(--muted)" }}>
              Signed by M. Duarte · 10:22
            </span>
            <span style={{ display: "block", width: "100%", marginTop: 10, background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 10 }}>
              Next stop
            </span>
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}

function AutoPanel() {
  return (
    <section>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
        <Tag variant="outline-ice" style={{ color: "var(--muted)", borderColor: "var(--hairline)" }}>
          INTERACTIVE DEMO · INTELLIGENCE &amp; AUTOMATION
        </Tag>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(26px,3.4vw,38px)",
            lineHeight: 1.1,
            letterSpacing: "-.025em",
            margin: "20px 0 0",
          }}
        >
          One controlled automation, with a human in the loop.
        </h2>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", maxWidth: "58ch" }}>
          Request, data lookup, proposed action, human approval, system update. Step through it — the automation
          cannot complete without your decision.
        </p>
        <AutomationDemo />
        <Reveal style={{ fontSize: 14.5, lineHeight: 1.65, color: "var(--muted)", margin: "22px 0 0", maxWidth: "62ch" }}>
          What this demonstrates: automation that stops at the decision, an audit trail by default, and a refusal to
          call a chatbot an agent. AI proposes; a named person approves.
        </Reveal>
      </div>
    </section>
  );
}

function RescuePanel() {
  return (
    <section>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
        <Tag variant="outline-ice">SAMPLE DELIVERABLE · PRODUCT RESCUE &amp; RELIABILITY</Tag>
        <h2
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontWeight: 600,
            fontSize: "clamp(26px,3.4vw,38px)",
            lineHeight: 1.1,
            letterSpacing: "-.025em",
            margin: "20px 0 0",
          }}
        >
          What a Rescue Report looks like before you pay for a rebuild.
        </h2>
        <p style={{ fontSize: 16.5, lineHeight: 1.65, color: "var(--muted)", margin: "16px 0 0", maxWidth: "58ch" }}>
          A sample report on an invented product. Findings, severity, what to keep, what to replace, and a
          30/60/90-day plan.
        </p>

        <Reveal
          style={{
            marginTop: "clamp(28px,4vw,44px)",
            border: "1px solid var(--hairline)",
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(20,20,24,.55)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div
            style={{
              padding: "24px clamp(18px,3vw,30px)",
              borderBottom: "1px solid var(--hairline)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 20,
            }}
          >
            <div>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>
                PRODUCT UNDER REVIEW
              </p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, margin: 0 }}>Kestrel Booking (fictional)</p>
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 0" }}>Handover from a previous team · 14 weeks of work</p>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>VERDICT</p>
              <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 500, margin: 0, color: "var(--success)" }}>Recoverable</p>
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 0" }}>Keep the data model. Replace the auth and deployment layers.</p>
            </div>
            <div>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", margin: "0 0 10px" }}>FINDINGS</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--error)", border: "1px solid rgba(224,80,59,.35)", borderRadius: 999, padding: "5px 10px" }}>2 CRITICAL</span>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--warning)", border: "1px solid rgba(224,169,59,.35)", borderRadius: 999, padding: "5px 10px" }}>3 HIGH</span>
                <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 11, color: "var(--muted)", border: "1px solid var(--hairline)", borderRadius: 999, padding: "5px 10px" }}>4 MEDIUM</span>
              </div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: "left", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", fontWeight: 400, padding: "14px clamp(18px,3vw,30px)", borderBottom: "1px solid var(--hairline)" }}>
                    AREA
                  </th>
                  <th scope="col" style={{ textAlign: "left", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", fontWeight: 400, padding: "14px 16px", borderBottom: "1px solid var(--hairline)" }}>
                    FINDING
                  </th>
                  <th scope="col" style={{ textAlign: "left", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", fontWeight: 400, padding: "14px 16px", borderBottom: "1px solid var(--hairline)" }}>
                    SEVERITY
                  </th>
                  <th scope="col" style={{ textAlign: "left", fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--muted)", fontWeight: 400, padding: "14px clamp(18px,3vw,30px)", borderBottom: "1px solid var(--hairline)" }}>
                    RECOMMENDATION
                  </th>
                </tr>
              </thead>
              <tbody>
                {RESCUE_ROWS.map((row, i) => {
                  const border = i < RESCUE_ROWS.length - 1 ? "1px solid var(--hairline)" : undefined;
                  return (
                    <tr key={row.area}>
                      <td style={{ fontSize: 14.5, padding: "15px clamp(18px,3vw,30px)", borderBottom: border, verticalAlign: "top" }}>{row.area}</td>
                      <td style={{ fontSize: 14.5, color: "var(--muted)", padding: "15px 16px", borderBottom: border, verticalAlign: "top" }}>{row.finding}</td>
                      <td style={{ padding: "15px 16px", borderBottom: border, verticalAlign: "top" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-jetbrains-mono)",
                            fontSize: 10.5,
                            color: SEVERITY_COLOR[row.severity],
                            border: `1px solid ${SEVERITY_BORDER[row.severity]}`,
                            borderRadius: 999,
                            padding: "4px 9px",
                          }}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td style={{ fontSize: 14.5, padding: "15px clamp(18px,3vw,30px)", borderBottom: border, verticalAlign: "top" }}>{row.recommendation}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 0, borderTop: "1px solid var(--hairline)" }}>
            <div style={{ padding: "24px clamp(18px,3vw,30px)", borderRight: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>FIRST 30 DAYS</p>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
                Stop the bleeding: auth replaced, deployment pipeline in place, error monitoring on, backups verified.
              </p>
            </div>
            <div style={{ padding: "24px clamp(18px,3vw,30px)", borderRight: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>DAYS 30–60</p>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
                Stabilize: payment path reviewed and tested, booking list paginated, documentation written for the
                kept schema.
              </p>
            </div>
            <div style={{ padding: "24px clamp(18px,3vw,30px)" }}>
              <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 10, letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>DAYS 60–90</p>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>
                Modernize with intent: the roadmap for what to rebuild, in what order, and what it buys the business.
              </p>
            </div>
          </div>
        </Reveal>
        <Reveal style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26, alignItems: "center" }}>
          <Link
            href={ROUTES.contact}
            className={styles.rescueCta}
            style={{
              background: "var(--royal)",
              border: 0,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              padding: "15px 24px",
              borderRadius: 11,
              minHeight: 50,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Request a Rescue Sprint
          </Link>
          <p style={{ fontSize: 14, color: "var(--muted)", margin: 0 }}>
            We do not quote a rescue before senior review, and we do not promise every product can be repaired.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export default function ExperimentsPage() {
  return (
    <div>
      <section style={{ borderBottom: "1px solid var(--hairline)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px) clamp(36px,5vw,56px)" }}>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "11.5px",
              letterSpacing: ".2em",
              color: "var(--ice)",
              margin: "0 0 20px",
              animation: "acFadeUp 700ms cubic-bezier(.16,1,.3,1) both",
            }}
          >
            EXPERIMENTS
          </p>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(32px,5.2vw,60px)",
              lineHeight: 1.05,
              letterSpacing: "-.03em",
              margin: 0,
              maxWidth: "22ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 60ms both",
            }}
          >
            Concept demos and internal products. Honestly labeled.
          </h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: "clamp(20px,4vw,56px)",
              marginTop: "clamp(24px,4vw,34px)",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 140ms both",
            }}
          >
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>
              Aceva is new. Rather than invent a portfolio, we show how we think and build. Every item below is our
              own work on a fictional brief or an internal product.
            </p>
            <Callout
              variant="info"
              style={{ display: "flex", gap: 14, alignItems: "flex-start", fontSize: 15, lineHeight: 1.6, color: "var(--ink)", margin: 0, padding: "18px 20px" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ice)" strokeWidth="1.8" style={{ marginTop: 2, flex: "none" }} aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v5h1" />
              </svg>
              None of these are client projects. No client names, no results, no metrics from work we have not done.
            </Callout>
          </div>
        </div>
      </section>

      <ExperimentsTabs
        site={<SitePanel />}
        dash={<DashPanel />}
        mob={<MobPanel />}
        auto={<AutoPanel />}
        rescue={<RescuePanel />}
      />
    </div>
  );
}
