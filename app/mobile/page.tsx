import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Reveal from "@/components/ui/Reveal";
import PhoneFrame from "@/components/ui/PhoneFrame";
import { MailIcon, CloseIcon, CheckIcon } from "@/components/ui/icons";

export const metadata: Metadata = pageMetadata({
  title: "Mobile Layouts — ACEVA Technology",
  description: "A design-review page for the team: the mobile decisions behind this site, shown at device scale.",
  noIndex: true,
});

const STATS = [
  {
    label: "BREAKPOINTS",
    body: "375 · 768 · 1024 · 1440+. Multi-column sections collapse to one column below 768; the desktop nav appears at 1000.",
  },
  {
    label: "TOUCH TARGETS",
    body: "Nothing interactive under 44px. Primary actions are 52px and full width.",
  },
  {
    label: "TYPE FLOOR",
    body: "Body never below 15px. Mono labels are tracked, never shrunk below 10px.",
  },
  {
    label: "MOTION",
    body: "Reveals are 620ms, staggered 60ms, and disabled entirely under prefers-reduced-motion.",
  },
];

/** Escapes PhoneFrame's built-in 20px padding + vertical centering so each mock screen can control its own edge-to-edge chrome. */
function ScreenFill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: -20, height: "calc(100% + 40px)", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

function CaptionBlock({ kicker, body }: { kicker: string; body: string }) {
  return (
    <>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: "10.5px",
          letterSpacing: ".14em",
          color: "var(--ice)",
          marginBottom: 6,
        }}
      >
        {kicker}
      </span>
      <span style={{ display: "block", fontSize: 14, lineHeight: 1.6, color: "var(--muted)" }}>{body}</span>
    </>
  );
}

export default function MobilePage() {
  return (
    <div>
      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "calc(var(--nav-offset) + clamp(16px,3vw,32px)) clamp(20px,4vw,48px) clamp(40px,6vw,64px)" }}>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 11.5,
              letterSpacing: ".2em",
              color: "var(--ice)",
              margin: "0 0 20px",
              animation: "acFadeUp 700ms cubic-bezier(.16,1,.3,1) both",
            }}
          >
            MOBILE LAYOUTS
          </p>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(32px,5.2vw,60px)",
              lineHeight: 1.05,
              letterSpacing: "-.03em",
              margin: 0,
              maxWidth: "20ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 60ms both",
            }}
          >
            Redesigned for the phone, not stacked.
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: "var(--muted)",
              margin: "24px 0 0",
              maxWidth: "58ch",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 140ms both",
            }}
          >
            A design-review page for the team: the mobile decisions behind this site, shown at device scale. Resize the
            browser to see the same layouts run live.
          </p>
        </div>
      </section>

      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "clamp(40px,6vw,80px) clamp(20px,4vw,48px)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(20px,3vw,36px)" }}>
            {/* 01 · HOME */}
            <PhoneFrame
              width={266}
              height={520}
              radius={32}
              caption={
                <CaptionBlock
                  kicker="01 · HOME"
                  body="Headline at 25px so it still reads as a statement. Both CTAs full width, 52px tall, above the fold. The sticky bar keeps the primary action in reach at any scroll depth."
                />
              }
            >
              <ScreenFill>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px 12px", borderBottom: "1px solid var(--hairline)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 18, height: 18, background: "linear-gradient(135deg,#F5F6F8 45%,#3B7CFF 45%)", borderRadius: 3 }} />
                    <span style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 12, fontWeight: 600, letterSpacing: ".14em" }}>ACEVA</span>
                  </span>
                  <span style={{ width: 34, height: 34, border: "1px solid var(--hairline)", borderRadius: 9, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <span style={{ width: 13, height: 1.4, background: "var(--ink)" }} />
                    <span style={{ width: 8, height: 1.4, background: "var(--muted)" }} />
                  </span>
                </div>
                <div style={{ flex: 1, padding: "20px 16px", overflow: "hidden" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".18em", color: "var(--ice)", margin: "0 0 12px" }}>
                    SOFTWARE DIVISION
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 25, fontWeight: 600, lineHeight: 1.06, letterSpacing: "-.025em", margin: 0 }}>
                    Build what your business needs next.
                  </p>
                  <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)", margin: "12px 0 0" }}>
                    Digital experiences, custom software, mobile products, intelligent systems — and rescue.
                  </p>
                  <span style={{ display: "block", marginTop: 18, background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 11 }}>
                    Start a Project
                  </span>
                  <span style={{ display: "block", marginTop: 9, border: "1px solid var(--hairline)", textAlign: "center", fontSize: 14, padding: 14, borderRadius: 11 }}>
                    Explore Experiments
                  </span>
                </div>
                <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--hairline)", background: "rgba(10,10,12,.9)", display: "flex", gap: 8 }}>
                  <span style={{ width: 46, height: 46, border: "1px solid var(--hairline)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MailIcon width={16} height={16} stroke="var(--ink)" strokeWidth={1.8} />
                  </span>
                  <span style={{ flex: 1, background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 14, borderRadius: 11 }}>
                    Start a Project
                  </span>
                </div>
              </ScreenFill>
            </PhoneFrame>

            {/* 02 · NAVIGATION */}
            <PhoneFrame
              width={266}
              height={520}
              radius={32}
              caption={
                <CaptionBlock
                  kicker="02 · NAVIGATION"
                  body="Full-screen sheet rather than a dropdown. Four primary destinations at 21px, secondary links in a two-column grid, contact actions pinned at the bottom where the thumb is."
                />
              }
            >
              <ScreenFill>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px 12px", borderBottom: "1px solid var(--hairline)" }}>
                  <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: ".2em", color: "var(--muted)" }}>MENU</span>
                  <span style={{ width: 34, height: 34, border: "1px solid var(--hairline)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CloseIcon width={14} height={14} stroke="var(--ink)" strokeWidth={2} />
                  </span>
                </div>
                <div style={{ flex: 1, padding: "8px 16px", overflow: "hidden" }}>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, margin: 0, padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
                    Capabilities
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, margin: 0, padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
                    Experiments
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, margin: 0, padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
                    How We Work
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 21, fontWeight: 500, margin: 0, padding: "16px 0", borderBottom: "1px solid var(--hairline)" }}>
                    Why Aceva
                  </p>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 9.5, letterSpacing: ".2em", color: "var(--muted)", margin: "20px 0 8px" }}>
                    COMPANY
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 14px" }}>
                    <span style={{ fontSize: 13.5, color: "var(--muted)", padding: "10px 0" }}>About Us</span>
                    <span style={{ fontSize: 13.5, color: "var(--muted)", padding: "10px 0" }}>Technology</span>
                    <span style={{ fontSize: 13.5, color: "var(--muted)", padding: "10px 0" }}>Industries</span>
                    <span style={{ fontSize: 13.5, color: "var(--muted)", padding: "10px 0" }}>Careers</span>
                  </div>
                </div>
                <div style={{ padding: "12px 16px 16px" }}>
                  <span style={{ display: "block", background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 15, borderRadius: 11 }}>
                    Start a Project
                  </span>
                  <span style={{ display: "block", marginTop: 9, border: "1px solid var(--hairline)", textAlign: "center", fontSize: 13, padding: 15, borderRadius: 11, color: "var(--ink)" }}>
                    acevatech.official@gmail.com
                  </span>
                </div>
              </ScreenFill>
            </PhoneFrame>

            {/* 03 · PATH SELECTOR */}
            <PhoneFrame
              width={266}
              height={520}
              radius={32}
              caption={
                <CaptionBlock
                  kicker="03 · PATH SELECTOR"
                  body="On mobile the three cards lose their body copy and become tappable statements; the re-framed panel opens directly beneath the selection instead of in a second column."
                />
              }
            >
              <ScreenFill>
                <div style={{ padding: "8px 16px 14px", borderBottom: "1px solid var(--hairline)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".18em", color: "var(--ice)", margin: "0 0 8px" }}>
                    01 — ORIENTATION
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 20, fontWeight: 600, letterSpacing: "-.02em", margin: 0 }}>
                    Where are you right now?
                  </p>
                </div>
                <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 9, overflow: "hidden" }}>
                  <span style={{ border: "1px solid var(--electric)", background: "var(--elevated)", borderRadius: 12, padding: 14 }}>
                    <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".16em", color: "var(--ice)" }}>PATH A</span>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <CheckIcon width={9} height={9} strokeWidth={3.4} />
                      </span>
                    </span>
                    <span style={{ display: "block", fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, marginTop: 8 }}>
                      I am starting something new
                    </span>
                  </span>
                  <span style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 14 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".16em", color: "var(--ice)" }}>PATH B</span>
                    <span style={{ display: "block", fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, marginTop: 8 }}>
                      I need to improve my business
                    </span>
                  </span>
                  <span style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: 14 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".16em", color: "var(--ice)" }}>PATH C</span>
                    <span style={{ display: "block", fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, marginTop: 8 }}>
                      I already built something, but it needs help
                    </span>
                  </span>
                  <span style={{ marginTop: 2, borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
                    <span style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".16em", color: "var(--ice)" }}>
                      YOUR PATH — STARTING SOMETHING NEW
                    </span>
                    <span style={{ display: "block", fontFamily: "var(--font-space-grotesk)", fontSize: 15, fontWeight: 500, lineHeight: 1.3, marginTop: 8 }}>
                      Turn the idea into a scope, a prototype and a production build.
                    </span>
                  </span>
                </div>
              </ScreenFill>
            </PhoneFrame>

            {/* 04 · FORM & ERROR STATE */}
            <PhoneFrame
              width={266}
              height={520}
              radius={32}
              caption={
                <CaptionBlock
                  kicker="04 · FORM & ERROR STATE"
                  body="One field per row, 48px minimum height, labels above inputs. Errors are text plus icon plus border — never color alone — and the submit stays docked at the bottom of the sheet."
                />
              }
            >
              <ScreenFill>
                <div style={{ padding: "8px 16px 14px", borderBottom: "1px solid var(--hairline)" }}>
                  <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: 8.5, letterSpacing: ".18em", color: "var(--ice)", margin: "0 0 8px" }}>
                    START A PROJECT
                  </p>
                  <p style={{ fontFamily: "var(--font-space-grotesk)", fontSize: 19, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.15, margin: 0 }}>
                    What is costing you the most?
                  </p>
                </div>
                <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
                  <span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Your name</span>
                    <span style={{ display: "block", border: "1px solid var(--hairline)", borderRadius: 10, padding: 13, fontSize: 13, color: "#4b4f5b" }}>
                      Jordan Ellis
                    </span>
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Work email</span>
                    <span style={{ display: "block", border: "1px solid var(--electric)", borderRadius: 10, padding: 13, fontSize: 13 }}>
                      you@company.com
                    </span>
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Where you are right now</span>
                    <span style={{ display: "flex", justifyContent: "space-between", border: "1px solid var(--hairline)", borderRadius: 10, padding: 13, fontSize: 13 }}>
                      Starting something new<span style={{ color: "var(--muted)" }}>▾</span>
                    </span>
                  </span>
                  <span
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      fontSize: 11.5,
                      lineHeight: 1.5,
                      color: "var(--ink)",
                      padding: "11px 12px",
                      border: "1px solid rgba(224,80,59,.4)",
                      borderRadius: 10,
                      background: "rgba(224,80,59,.08)",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth={2} style={{ marginTop: 1, flex: "none" }} aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v5M12 16h.01" />
                    </svg>
                    Add a work email so we can reply.
                  </span>
                </div>
                <div style={{ padding: "10px 16px 16px", borderTop: "1px solid var(--hairline)" }}>
                  <span style={{ display: "block", background: "var(--royal)", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: 15, borderRadius: 11 }}>
                    Send to a senior
                  </span>
                </div>
              </ScreenFill>
            </PhoneFrame>
          </div>

          <Reveal
            style={{
              marginTop: "clamp(36px,5vw,60px)",
              borderTop: "1px solid var(--hairline)",
              paddingTop: "clamp(28px,4vw,44px)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 24,
            }}
          >
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p style={{ fontFamily: "var(--font-jetbrains-mono)", fontSize: "10.5px", letterSpacing: ".14em", color: "var(--electric)", margin: "0 0 12px" }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{stat.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </div>
  );
}
