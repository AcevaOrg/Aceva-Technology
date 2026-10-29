import { EXPERIMENTS } from "@/lib/data/experiments";
import { c } from "./cx";
import { Placard, UpNext } from "./Placard";
import AutomationRun from "./AutomationRun";

const exp = EXPERIMENTS[3];

export default function AutomationExhibit() {
  return (
    <section
      id={exp.slug}
      data-chapter
      className={c("exhibit", "paper", "onPaper")}
      aria-labelledby={`${exp.slug}-title`}
    >
      <div className={c("wrap", "ex-grid")}>
        <Placard
          exp={exp}
          stick
          title="One controlled automation, with a human in the loop."
          brief="Request, data lookup, proposed action, human approval, system update. Step through it — the automation cannot complete without your decision."
          proves={{
            label: "What this demonstrates",
            text: "Automation that stops at the decision, an audit trail by default, and a refusal to call a chatbot an agent. AI proposes; a named person approves.",
          }}
        />
        <div className={c("stage")} data-reveal="up">
          <div className={c("stage-head")}>
            <span className={c("try")}>Try it · you hold the Finance role</span>
          </div>
          <AutomationRun />
        </div>
      </div>
      <div className={c("wrap")}>
        <UpNext next={EXPERIMENTS[4]} />
      </div>
    </section>
  );
}
