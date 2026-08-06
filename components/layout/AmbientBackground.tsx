"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

type Variant =
  | "home"
  | "services"
  | "capDetail"
  | "work"
  | "process"
  | "about"
  | "company"
  | "technology"
  | "industries"
  | "testimonials"
  | "careers"
  | "insights"
  | "faq"
  | "contact"
  | "mobile"
  | "legal"
  | null;

function variantFor(pathname: string): Variant {
  if (pathname === "/") return "home";
  if (pathname === "/services") return "services";
  if (pathname.startsWith("/services/")) return "capDetail";
  if (pathname === "/experiments") return "work";
  if (pathname === "/process") return "process";
  if (pathname === "/about") return "about";
  if (pathname === "/company") return "company";
  if (pathname === "/technology") return "technology";
  if (pathname === "/industries") return "industries";
  if (pathname === "/testimonials") return "testimonials";
  if (pathname === "/careers") return "careers";
  if (pathname === "/insights") return "insights";
  if (pathname === "/faq") return "faq";
  if (pathname === "/contact") return "contact";
  if (pathname === "/mobile") return "mobile";
  if (pathname.startsWith("/legal/")) return "legal";
  return null;
}

const abs: CSSProperties = { position: "absolute", inset: 0 };

function Layer({ children }: { children: React.ReactNode }) {
  return <div style={abs}>{children}</div>;
}

export default function AmbientBackground() {
  const pathname = usePathname();
  const variant = variantFor(pathname);

  return (
    <div data-bg aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      {variant === "home" && (
        <Layer>
          <div style={{ position: "absolute", top: "-30%", left: "-25%", width: "150%", height: "160%", backgroundImage: "repeating-linear-gradient(90deg,rgba(59,124,255,.07) 0 1px,transparent 1px 120px)", animation: "acBgLeft 26s linear infinite" }} />
          <div style={{ position: "absolute", top: "-40%", right: "-30%", width: "80vw", height: "80vw", maxWidth: 1000, maxHeight: 1000, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,124,255,.13),transparent 62%)", animation: "acBgGlow 30s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-45%", left: "-15%", width: "70vw", height: "70vw", maxWidth: 860, maxHeight: 860, borderRadius: "50%", background: "radial-gradient(circle,rgba(106,79,224,.10),transparent 64%)", animation: "acBgGlowAlt 38s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "services" && (
        <Layer>
          <div style={{ position: "absolute", top: "-40%", left: 0, width: "100%", height: "180%", backgroundImage: "repeating-linear-gradient(0deg,rgba(59,124,255,.09) 0 1px,transparent 1px 120px)", animation: "acBgUp 22s linear infinite" }} />
          <div style={{ position: "absolute", top: 0, left: "12%", width: 1, height: "100%", background: "linear-gradient(180deg,transparent,rgba(127,178,255,.5),transparent)", animation: "acBgSweepDown 14s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: 0, right: "22%", width: 1, height: "100%", background: "linear-gradient(180deg,transparent,rgba(127,178,255,.35),transparent)", animation: "acBgSweepDown 19s ease-in-out infinite 4s" }} />
        </Layer>
      )}
      {variant === "capDetail" && (
        <Layer>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg,rgba(42,42,50,.55) 0 1px,transparent 1px 160px)" }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "38vh", background: "linear-gradient(180deg,transparent,rgba(59,124,255,.10),transparent)", animation: "acBgSweepDown 18s cubic-bezier(.4,0,.6,1) infinite" }} />
        </Layer>
      )}
      {variant === "work" && (
        <Layer>
          <div style={{ position: "absolute", top: "-20%", left: "-20%", width: "150%", height: "150%", backgroundImage: "radial-gradient(rgba(59,124,255,.16) 1px,transparent 1.4px)", backgroundSize: "90px 90px", animation: "acBgDiag 24s linear infinite" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: "min(120vw,1400px)", height: "min(120vw,1400px)", margin: "calc(min(120vw,1400px) / -2) 0 0 calc(min(120vw,1400px) / -2)", border: "1px solid rgba(59,124,255,.07)", borderRadius: "50%", animation: "acBgRot 90s linear infinite" }} />
        </Layer>
      )}
      {variant === "process" && (
        <Layer>
          <div style={{ position: "absolute", top: 0, left: "8%", width: 1, height: "100%", background: "repeating-linear-gradient(180deg,rgba(59,124,255,.35) 0 14px,transparent 14px 30px)", animation: "acBgDown 6s linear infinite" }} />
          <div style={{ position: "absolute", top: 0, left: "38%", width: 1, height: "100%", background: "repeating-linear-gradient(180deg,rgba(59,124,255,.18) 0 14px,transparent 14px 30px)", animation: "acBgDown 9s linear infinite" }} />
          <div style={{ position: "absolute", top: 0, right: "14%", width: 1, height: "100%", background: "repeating-linear-gradient(180deg,rgba(59,124,255,.24) 0 14px,transparent 14px 30px)", animation: "acBgDown 7.5s linear infinite" }} />
          <div style={{ position: "absolute", bottom: "-30%", right: "-20%", width: "60vw", height: "60vw", maxWidth: 760, maxHeight: 760, borderRadius: "50%", background: "radial-gradient(circle,rgba(30,79,217,.12),transparent 64%)", animation: "acBgGlow 34s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "about" && (
        <Layer>
          <div style={{ position: "absolute", top: "22%", right: "14%", width: "44vw", height: "44vw", maxWidth: 600, maxHeight: 600, border: "1px solid rgba(59,124,255,.22)", borderRadius: "50%", animation: "acBgRadar 12s ease-out infinite" }} />
          <div style={{ position: "absolute", top: "22%", right: "14%", width: "44vw", height: "44vw", maxWidth: 600, maxHeight: 600, border: "1px solid rgba(59,124,255,.18)", borderRadius: "50%", animation: "acBgRadar 12s ease-out infinite 4s" }} />
          <div style={{ position: "absolute", top: "22%", right: "14%", width: "44vw", height: "44vw", maxWidth: 600, maxHeight: 600, border: "1px solid rgba(59,124,255,.14)", borderRadius: "50%", animation: "acBgRadar 12s ease-out infinite 8s" }} />
        </Layer>
      )}
      {variant === "company" && (
        <Layer>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: "linear-gradient(rgba(59,124,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(59,124,255,.08) 1px,transparent 1px)", backgroundSize: "140px 140px", animation: "acBgBreathe 16s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "-25%", left: "30%", width: "50vw", height: "50vw", maxWidth: 660, maxHeight: 660, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,124,255,.10),transparent 66%)", animation: "acBgFloat 26s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "technology" && (
        <Layer>
          <div style={{ position: "absolute", top: "-30%", left: 0, width: "100%", height: "180%", backgroundImage: "repeating-linear-gradient(180deg,rgba(127,178,255,.07) 0 2px,transparent 2px 10px)", animation: "acBgUp 8s linear infinite" }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "26vh", background: "linear-gradient(180deg,transparent,rgba(59,124,255,.09),transparent)", animation: "acBgSweepDown 11s linear infinite" }} />
        </Layer>
      )}
      {variant === "industries" && (
        <Layer>
          <div style={{ position: "absolute", top: 0, left: "6%", width: "18%", height: "100%", background: "linear-gradient(180deg,transparent,rgba(59,124,255,.07),transparent)", animation: "acBgFloat 18s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: 0, left: "41%", width: "18%", height: "100%", background: "linear-gradient(180deg,transparent,rgba(59,124,255,.09),transparent)", animation: "acBgFloat 24s ease-in-out infinite 2s" }} />
          <div style={{ position: "absolute", top: 0, right: "8%", width: "18%", height: "100%", background: "linear-gradient(180deg,transparent,rgba(106,79,224,.08),transparent)", animation: "acBgFloat 21s ease-in-out infinite 4s" }} />
        </Layer>
      )}
      {variant === "testimonials" && (
        <Layer>
          <div style={{ position: "absolute", top: "-30%", left: "-30%", width: "160%", height: "160%", backgroundImage: "repeating-linear-gradient(135deg,rgba(59,124,255,.06) 0 1px,transparent 1px 90px)", animation: "acBgDiag 30s linear infinite" }} />
          <div style={{ position: "absolute", bottom: "-35%", left: "20%", width: "60vw", height: "60vw", maxWidth: 720, maxHeight: 720, borderRadius: "50%", background: "radial-gradient(circle,rgba(30,79,217,.11),transparent 66%)", animation: "acBgGlowAlt 32s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "careers" && (
        <Layer>
          <div style={{ position: "absolute", top: "18%", left: "-20%", width: "150%", height: 1, background: "repeating-linear-gradient(90deg,rgba(59,124,255,.34) 0 18px,transparent 18px 44px)", animation: "acBgLeft 9s linear infinite" }} />
          <div style={{ position: "absolute", top: "52%", left: "-20%", width: "150%", height: 1, background: "repeating-linear-gradient(90deg,rgba(59,124,255,.22) 0 18px,transparent 18px 44px)", animation: "acBgLeft 13s linear infinite" }} />
          <div style={{ position: "absolute", top: "81%", left: "-20%", width: "150%", height: 1, background: "repeating-linear-gradient(90deg,rgba(59,124,255,.16) 0 18px,transparent 18px 44px)", animation: "acBgLeft 17s linear infinite" }} />
        </Layer>
      )}
      {variant === "insights" && (
        <Layer>
          <div style={{ position: "absolute", inset: "-15%", backgroundImage: "radial-gradient(rgba(127,178,255,.13) 1px,transparent 1.4px)", backgroundSize: "120px 120px", animation: "acBgFloat 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", inset: "-15%", backgroundImage: "radial-gradient(rgba(59,124,255,.10) 1px,transparent 1.4px)", backgroundSize: "64px 64px", animation: "acBgFloat 15s ease-in-out infinite reverse" }} />
        </Layer>
      )}
      {variant === "faq" && (
        <Layer>
          <div style={{ position: "absolute", top: "5%", left: "12%", width: "46vw", height: "46vw", maxWidth: 620, maxHeight: 620, borderRadius: "50%", background: "radial-gradient(circle,rgba(59,124,255,.11),transparent 64%)", animation: "acBgGlow 24s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: 0, right: "6%", width: "40vw", height: "40vw", maxWidth: 540, maxHeight: 540, borderRadius: "50%", background: "radial-gradient(circle,rgba(30,79,217,.13),transparent 64%)", animation: "acBgGlowAlt 28s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "contact" && (
        <Layer>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: "linear-gradient(90deg,rgba(42,42,50,.5) 1px,transparent 1px)", backgroundSize: "110px 110px" }} />
          <div style={{ position: "absolute", bottom: "-40%", left: "50%", width: "90vw", height: "70vw", maxWidth: 1100, maxHeight: 820, marginLeft: "-45vw", borderRadius: "50%", background: "radial-gradient(ellipse,rgba(59,124,255,.16),transparent 62%)", animation: "acBgFloat 20s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "mobile" && (
        <Layer>
          <div style={{ position: "absolute", inset: "-10%", backgroundImage: "linear-gradient(rgba(59,124,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(59,124,255,.07) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
          <div style={{ position: "absolute", top: 0, left: 0, width: "34vw", height: "100%", background: "linear-gradient(90deg,transparent,rgba(59,124,255,.10),transparent)", animation: "acBgSweepRight 16s ease-in-out infinite" }} />
        </Layer>
      )}
      {variant === "legal" && (
        <Layer>
          <div style={{ position: "absolute", top: "-40%", left: 0, width: "100%", height: "180%", backgroundImage: "repeating-linear-gradient(0deg,rgba(42,42,50,.45) 0 1px,transparent 1px 44px)", animation: "acBgUp 40s linear infinite" }} />
        </Layer>
      )}
    </div>
  );
}
