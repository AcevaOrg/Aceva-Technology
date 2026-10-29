"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  VERDICTS,
  type Finding,
  type Severity,
  type Verdict,
} from "@/lib/data/experiments";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { c } from "./cx";

type View = "register" | "matrix";
type Filter = "all" | Severity;

const VERDICT_KEYS = Object.keys(VERDICTS) as Verdict[];
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
];

/**
 * One data set, two views: the risk register (a real table, also what no-JS visitors and screen
 * readers get) and a keep / remediate / replace / defer matrix. Filtering by severity re-sorts
 * the matrix with a small FLIP animation made of plain Web Animations, so nothing page-wide is
 * snapshotted (a View Transition would crossfade the fixed header and buttons too).
 */
export default function TriageBoard({ findings }: { findings: Finding[] }) {
  const reduced = usePrefersReducedMotion();
  const [view, setView] = useState<View>("register");
  const [filter, setFilter] = useState<Filter>("all");
  const cards = useRef(new Map<number, HTMLLIElement>());
  const before = useRef<Map<number, DOMRect> | null>(null);

  const visible = (f: Finding) => filter === "all" || f.severity === filter;
  const shown = findings.filter(visible).length;

  const capture = () => {
    const rects = new Map<number, DOMRect>();
    cards.current.forEach((el, i) => {
      if (!el.hidden) rects.set(i, el.getBoundingClientRect());
    });
    before.current = rects;
  };

  const changeFilter = (next: Filter) => {
    capture();
    setFilter(next);
  };

  useLayoutEffect(() => {
    const first = before.current;
    before.current = null;
    if (!first || reduced || view !== "matrix") return;
    cards.current.forEach((el, i) => {
      if (el.hidden) return;
      const from = first.get(i);
      if (!from) {
        el.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], {
          duration: 420,
          easing: "cubic-bezier(.16,1,.3,1)",
        });
        return;
      }
      const to = el.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], {
          duration: 520,
          easing: "cubic-bezier(.16,1,.3,1)",
        });
      }
    });
  }, [filter, view, reduced]);

  return (
    <>
      <div className={c("rctrl")}>
        <div className={c("seg-row")}>
          <span className={c("try")}>Try it</span>
          <fieldset className={c("seg")}>
            <legend>View</legend>
            <label>
              <input type="radio" name="exp-view" checked={view === "register"} onChange={() => setView("register")} />
              Risk register
            </label>
            <label>
              <input type="radio" name="exp-view" checked={view === "matrix"} onChange={() => setView("matrix")} />
              Triage matrix
            </label>
          </fieldset>
        </div>
        <div className={c("seg-row")}>
          <fieldset className={c("seg")}>
            <legend>Severity</legend>
            {FILTERS.map((f) => (
              <label key={f.value}>
                <input type="radio" name="exp-sev" checked={filter === f.value} onChange={() => changeFilter(f.value)} />
                {f.label}
              </label>
            ))}
          </fieldset>
          <p className={c("status")} role="status">
            Showing {shown} of {findings.length} findings
          </p>
        </div>
      </div>

      <div className={c("views")}>
        <div className={c("reg")} role="region" aria-label="Risk register" tabIndex={0} hidden={view !== "register"}>
          <table>
            <caption>Risk register · {findings.length} findings</caption>
            <thead>
              <tr>
                <th scope="col">AREA</th>
                <th scope="col">FINDING</th>
                <th scope="col">SEVERITY</th>
                <th scope="col">RECOMMENDATION</th>
                <th scope="col">VERDICT</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i} hidden={!visible(f)}>
                  <td>{f.area}</td>
                  <td>{f.finding}</td>
                  <td>
                    <span className={c("sev", f.severity.toLowerCase())}>{f.severity}</span>
                  </td>
                  <td>{f.recommendation}</td>
                  <td>
                    <span className={c("verdict", `v-${f.verdict}`)}>{VERDICTS[f.verdict].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={c("matrix")} hidden={view !== "matrix"}>
          {VERDICT_KEYS.map((verdict) => {
            const inColumn = findings.map((f, i) => [f, i] as const).filter(([f]) => f.verdict === verdict);
            const count = inColumn.filter(([f]) => visible(f)).length;
            return (
              <section key={verdict} className={c("col", `v-${verdict}`)} aria-labelledby={`exp-col-${verdict}`}>
                <h4 id={`exp-col-${verdict}`}>
                  {VERDICTS[verdict].label} <span>({count})</span>
                </h4>
                <p>{VERDICTS[verdict].note}</p>
                <ul>
                  {inColumn.map(([f, i]) => (
                    <li
                      key={i}
                      className={c("fc")}
                      hidden={!visible(f)}
                      ref={(node) => {
                        if (node) cards.current.set(i, node);
                        else cards.current.delete(i);
                      }}
                    >
                      <b>{f.area}</b>
                      <span className={c("sev", f.severity.toLowerCase())}>{f.severity}</span>
                      <p>{f.recommendation}</p>
                    </li>
                  ))}
                </ul>
                {count === 0 ? <p className={c("empty")}>Nothing at this severity.</p> : null}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

