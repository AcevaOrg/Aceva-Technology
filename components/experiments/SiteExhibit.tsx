import { EXPERIMENTS, PROVENANCE } from "@/lib/data/experiments";
import { c } from "./cx";
import { Placard, UpNext } from "./Placard";
import SiteStage from "./SiteStage";

const exp = EXPERIMENTS[0];

const FACTS = [
  ["Adaptive homepage", "Three visitor paths, one page"],
  ["Mobile behavior", "Native menu, sticky action bar"],
  ["Accessibility target", "WCAG AA, keyboard complete"],
  ["Lead flow", "Qualification form → meeting"],
] as const;

export default function SiteExhibit() {
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
          title="The proof is the thing you are using."
          brief="Aceva’s own site is the first capability demonstration: a product-grade buying experience rather than a brochure. It adapts to your situation, it works on a phone, and it loads fast on a normal connection."
          proves={{
            label: "What this proves",
            text: "We hold our own site to the standard we sell. Open X-ray to check the contrast and type yourself, measured on your screen.",
          }}
        >
          <dl className={c("facts")}>
            {FACTS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className={c("stack")} aria-label="Built with">
            <span>Next.js</span>
            <span>React</span>
            <span>TypeScript</span>
            <span>CSS Modules</span>
            <span>No animation libraries</span>
          </div>
        </Placard>
        <div className={c("stage")} data-reveal="up">
          <div className={c("stage-head")}>
            <span className={c("try")}>Try it</span>
            <span className={c("cap")}>Mini homepage · {PROVENANCE.live.label.toLowerCase()}</span>
          </div>
          <SiteStage />
        </div>
      </div>
      <div className={c("wrap")}>
        <UpNext next={EXPERIMENTS[1]} />
      </div>
    </section>
  );
}
