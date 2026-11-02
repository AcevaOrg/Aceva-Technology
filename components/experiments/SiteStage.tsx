"use client";

import { useId, useState } from "react";
import { HERO } from "@/components/home/content";
import { c } from "./cx";

const PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: "Text on ink", fg: "--x-fg-ink", bg: "--x-ink" },
  { name: "Muted text on ink", fg: "--x-muted-ink", bg: "--x-ink" },
  { name: "Labels on ink", fg: "--x-ice", bg: "--x-ink" },
  { name: "Text on paper", fg: "--x-fg-paper", bg: "--x-paper" },
  { name: "Muted text on paper", fg: "--x-muted-paper", bg: "--x-paper" },
  { name: "Blue links on paper", fg: "--x-blue", bg: "--x-paper" },
];

interface Readout {
  contrast: { name: string; fg: string; bg: string; ratio: number }[];
  type: [string, string][];
  reduced: boolean;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function grade(r: number): string {
  return r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "AA large" : "Fails";
}

/** Reads the real tokens and sizes from this page in the visitor's browser. Nothing here is a claim. */
function measure(root: HTMLElement): Readout {
  const style = getComputedStyle(root);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const px = (selector: string) => {
    const el = document.querySelector(selector);
    return el ? `${Math.round(parseFloat(getComputedStyle(el).fontSize))}px` : "n/a";
  };
  return {
    contrast: PAIRS.map(({ name, fg, bg }) => {
      const f = token(fg);
      const b = token(bg);
      return { name, fg: f, bg: b, ratio: f.startsWith("#") && b.startsWith("#") ? ratio(f, b) : 0 };
    }),
    type: [
      ["Page title (H1)", px("#exp-hero-title")],
      ["Section titles (H2)", px("#this-website-title")],
      ["Body text", px("[data-exp-body]")],
      ["Your window width", `${window.innerWidth}px`],
    ],
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export default function SiteStage() {
  const [open, setOpen] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);
  const panelId = useId();

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const root = document.querySelector<HTMLElement>("[data-experiments-root]");
      if (root) setReadout(measure(root));
    }
  };

  return (
    <>
      <figure>
        <div className={c("browser")} data-xray={open ? "" : undefined}>
          <div className={c("b-bar")} aria-hidden="true">
            <span className={c("dots")}>
              <i />
              <i />
              <i />
            </span>
            <span className={c("b-url")}>acevatech.com</span>
          </div>
          <div className={c("b-view")} aria-hidden="true">
            <span className={c("m-beam")} />
            <span className={c("m-nav")}>
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div className={c("m-hero")}>
              <p className={c("m-kick")}>{HERO.kicker}</p>
              <p className={c("m-h1")}>
                {HERO.lines.map((line) => (
                  <span key={line.verb}>
                    <b>{line.verb}</b> {line.rest}
                  </span>
                ))}
              </p>
              <p className={c("m-lede")}>{HERO.lede}</p>
              <span className={c("m-btns")}>
                <span className={c("m-btn")}>Start a project</span>
                <span className={c("m-btn", "ghost")}>See the proof</span>
              </span>
            </div>
            <div className={c("xgrid")}>
              {Array.from({ length: 12 }, (_, n) => (
                <i key={n} />
              ))}
            </div>
            <span className={c("pin")} style={{ left: "46%", top: "30%" }}>H1 · Space Grotesk 500 · −0.045em</span>
            <span className={c("pin")} style={{ left: "34%", top: "76%" }}>Blue is for actions only</span>
            <span className={c("pin")} style={{ left: "78%", top: "14%" }}>Slash at 64°</span>
            <span className={c("pin")} style={{ left: "8%", top: "93%" }}>12 columns · 4vw gutter</span>
          </div>
        </div>
        <figcaption className={c("sr")}>
          A miniature of the current Aceva homepage hero: “Build what’s next. Improve what runs. Rescue what’s stuck.”
        </figcaption>
      </figure>

      <div>
        <button type="button" className={c("xbtn")} aria-expanded={open} aria-controls={panelId} onClick={toggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          <span>{open ? "Close X-ray" : "X-ray this page"}</span>
        </button>
      </div>

      <div className={c("xpanel")} id={panelId} hidden={!open}>
        {readout ? (
          <>
            <div className={c("xcols")}>
              <div>
                <h3>Contrast, computed now</h3>
                <dl>
                  {readout.contrast.map((row) => (
                    <div className={c("xrow")} key={row.name}>
                      <span className={c("sw")} style={{ background: row.bg, color: row.fg }}>
                        Aa
                      </span>
                      <dt>{row.name}</dt>
                      <dd>
                        {row.ratio ? `${row.ratio.toFixed(1)}:1` : "n/a"}
                        {row.ratio ? <span className={c("grade")}>{grade(row.ratio)}</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h3>Type at your screen</h3>
                <dl>
                  {readout.type.map(([k, v]) => (
                    <div className={c("xrow")} key={k}>
                      <span />
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3 style={{ marginTop: 18 }}>Motion</h3>
                <dl>
                  <div className={c("xrow")}>
                    <span />
                    <dt>Reduced motion requested</dt>
                    <dd>{readout.reduced ? "Yes · animation off" : "No · full motion"}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <p className={c("xnote")}>
              Read from this page in your browser just now. Nothing here is a claim; change your window width and reopen it to
              see the numbers change.
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
