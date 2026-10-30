import type { CSSProperties } from "react";
import { PROCESS_PHASES } from "@/lib/data/process";
import styles from "./loop.module.css";

/*
 * Ring geometry in a 400 × 400 viewBox: five nodes, 72° apart, starting at the top and running
 * clockwise. The main arc runs Understand → Improve (288°); the closing arc runs Improve → back to
 * Understand (72°) and is crossed by the logo's slash, which marks where one loop hands over to
 * the next. Rounded to two decimals so server and browser render identical markup.
 */
const C = 200;
const R = 130;
const LABEL_R = 166;
const round = (n: number) => Math.round(n * 100) / 100;
const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: round(C + r * Math.cos(a)), y: round(C + r * Math.sin(a)) };
};

const SIDES = ["top", "right", "right", "left", "left"] as const;

const NODES = PROCESS_PHASES.map((phase, i) => {
  const deg = -90 + i * 72;
  return { ...phase, k: i + 1, ...at(deg, R), label: at(deg, LABEL_R), side: SIDES[i] };
});

const first = NODES[0];
const last = NODES[NODES.length - 1];
const MAIN = `M ${first.x} ${first.y} A ${R} ${R} 0 1 1 ${last.x} ${last.y}`;
const CLOSE = `M ${last.x} ${last.y} A ${R} ${R} 0 0 1 ${first.x} ${first.y}`;
/* the full track as two half-circle arcs: pathLength is reliable on <path> in every browser */
const TRACK = `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C} ${C + R} A ${R} ${R} 0 1 1 ${C} ${C - R}`;

/* a small slash, leaning at the logo's 64°, centred on the closing arc */
const mid = at(-126, R);
const SLASH = [
  [mid.x + 4.3, mid.y - 17],
  [mid.x + 12.3, mid.y - 17],
  [mid.x - 4.3, mid.y + 17],
  [mid.x - 12.3, mid.y + 17],
]
  .map(([x, y]) => `${round(x)},${round(y)}`)
  .join(" ");

type Variant = "hero" | "stage" | "mini";

/**
 * The loop diagram. `hero` draws itself in and carries an orbiting light; `stage` is driven by
 * PhaseSpy's variables (--n, --ap) from an ancestor; `mini` is the same ring at badge size.
 * Always decorative: the phases it pictures are real headings elsewhere on the page.
 */
export default function LoopRing({ variant }: { variant: Variant }) {
  return (
    <div className={[styles.ring, styles[variant]].filter(Boolean).join(" ")} aria-hidden="true">
      <div className={styles.spin}>
        <svg viewBox="0 0 400 400" className={styles.svg}>
          <path d={TRACK} pathLength={100} className={styles.track} />
          <path d={MAIN} pathLength={100} className={styles.main} />
          <path d={CLOSE} pathLength={100} className={styles.close} />
          <polygon points={SLASH} className={styles.slash} />
          {NODES.map((node) => (
            <g key={node.key} className={styles.node} data-k={node.k} style={{ "--k": node.k } as CSSProperties}>
              <circle cx={node.x} cy={node.y} r={30} className={styles.halo} />
              <circle cx={node.x} cy={node.y} r={21} className={styles.nodeBase} />
              <circle cx={node.x} cy={node.y} r={21} className={styles.nodeFill} />
              {variant !== "mini" && (
                <text x={node.x} y={node.y} dy="0.36em" textAnchor="middle" className={styles.nodeNum}>
                  {node.n}
                </text>
              )}
            </g>
          ))}
        </svg>
        {variant === "hero" && <span className={styles.orbit} />}
      </div>

      {variant !== "mini" &&
        NODES.map((node) => (
          <span
            key={node.key}
            className={styles.label}
            data-side={node.side}
            data-k={node.k}
            style={{ left: `${node.label.x / 4}%`, top: `${node.label.y / 4}%`, "--k": node.k } as CSSProperties}
          >
            {node.title}
          </span>
        ))}

      {variant === "stage" && (
        <span className={styles.center}>
          <span data-ph="0">
            <small>Starts at</small>
            <b>Understand</b>
          </span>
          {NODES.map((node) => (
            <span key={node.key} data-ph={node.k}>
              <small>Phase {node.n} of 05</small>
              <b>{node.title}</b>
              {node.k === NODES.length && <em>Then back to Understand</em>}
            </span>
          ))}
          <span data-ph="all">
            <small>Five phases</small>
            <b>One loop</b>
          </span>
        </span>
      )}
    </div>
  );
}
