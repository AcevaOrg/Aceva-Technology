import type { CSSProperties } from "react";
import Scrub from "@/components/home/Scrub";
import { PROVENANCE, type Provenance } from "@/lib/data/experiments";
import { c } from "./cx";
import PointerDrift from "./PointerDrift";

const BARS = [38, 54, 46, 70, 62, 84, 58, 76];

const SPECIMENS = [
  { key: "site", bar: "01 · Live" },
  { key: "dashboard", bar: "02 · Fictional" },
  { key: "mobile", bar: "03 · Fictional" },
  { key: "automation", bar: "04 · Fictional" },
  { key: "rescue", bar: "05 · Sample" },
  { key: "pulse", bar: "06 · Live" },
] as const;

function Preview({ kind }: { kind: (typeof SPECIMENS)[number]["key"] }) {
  switch (kind) {
    case "site":
      return (
        <div className={c("pv", "pv-site")}>
          <span className={c("pv-beam")} />
          <span className={c("pv-l")} style={{ width: "64%" }} />
          <span className={c("pv-l")} style={{ width: "72%" }} />
          <span className={c("pv-l")} style={{ width: "52%" }} />
          <span className={c("pv-cta")} />
        </div>
      );
    case "dashboard":
      return (
        <div className={c("pv", "pv-dash")}>
          <span className={c("pv-side")} />
          <span className={c("pv-main")}>
            <span className={c("pv-kpis")}>
              <span />
              <span />
              <span />
            </span>
            <span className={c("pv-bars")}>
              {BARS.map((h, n) => (
                <span key={n} style={{ "--h": `${h}%`, "--n": n } as CSSProperties} />
              ))}
            </span>
          </span>
        </div>
      );
    case "mobile":
      return (
        <div className={c("pv", "pv-phone")}>
          <span className={c("pv-ph")}>
            <span />
            <span className={c("on")} />
            <span />
            <span />
          </span>
        </div>
      );
    case "automation":
      return (
        <div className={c("pv", "pv-flow")}>
          {["REQ", "LOOK", "PROP", "OK?", "UPD"].map((label, n) => (
            <span key={label} className={c("pv-node", n === 3 && "gate")}>
              {label}
            </span>
          ))}
          <span className={c("pv-packet")} />
        </div>
      );
    case "rescue":
      return (
        <div className={c("pv", "pv-matrix")}>
          <span>Keep</span>
          <span>Remediate</span>
          <span>Replace</span>
          <span>Defer</span>
        </div>
      );
    default:
      return (
        <div className={c("pv", "pv-chat")}>
          <span />
          <span className={c("me")} />
          <span />
          <span className={c("typing")} />
        </div>
      );
  }
}

const KEY_PROVENANCE: Provenance[] = ["live", "fictional", "sample"];

export default function ExperimentsHero() {
  return (
    <section className={c("hero", "ink")} data-exp-hero aria-labelledby="exp-hero-title">
      <div className={c("wrap", "hero-grid")}>
        <div className={c("hero-head")}>
          <p className={c("eyebrow")}>
            <span className={c("slash")} aria-hidden="true" />
            <b>Experiments</b> / Proof, not portfolio
          </p>
          <h1 className={c("title")} id="exp-hero-title">
            <span className={c("line")}>
              <span>Concept demos you can use.</span>
            </span>
            <span className={c("line")}>
              <span>
                <i className={c("mark")} aria-hidden="true" />
                Honestly labeled.
              </span>
            </span>
          </h1>
        </div>

        <div className={c("hero-copy")}>
          <div className={c("hero-lede")}>
            <strong>Don’t take our word for it. Use the work.</strong>
            <p>
              Aceva is new. Rather than invent a portfolio, we show how we think and build. Every item below is our own work
              on a fictional brief or an internal product.
            </p>
          </div>

          <div className={c("plate")}>
            <p className={c("plate-head")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8h.01M11 12h1v5h1" />
              </svg>
              None of these are client projects. No client names, no results, no metrics from work we have not done.
            </p>
            <dl>
              {KEY_PROVENANCE.map((kind) => (
                <div key={kind}>
                  <dt>
                    <span className={c("prov", kind === "fictional" ? "fict" : kind)}>
                      <i />
                      <span>{PROVENANCE[kind].label}</span>
                    </span>
                  </dt>
                  <dd>{PROVENANCE[kind].definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <Scrub start={0} end={0} className={c("cascade")}>
          <div data-exp-cascade aria-hidden="true" className={c("cascade-in")}>
            <span className={c("beam")}>
              <span className={c("beam-glow")} />
              <span className={c("beam-core")} />
            </span>
            {SPECIMENS.map((spec, i) => (
              <div key={spec.key} className={c("spec")} data-k={spec.key} style={{ "--i": i } as CSSProperties}>
                <div className={c("spec-in")}>
                  <div className={c("spec-bar")}>
                    <span>{spec.bar}</span>
                    <span className={c("dots")}>
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <Preview kind={spec.key} />
                </div>
              </div>
            ))}
          </div>
        </Scrub>
      </div>
      <PointerDrift />
    </section>
  );
}
