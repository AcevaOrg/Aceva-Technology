import { EXPERIMENTS } from "@/lib/data/experiments";
import { c } from "./cx";
import { Placard, UpNext } from "./Placard";
import PhoneStepper from "./PhoneStepper";

const exp = EXPERIMENTS[2];

export default function MobileExhibit() {
  return (
    <section id={exp.slug} data-chapter className={c("exhibit", "ink", "onInk")} aria-labelledby={`${exp.slug}-title`}>
      <div className={c("wrap")}>
        <div className={c("ex-grid")}>
          <Placard
            exp={exp}
            title="One complete journey: sign in, find the job, finish it."
            proves={{
              label: "What this proves",
              text: "We design for the outcome. Each screen moves one person one step closer to a finished job.",
            }}
          />
          <div className={c("placard")} style={{ alignSelf: "end" }}>
            <p className={c("brief")}>
              A field-work app for the same fictional logistics brief. Four screens, one outcome — not ten disconnected screens.
            </p>
          </div>
        </div>
        <PhoneStepper />
        <UpNext next={EXPERIMENTS[3]} />
      </div>
    </section>
  );
}
