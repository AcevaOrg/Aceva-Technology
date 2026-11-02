"use client";

import { useRef, useState } from "react";
import { KPIS, ON_TIME_SERIES, ROLES, TASKS, type RoleKey, type TaskState } from "@/lib/data/experiments";
import { c } from "./cx";

const CHIP: Record<TaskState | "done", string> = {
  yours: "YOURS",
  ready: "READY",
  blocked: "BLOCKED",
  locked: "LOCKED",
  view: "VIEW ONLY",
  done: "DONE",
};

const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

function Lock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * Role switcher for the fictional Freightline dashboard. Locked actions stay visible, are
 * marked aria-disabled and say why, so the permission model is something you see, not read.
 */
export default function RoleDashboard() {
  const [role, setRole] = useState<RoleKey>("dispatch");
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [flash, setFlash] = useState<ReadonlySet<string>>(new Set());
  const [note, setNote] = useState("");
  const rows = useRef(new Map<string, HTMLLIElement>());

  const stateOf = (taskId: string, r: RoleKey): { state: TaskState | "done"; why?: string } => {
    if (done.has(`${r}:${taskId}`)) return { state: "done", why: "Done" };
    return TASKS.find((t) => t.id === taskId)!.states[r];
  };

  const tally = (r: RoleKey) => {
    let available = 0;
    let unavailable = 0;
    for (const task of TASKS) {
      const { state } = stateOf(task.id, r);
      if (state === "yours" || state === "ready") available++;
      else if (state !== "done") unavailable++;
    }
    return `${ROLES[r].label}: ${available} action${available === 1 ? "" : "s"} available, ${unavailable} unavailable.`;
  };

  const changeRole = (next: RoleKey) => {
    const changed = new Set<string>();
    for (const task of TASKS) if (stateOf(task.id, role).state !== stateOf(task.id, next).state) changed.add(task.id);
    setFlash(changed);
    setRole(next);
    setNote("");
  };

  const act = (taskId: string, locked: boolean, why?: string) => {
    if (locked) {
      setNote(`Locked for ${ROLES[role].label}. ${why ?? ""}`.trim());
      return;
    }
    setDone(new Set(done).add(`${role}:${taskId}`));
    setFlash(new Set([taskId]));
    setNote("");
    // The button is about to be replaced; hand focus to the row so it never drops to <body>.
    rows.current.get(taskId)?.focus();
  };

  const r = ROLES[role];

  return (
    <>
      <div className={c("stage-head")}>
        <div className={c("seg-row")}>
          <span className={c("try")}>Try it</span>
          <fieldset className={c("seg")}>
            <legend>View as</legend>
            {ROLE_KEYS.map((key) => (
              <label key={key}>
                <input type="radio" name="exp-role" value={key} checked={role === key} onChange={() => changeRole(key)} />
                {ROLES[key].label}
              </label>
            ))}
          </fieldset>
        </div>
        <p className={c("status")} role="status">
          {note || tally(role)}
        </p>
      </div>

      <figure className={c("app")} aria-labelledby="exp-app-cap">
        <div className={c("app-top")}>
          <span className={c("app-brand")}>Freightline Ops</span>
          <span className={c("stamp")}>FICTIONAL DEMO DATA</span>
          <span className={c("who")}>
            <span>{r.who}</span>
            <span className={c("av")} aria-hidden="true" data-role={role}>
              {r.initials}
            </span>
          </span>
        </div>
        <div className={c("app-body")}>
          <div className={c("app-side")} aria-hidden="true">
            <span className={c("on")}>Overview</span>
            <span>Shipments</span>
            <span>Tasks</span>
            <span>People &amp; roles</span>
            <span>Reporting</span>
            <span className={c("role")}>
              {r.side[0]}
              <br />
              {r.side[1]}
            </span>
          </div>
          <div className={c("app-main")}>
            <dl className={c("kpis")}>
              {KPIS.map((kpi) => (
                <div className={c("kpi")} key={kpi.label}>
                  <dt>{kpi.label}</dt>
                  <dd>
                    {kpi.value}
                    {"unit" in kpi ? <small>{kpi.unit}</small> : null}
                  </dd>
                </div>
              ))}
            </dl>

            <div className={c("card")}>
              <div className={c("card-h")}>
                Tasks awaiting action <span>4 OF 18</span>
              </div>
              <ul>
                {TASKS.map((task) => {
                  const { state, why } = stateOf(task.id, role);
                  const locked = state === "locked";
                  const actionable = state === "yours" || state === "ready";
                  return (
                    <li
                      key={task.id}
                      tabIndex={-1}
                      ref={(node) => {
                        if (node) rows.current.set(task.id, node);
                      }}
                      className={c("task", flash.has(task.id) && "flash")}
                    >
                      <span className={c("task-t")}>
                        {task.title}
                        <small>{task.owner}</small>
                      </span>
                      <span className={c("chip", state)}>{CHIP[state]}</span>
                      <span className={c("act-wrap")}>
                        {actionable || locked ? (
                          <button
                            type="button"
                            className={c("act")}
                            aria-disabled={locked || undefined}
                            aria-describedby={locked ? `exp-why-${task.id}` : undefined}
                            onClick={() => act(task.id, locked, why)}
                          >
                            {locked ? <Lock /> : null}
                            {task.verb}
                          </button>
                        ) : null}
                        {why && !actionable ? (
                          <span className={c("why")} id={`exp-why-${task.id}`}>
                            {why}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={c("card")}>
              <div className={c("card-h")}>
                On-time delivery, last 8 weeks <span>FICTIONAL SERIES</span>
              </div>
              <div className={c("chart")} data-reveal="bars">
                <div className={c("plot")} aria-hidden="true">
                  <span className={c("gl")} style={{ top: 0 }}>
                    <span>100</span>
                  </span>
                  <span className={c("gl")} style={{ top: "50%" }}>
                    <span>50</span>
                  </span>
                  <span className={c("gl")} style={{ bottom: 0 }}>
                    <span>0</span>
                  </span>
                  <span />
                  {ON_TIME_SERIES.map((value, n) => (
                    <span
                      key={n}
                      className={c("cbar", n === ON_TIME_SERIES.length - 1 && "last")}
                      style={{ "--h": `${value}%`, "--n": n } as React.CSSProperties}
                    >
                      <b>{value}%</b>
                    </span>
                  ))}
                </div>
                <div className={c("weeks")} aria-hidden="true">
                  <span />
                  {ON_TIME_SERIES.map((_, n) => (
                    <span key={n}>W{n + 1}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <figcaption className={c("sr")} id="exp-app-cap">
          Freightline Ops, fictional demo data. Chart: on-time delivery over 8 fictional weeks, {ON_TIME_SERIES.join(", ")} percent.
        </figcaption>
      </figure>
    </>
  );
}
