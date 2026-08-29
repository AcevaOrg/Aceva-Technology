import type { ReactNode } from "react";

/**
 * Animated recreation of the old process-bg.png: a glowing infinity loop with
 * five labelled icon-nodes (Understand -> Design -> Build -> Launch -> Improve)
 * that light up in sequence while an energy pulse traces the loop. Pure SVG +
 * CSS, no JS. Decorative, full-bleed section background (aria-hidden — the words
 * also exist as real text in the section).
 *
 * Two layouts share one node/animation system:
 *   - `wide`    : horizontal figure-8, covers the section on tablet/desktop.
 *   - `portrait`: vertical figure-8, shown as a top strip on narrow phones
 *                 where the wide loop would only crop to an unreadable sliver.
 * CSS (`app/globals.css`, `pl-` prefix) shows exactly one via media query.
 *
 * Motion lives entirely in CSS, so the global prefers-reduced-motion rule
 * disables it and the reduced-motion block settles it into a clean static state.
 */

type IconKey = "understand" | "design" | "build" | "launch" | "improve";

const ICONS: Record<IconKey, ReactNode> = {
  understand: (
    <>
      <path d="M-4 -6a5 5 0 0 1 9 3c0 3-3 4-3 6a3 3 0 0 1-6 0" />
      <path d="M-1.5 -2a2 2 0 0 1 3 0" />
    </>
  ),
  design: (
    <>
      <path d="M-7 7 -5 1 4 -8 7 -5 -2 4Z" />
      <path d="M2 -6 5 -3" />
    </>
  ),
  build: (
    <>
      <circle r="3.4" />
      <path d="M0 -8V-5M0 5V8M-8 0H-5M5 0H8M-5.7 -5.7l2.1 2.1M3.6 3.6l2.1 2.1M5.7 -5.7l-2.1 2.1M-3.6 3.6l-2.1 2.1" />
    </>
  ),
  launch: (
    <>
      <path d="M0 -9c3 2 4 6 4 9l-2 2h-4l-2-2c0-3 1-7 4-9Z" />
      <path d="M-4 2 -7 6 -3 5M4 2 7 6 3 5" />
      <circle cy="-2" r="1.6" />
    </>
  ),
  improve: (
    <>
      <path d="M0 8V0" />
      <path d="M0 0c0-4 3-6 7-6 0 4-3 6-7 6Z" />
      <path d="M0 2c0-3-2-5-5-5 0 3 2 5 5 5Z" />
    </>
  ),
};

const ORDER: IconKey[] = ["understand", "design", "build", "launch", "improve"];
const DELAY: Record<IconKey, string> = {
  understand: "0s",
  design: "1.2s",
  build: "2.4s",
  launch: "3.6s",
  improve: "4.8s",
};
const LABEL: Record<IconKey, string> = {
  understand: "Understand",
  design: "Design",
  build: "Build",
  launch: "Launch",
  improve: "Improve",
};

type Anchor = "start" | "middle" | "end";
type Placed = { x: number; y: number; lx: number; ly: number; anchor: Anchor };

type Layout = {
  variant: "wide" | "portrait";
  viewBox: string;
  path: string;
  haze: { cx: number; cy: number; rx: number; ry: number };
  reflectAxis: number; // matrix(1 0 0 -1 0 <axis>)
  reflectMask: { y: number; h: number };
  nodes: Record<IconKey, Placed>;
};

// Horizontal figure-eight (four cubic segments). pathLength is normalised to
// 1000 on every stroked copy so the dash animation is geometry-independent.
const WIDE: Layout = {
  variant: "wide",
  viewBox: "0 0 1200 470",
  path:
    "M600 230 C778.75 45 925 128.25 925 230 C925 331.75 778.75 415 600 230 " +
    "C421.25 45 275 128.25 275 230 C275 331.75 421.25 415 600 230 Z",
  haze: { cx: 600, cy: 230, rx: 460, ry: 225 },
  reflectAxis: 740,
  reflectMask: { y: 350, h: 120 },
  nodes: {
    understand: { x: 370, y: 122, lx: 370, ly: 74, anchor: "middle" },
    design: { x: 830, y: 122, lx: 830, ly: 74, anchor: "middle" },
    build: { x: 925, y: 230, lx: 956, ly: 261, anchor: "start" },
    launch: { x: 830, y: 338, lx: 830, ly: 390, anchor: "middle" },
    improve: { x: 370, y: 338, lx: 370, ly: 390, anchor: "middle" },
  },
};

// Vertical figure-eight for narrow / portrait viewports (phones + tablets).
const PORTRAIT: Layout = {
  variant: "portrait",
  viewBox: "0 0 460 620",
  path:
    "M230 320 C385 210 315.25 120 230 120 C144.75 120 75 210 230 320 " +
    "C385 430 315.25 520 230 520 C144.75 520 75 430 230 320 Z",
  haze: { cx: 230, cy: 320, rx: 210, ry: 270 },
  reflectAxis: 1050,
  reflectMask: { y: 520, h: 100 },
  nodes: {
    understand: { x: 140, y: 179, lx: 140, ly: 137, anchor: "middle" },
    design: { x: 320, y: 179, lx: 320, ly: 137, anchor: "middle" },
    build: { x: 230, y: 320, lx: 263, ly: 325, anchor: "start" },
    launch: { x: 320, y: 461, lx: 320, ly: 508, anchor: "middle" },
    improve: { x: 140, y: 461, lx: 140, ly: 508, anchor: "middle" },
  },
};

// Deterministic starfield (fixed seed -> stable output for SSR).
let seed = 1337;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const STARS = Array.from({ length: 34 }, () => ({
  fx: +rand().toFixed(4),
  fy: +rand().toFixed(4),
  r: +(0.6 + rand() * 1.3).toFixed(2),
  delay: +(rand() * 5).toFixed(2),
  dur: +(3 + rand() * 4).toFixed(2),
}));

function LoopSvg({ layout }: { layout: Layout }) {
  const v = layout.variant;
  const id = (s: string) => `pl-${v}-${s}`;
  const [, , vbw, vbh] = layout.viewBox.split(" ").map(Number);
  const { path } = layout;

  return (
    <svg
      className={`pl-root pl-root--${v}`}
      viewBox={layout.viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id("haze")}>
          <stop offset="0" stopColor="rgba(59,124,255,0.16)" />
          <stop offset="1" stopColor="rgba(59,124,255,0)" />
        </radialGradient>
        <radialGradient id={id("nodeglow")}>
          <stop offset="0" stopColor="rgba(122,178,255,0.9)" />
          <stop offset="1" stopColor="rgba(122,178,255,0)" />
        </radialGradient>
        <filter id={id("soft")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <linearGradient id={id("reflgrad")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.32" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id("reflmask")}>
          <rect
            x="0"
            y={layout.reflectMask.y}
            width={vbw}
            height={layout.reflectMask.h}
            fill={`url(#${id("reflgrad")})`}
          />
        </mask>
      </defs>

      <ellipse
        cx={layout.haze.cx}
        cy={layout.haze.cy}
        rx={layout.haze.rx}
        ry={layout.haze.ry}
        fill={`url(#${id("haze")})`}
      />

      {STARS.map((s, i) => (
        <circle
          className="pl-star"
          key={i}
          cx={+(s.fx * vbw).toFixed(1)}
          cy={+(s.fy * vbh).toFixed(1)}
          r={s.r}
          style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
        />
      ))}

      <use
        href={`#${id("loop")}`}
        className="pl-reflection"
        mask={`url(#${id("reflmask")})`}
        style={{ transform: `matrix(1, 0, 0, -1, 0, ${layout.reflectAxis})` }}
      />

      <g id={id("loop")}>
        <path className="pl-rail" d={path} pathLength={1000} />
        <path className="pl-core" d={path} pathLength={1000} filter={`url(#${id("soft")})`} />
        <path className="pl-core-bright" d={path} pathLength={1000} />
        <path className="pl-flow-glow" d={path} pathLength={1000} filter={`url(#${id("soft")})`} />
        <path
          className="pl-flow-glow pl-flow-glow--2"
          d={path}
          pathLength={1000}
          filter={`url(#${id("soft")})`}
        />
        <path className="pl-flow" d={path} pathLength={1000} />
        <path className="pl-flow pl-flow--2" d={path} pathLength={1000} />

        {ORDER.map((key) => {
          const n = layout.nodes[key];
          return (
            <g className="pl-node" key={key} style={{ animationDelay: DELAY[key] }}>
              <circle
                className="pl-node-glow"
                cx={n.x}
                cy={n.y}
                r={28}
                fill={`url(#${id("nodeglow")})`}
                style={{ animationDelay: DELAY[key] }}
              />
              <circle className="pl-node-ring" cx={n.x} cy={n.y} r={20} />
              <g className="pl-node-icon" transform={`translate(${n.x} ${n.y})`}>
                {ICONS[key]}
              </g>
              <text className="pl-node-label" x={n.lx} y={n.ly} textAnchor={n.anchor}>
                {LABEL[key]}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function ProcessLoop() {
  return (
    <>
      <LoopSvg layout={WIDE} />
      <LoopSvg layout={PORTRAIT} />
    </>
  );
}
