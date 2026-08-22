import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { CAPS } from "@/lib/data/caps";
import { capabilityRoute } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import { ArrowRightIcon } from "@/components/ui/icons";
import styles from "./services.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Services — ACEVA Technology",
  description:
    "Five capabilities, each written in business language: what it includes, when you need it, and what we will not promise.",
});

export default function ServicesPage() {
  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--hairline)" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-40%",
            right: "-5%",
            width: "60vw",
            height: "60vw",
            maxWidth: 760,
            maxHeight: 760,
            background: "radial-gradient(circle at 50% 50%, rgba(59,124,255,.14), transparent 66%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(56px,8vw,104px) clamp(20px,4vw,48px) clamp(44px,6vw,72px)",
          }}
        >
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
            CAPABILITIES
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
            Five capabilities. One accountable engineering partner.
          </h1>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
              gap: "clamp(20px,4vw,56px)",
              marginTop: "clamp(26px,4vw,38px)",
              animation: "acFadeUp 800ms cubic-bezier(.16,1,.3,1) 140ms both",
            }}
          >
            <p style={{ fontSize: 17, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>
              Keep these five and do not add more at launch. Each one is written in business language: what it
              includes, when you need it, and what we will not promise.
            </p>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--muted)",
                margin: 0,
                paddingLeft: 22,
                borderLeft: "2px solid var(--hairline)",
              }}
            >
              We are not claiming these five services are unique — global firms already sell them. Aceva
              differentiates through clarity, proof, Product Rescue, client ownership and transparent delivery.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 clamp(20px,4vw,48px) clamp(56px,8vw,104px)" }}>
          {CAPS.map((cap) => (
            <Reveal key={cap.key}>
              <Link
                href={capabilityRoute(cap.key)}
                className={styles.row}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: 0,
                  borderBottom: "1px solid var(--hairline)",
                  padding: "clamp(28px,4vw,44px) 0",
                  color: "var(--ink)",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                  gap: "clamp(18px,3vw,48px)",
                }}
              >
                <div style={{ display: "flex", gap: 18 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono)",
                      fontSize: 11,
                      letterSpacing: ".14em",
                      color: "var(--electric)",
                      paddingTop: 8,
                    }}
                  >
                    {cap.num}
                  </span>
                  <span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-space-grotesk)",
                        fontSize: "clamp(22px,2.6vw,30px)",
                        fontWeight: 500,
                        lineHeight: 1.16,
                        letterSpacing: "-.02em",
                      }}
                    >
                      {cap.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 15,
                        lineHeight: 1.62,
                        color: "var(--muted)",
                        marginTop: 12,
                        maxWidth: "38ch",
                      }}
                    >
                      {cap.lead}
                    </span>
                  </span>
                </div>
                <div>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cap.includes.map((item) => (
                      <span
                        key={item}
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          border: "1px solid var(--hairline)",
                          borderRadius: 999,
                          padding: "6px 12px",
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      marginTop: 20,
                      fontSize: 14,
                      color: "var(--ice)",
                    }}
                  >
                    Open capability
                    <ArrowRightIcon />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
