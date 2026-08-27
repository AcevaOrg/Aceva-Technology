import type { CSSProperties, ReactNode } from "react";

/**
 * Ambient background for the "Proof, not portfolio" strip.
 *
 * The claim in that section is "Honest demonstrations, clearly labeled. Never
 * presented as client work." — so the animation is an evidence board: five
 * blueprint wireframes matching the five proof cards (this website, an ops
 * dashboard, an automation flow with a human approval step, a mobile journey,
 * a rescue report). A verification beam sweeps the board; as it passes, each
 * wireframe is wiped in and then stamped with the honest label it carries on
 * the card below — LIVE PROOF / CONCEPT DEMO / SAMPLE REPORT.
 *
 * Pure SVG + CSS, no JS. Two layouts share one artifact set and one timing
 * system: `wide` sweeps left-to-right across the section, `portrait` sweeps
 * top-to-bottom on narrow viewports. Styles live in app/globals.css (`pf-`).
 */

type ArtifactKey = "browser" | "dashboard" | "flow" | "phone" | "report";

/** Wireframes drawn at a local origin; w/h are the un-scaled bounds. */
const SHAPES: Record<ArtifactKey, { w: number; h: number; body: ReactNode }> = {
  browser: {
    w: 224,
    h: 152,
    body: (
      <>
        <rect x="0.7" y="0.7" width="222.6" height="150.6" rx="7" />
        <path d="M0 27H224" />
        <circle cx="14" cy="14" r="3.4" />
        <circle cx="28" cy="14" r="3.4" />
        <circle cx="42" cy="14" r="3.4" />
        <rect x="62" y="8" width="132" height="12" rx="6" />
        <rect x="16" y="43" width="88" height="48" rx="4" />
        <rect x="118" y="43" width="90" height="48" rx="4" />
        <path d="M16 107H208M16 123H160M16 137H120" />
      </>
    ),
  },
  dashboard: {
    w: 250,
    h: 170,
    body: (
      <>
        <rect x="0.7" y="0.7" width="248.6" height="168.6" rx="7" />
        <path d="M0 30H250M58 30V170" />
        <path d="M14 46H44M14 62H38M14 78H44M14 94H32" />
        <rect x="72" y="44" width="48" height="28" rx="4" />
        <rect x="130" y="44" width="48" height="28" rx="4" />
        <rect x="188" y="44" width="48" height="28" rx="4" />
        <path d="M72 152H236" />
        <path d="M82 152V128M104 152V106M126 152V118M148 152V92M170 152V112M192 152V84M214 152V100" />
      </>
    ),
  },
  flow: {
    w: 300,
    h: 100,
    body: (
      <>
        <rect x="0.7" y="30.7" width="61.6" height="38.6" rx="6" />
        <path d="M63 50H93M86 45l7 5-7 5" />
        <rect x="94.7" y="30.7" width="61.6" height="38.6" rx="6" />
        <path d="M157 50H188M181 45l7 5-7 5" />
        <path d="M213 25 238 50 213 75 188 50Z" />
        <path className="pf-accent" d="M205 50l6 6 12-13" />
        <path d="M238 50H268M261 45l7 5-7 5" />
        <rect x="269.7" y="30.7" width="29.6" height="38.6" rx="6" />
      </>
    ),
  },
  phone: {
    w: 92,
    h: 182,
    body: (
      <>
        <rect x="0.7" y="0.7" width="90.6" height="180.6" rx="13" />
        <path d="M34 11h24" />
        <rect x="12" y="26" width="68" height="46" rx="5" />
        <path d="M12 84H80M12 98H58M12 116H80M12 130H50" />
        <rect className="pf-accent" x="12" y="146" width="68" height="22" rx="11" />
      </>
    ),
  },
  report: {
    w: 180,
    h: 224,
    body: (
      <>
        <rect x="0.7" y="0.7" width="178.6" height="222.6" rx="7" />
        <path d="M18 28H104M18 44H140" />
        <path d="M0 62H180" />
        <circle cx="26" cy="84" r="5" />
        <path d="M42 84H150" />
        <circle className="pf-accent" cx="26" cy="112" r="5" />
        <path d="M42 112H124" />
        <circle cx="26" cy="140" r="5" />
        <path d="M42 140H144" />
        <circle cx="26" cy="168" r="5" />
        <path d="M42 168H108" />
        <path d="M18 198H120" />
      </>
    ),
  },
};

/** The honest label each demonstration carries — mirrors the cards below. */
const BADGE: Record<ArtifactKey, string> = {
  browser: "LIVE PROOF",
  dashboard: "CONCEPT DEMO",
  flow: "CONCEPT DEMO",
  phone: "CONCEPT DEMO",
  report: "SAMPLE REPORT",
};

type Item = { key: ArtifactKey; x: number; y: number; s: number };

type Layout = {
  variant: "wide" | "portrait";
  vbw: number;
  vbh: number;
  /** Axis the verification beam travels along. */
  dir: "x" | "y";
  /** Beam start and end along that axis, in user units. */
  from: number;
  to: number;
  items: Item[];
};

/** One shared loop length keeps the beam and the artifact reveals in phase. */
const CYCLE = 14;

/**
 * The proof strip is much taller than it is wide once the cards wrap, so the
 * board is authored tall (3:2) — a wide-and-short viewBox would `slice` down to
 * a heavily zoomed sliver. Artifacts sit in the middle band for the same reason.
 */
const WIDE: Layout = {
  variant: "wide",
  vbw: 1200,
  vbh: 800,
  dir: "x",
  from: -60,
  to: 1260,
  items: [
    { key: "browser", x: 64, y: 140, s: 1 },
    { key: "flow", x: 250, y: 560, s: 1 },
    { key: "dashboard", x: 372, y: 118, s: 1 },
    { key: "phone", x: 708, y: 418, s: 1 },
    { key: "report", x: 908, y: 160, s: 1 },
  ],
};

const PORTRAIT: Layout = {
  variant: "portrait",
  vbw: 460,
  vbh: 640,
  dir: "y",
  from: -60,
  to: 700,
  items: [
    { key: "browser", x: 26, y: 36, s: 0.78 },
    { key: "phone", x: 300, y: 60, s: 0.78 },
    { key: "report", x: 290, y: 250, s: 0.78 },
    { key: "dashboard", x: 30, y: 262, s: 0.78 },
    { key: "flow", x: 60, y: 486, s: 0.78 },
  ],
};

/** Seconds into the cycle at which the beam reaches an item's leading edge. */
function beamDelay(layout: Layout, item: Item) {
  const speed = (layout.to - layout.from) / CYCLE;
  const lead = layout.dir === "x" ? item.x : item.y;
  return ((lead - layout.from) / speed).toFixed(2) + "s";
}

function Board({ layout }: { layout: Layout }) {
  const { variant, vbw, vbh, dir } = layout;
  const id = (s: string) => "pf-" + variant + "-" + s;
  const url = (s: string) => "url(#" + id(s) + ")";

  return (
    <svg
      className={"pf-root pf-root--" + variant}
      viewBox={"0 0 " + vbw + " " + vbh}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={id("grid")} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="rgba(127,178,255,0.075)" strokeWidth="1" />
        </pattern>
        <linearGradient
          id={id("beam")}
          x1="0"
          y1="0"
          x2={dir === "x" ? "1" : "0"}
          y2={dir === "x" ? "0" : "1"}
        >
          <stop offset="0" stopColor="#7fb2ff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#7fb2ff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#7fb2ff" stopOpacity="0" />
        </linearGradient>
        <filter id={id("soft")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>

        {layout.items.map((item) => {
          const { w, h } = SHAPES[item.key];
          return (
            <clipPath id={id("wipe-" + item.key)} key={item.key}>
              <rect
                className="pf-wipe"
                x={item.x}
                y={item.y}
                width={w * item.s}
                height={h * item.s}
                style={{ animationDelay: beamDelay(layout, item) }}
              />
            </clipPath>
          );
        })}
      </defs>

      <rect width={vbw} height={vbh} fill={url("grid")} />

      {layout.items.map((item) => {
        const shape = SHAPES[item.key];
        const delay = beamDelay(layout, item);
        const tagY = item.y + shape.h * item.s + 22;
        const place =
          "translate(" + item.x + " " + item.y + ") scale(" + item.s + ")";
        return (
          <g key={item.key}>
            <g
              className="pf-artifact"
              clipPath={url("wipe-" + item.key)}
              style={{ animationDelay: delay }}
            >
              <g transform={place}>{shape.body}</g>
            </g>
            <g
              className="pf-tag"
              transform={"translate(" + item.x + " " + tagY + ")"}
              style={{ animationDelay: delay }}
            >
              <path className="pf-tag-check" d="M0 -4l4 4 8-9" />
              <text className="pf-tag-text" x="20" y="0">
                {BADGE[item.key]}
              </text>
            </g>
          </g>
        );
      })}

      <g
        className={"pf-beam pf-beam--" + dir}
        style={{ "--pf-from": layout.from + "px", "--pf-to": layout.to + "px" } as CSSProperties}
      >
        {dir === "x" ? (
          <>
            <rect x="-30" y="0" width="60" height={vbh} fill={url("beam")} />
            <rect className="pf-beam-line" x="-1" y="0" width="2" height={vbh} filter={url("soft")} />
          </>
        ) : (
          <>
            <rect x="0" y="-30" width={vbw} height="60" fill={url("beam")} />
            <rect className="pf-beam-line" x="0" y="-1" width={vbw} height="2" filter={url("soft")} />
          </>
        )}
      </g>
    </svg>
  );
}

export default function ProofBoard() {
  return (
    <>
      <Board layout={WIDE} />
      <Board layout={PORTRAIT} />
    </>
  );
}
