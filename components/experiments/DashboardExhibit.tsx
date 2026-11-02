import { EXPERIMENTS } from "@/lib/data/experiments";
import { c } from "./cx";
import { Placard, UpNext } from "./Placard";
import RoleDashboard from "./RoleDashboard";

const exp = EXPERIMENTS[1];

export default function DashboardExhibit() {
  return (
    <section
      id={exp.slug}
      data-chapter
      className={c("exhibit", "paper2", "onPaper")}
      aria-labelledby={`${exp.slug}-title`}
    >
      <div className={c("wrap", "ex-grid", "flip")}>
        <Placard
          exp={exp}
          stick
          title="An operations dashboard for a mid-sized logistics team."
          brief="Users, permissions, tasks, data and reporting in one workflow. Built by Aceva on an invented brief — the company, people and numbers below are fictional."
          proves={{
            label: "What this demonstrates",
            text: "Role-based permissions that visibly lock actions, a task queue built around ownership rather than status alone, and reporting a manager can read in one glance.",
          }}
        />
        <div className={c("stage")} data-reveal="up">
          <RoleDashboard />
        </div>
      </div>
      <div className={c("wrap")}>
        <UpNext next={EXPERIMENTS[2]} />
      </div>
    </section>
  );
}
