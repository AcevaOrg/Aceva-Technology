import type { Metadata } from "next";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CAPS, getCapability, getAdjacentCapabilities } from "@/lib/data/caps";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import Reveal from "@/components/ui/Reveal";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ArrowLink from "@/components/ui/ArrowLink";
import styles from "./capability.module.css";

interface CapabilityPageProps {
  params: Promise<{ capability: string }>;
}

export function generateStaticParams() {
  return CAPS.map((cap) => ({ capability: cap.key }));
}

export async function generateMetadata({ params }: CapabilityPageProps): Promise<Metadata> {
  const { capability } = await params;
  const cap = getCapability(capability);
  if (!cap) {
    return { title: "Capability not found" };
  }
  return pageMetadata({
    title: cap.seoTitle,
    description: cap.seoDescription,
    path: capabilityRoute(cap.key),
    image: `/og/${cap.key}.jpg`,
  });
}

export default async function CapabilityPage({ params }: CapabilityPageProps) {
  const { capability } = await params;
  const cap = getCapability(capability);
  if (!cap) {
    notFound();
  }
  const { prev, next } = getAdjacentCapabilities(cap.key);
  const canonical = `${SITE_URL}${capabilityRoute(cap.key)}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        // Tells search engines what is actually being sold here, tied back to the
        // Organization declared once in the root layout.
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: cap.name,
        serviceType: cap.seoTitle,
        description: cap.lead,
        url: canonical,
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: "Worldwide",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: cap.name,
          itemListElement: cap.includes.map((item) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: item },
          })),
        },
      },
      {
        // Lets Google show "Home › Services › <capability>" instead of a raw URL.
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}${ROUTES.services}` },
          { "@type": "ListItem", position: 3, name: cap.name },
        ],
      },
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <section style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-50%",
            left: "-10%",
            width: "60vw",
            height: "60vw",
            maxWidth: 720,
            maxHeight: 720,
            background: "radial-gradient(circle at 50% 50%, rgba(59,124,255,.15), transparent 65%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1280,
            margin: "0 auto",
            padding: "calc(var(--nav-offset) + clamp(12px,2vw,28px)) clamp(20px,4vw,48px) clamp(44px,6vw,72px)",
          }}
        >
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--muted)" }}>
            <Link
              href={ROUTES.services}
              className={styles.crumbLink}
              style={{ background: "none", border: 0, padding: 0, color: "var(--muted)", fontSize: 13 }}
            >
              Capabilities
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" style={{ color: "var(--ink)" }}>{cap.name}</span>
          </nav>
          <p
            style={{
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: "11.5px",
              letterSpacing: ".2em",
              color: "var(--ice)",
              margin: "clamp(28px,4vw,44px) 0 18px",
            }}
          >
            CAPABILITY {cap.num}
          </p>
          <h1
            style={{
              fontFamily: "var(--font-space-grotesk)",
              fontWeight: 600,
              fontSize: "clamp(32px,5vw,58px)",
              lineHeight: 1.05,
              letterSpacing: "-.03em",
              margin: 0,
              maxWidth: "22ch",
            }}
          >
            {cap.name}
          </h1>
          <p
            style={{
              fontSize: "clamp(16.5px,1.5vw,19px)",
              lineHeight: 1.62,
              color: "var(--muted)",
              margin: "22px 0 0",
              maxWidth: "56ch",
            }}
          >
            {cap.lead}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
            <Button href={ROUTES.contact}>Discuss your project</Button>
            <Button href={ROUTES.work} variant="ghost">
              See the proof
            </Button>
          </div>
        </div>
      </section>

      <section>
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(48px,7vw,88px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: "clamp(30px,5vw,64px)",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: "11.5px",
                letterSpacing: ".2em",
                color: "var(--muted)",
                margin: "0 0 24px",
              }}
            >
              WHAT IT INCLUDES
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {cap.includes.map((item) => (
                <Reveal
                  key={item}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    padding: "18px 0",
                    borderTop: "1px solid var(--hairline)",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--electric)"
                    strokeWidth="2"
                    style={{ marginTop: 3, flex: "none" }}
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0 }}>{item}</p>
                </Reveal>
              ))}
            </div>
            <Reveal
              style={{
                fontFamily: "var(--font-space-grotesk)",
                fontSize: "clamp(20px,2.4vw,27px)",
                fontWeight: 500,
                lineHeight: 1.32,
                letterSpacing: "-.015em",
                margin: "clamp(32px,4vw,44px) 0 0",
                paddingLeft: 22,
                borderLeft: "2px solid var(--royal)",
              }}
            >
              {cap.sales}
            </Reveal>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Reveal>
              <Card style={{ padding: 26 }}>
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    letterSpacing: ".18em",
                    color: "var(--ice)",
                    margin: "0 0 14px",
                  }}
                >
                  WHEN YOU NEED IT
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)", margin: 0 }}>{cap.when}</p>
              </Card>
            </Reveal>
            <Reveal>
              <Card style={{ padding: 26, display: "flex", flexDirection: "column" }}>
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    letterSpacing: ".18em",
                    color: "var(--ice)",
                    margin: "0 0 14px",
                  }}
                >
                  HOW WE PROVE IT
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink)", margin: "0 0 16px" }}>{cap.proof}</p>
                <ArrowLink href={ROUTES.work} style={{ fontSize: 14, marginTop: "auto" }}>
                  Open in Experiments
                </ArrowLink>
              </Card>
            </Reveal>
            <Reveal>
              <Card style={{ padding: 26 }}>
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    letterSpacing: ".18em",
                    color: "var(--muted)",
                    margin: "0 0 14px",
                  }}
                >
                  WHAT WE WILL NOT PROMISE
                </p>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>{cap.limit}</p>
              </Card>
            </Reveal>
            <Reveal>
              <Card style={{ padding: 26 }}>
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    letterSpacing: ".18em",
                    color: "var(--muted)",
                    margin: "0 0 16px",
                  }}
                >
                  ENGAGEMENT TYPES
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  <li style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)", paddingLeft: 18, position: "relative" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--electric)" }}>·</span>
                    Fixed scope — written scope, milestones and acceptance criteria.
                  </li>
                  <li style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)", paddingLeft: 18, position: "relative" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--electric)" }}>·</span>
                    Dedicated team — senior-reviewed capacity, weekly demos.
                  </li>
                  <li style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink)", paddingLeft: 18, position: "relative" }}>
                    <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--electric)" }}>·</span>
                    Sprint first — a narrow paid proof before a large commitment.
                  </li>
                </ul>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      <section>
        <div
          className="ac-card-grid"
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            padding: "clamp(40px,5vw,64px) clamp(20px,4vw,48px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 14,
          }}
        >
          {prev ? (
            <Card href={capabilityRoute(prev.key)} style={{ textAlign: "left", padding: 24, minHeight: 110 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: ".16em",
                  color: "var(--muted)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M19 12H5M11 18l-6-6 6-6" />
                </svg>
                PREVIOUS
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: 19,
                  fontWeight: 500,
                  marginTop: 12,
                }}
              >
                {prev.name}
              </span>
            </Card>
          ) : (
            <div aria-hidden="true" />
          )}
          {next ? (
            <Card href={capabilityRoute(next.key)} style={{ textAlign: "left", padding: 24, minHeight: 110 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontFamily: "var(--font-jetbrains-mono)",
                  fontSize: 11,
                  letterSpacing: ".16em",
                  color: "var(--muted)",
                }}
              >
                NEXT
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-space-grotesk)",
                  fontSize: 19,
                  fontWeight: 500,
                  marginTop: 12,
                }}
              >
                {next.name}
              </span>
            </Card>
          ) : (
            <div aria-hidden="true" />
          )}
        </div>
      </section>
    </div>
  );
}
