import Link from "next/link";
import Scrub from "@/components/home/Scrub";
import { contactRoute } from "@/lib/nav";
import { EXPERIMENTS, FINDINGS, ROADMAP, severityCounts } from "@/lib/data/experiments";
import { c } from "./cx";
import { Arrow, Placard, UpNext } from "./Placard";
import TriageBoard from "./TriageBoard";

const exp = EXPERIMENTS[4];

export default function RescueExhibit() {
  const counts = severityCounts();
  return (
    <section
      id={exp.slug}
      data-chapter
      className={c("exhibit", "paper2", "onPaper")}
      aria-labelledby={`${exp.slug}-title`}
    >
      <div className={c("wrap")}>
        <div className={c("ex-grid")} style={{ marginBottom: "clamp(32px,4vw,56px)" }}>
          <Placard
            exp={exp}
            title="What a Rescue Report looks like before you pay for a rebuild."
            proves={{
              label: "What this proves",
              text: "A rescue starts with evidence. You see what to keep, what to replace and in what order before anyone quotes a rebuild.",
            }}
          />
          <div className={c("placard")} style={{ alignSelf: "end" }}>
            <p className={c("brief")}>
              A sample report on an invented product. Findings, severity, what to keep, what to replace, and a 30/60/90-day plan.
            </p>
          </div>
        </div>

        <article className={c("doc")} aria-label="Sample Rescue Report" data-reveal="up">
          <div className={c("doc-top")}>
            <span>RESCUE REPORT · SAMPLE</span>
            <span>KESTREL BOOKING · FICTIONAL</span>
          </div>
          <dl className={c("meta")}>
            <div>
              <dt>PRODUCT UNDER REVIEW</dt>
              <dd>
                <strong>Kestrel Booking (fictional)</strong>
                Handover from a previous team · 14 weeks of work
              </dd>
            </div>
            <div>
              <dt>VERDICT</dt>
              <dd>
                <strong>Recoverable</strong>
                Keep the data model. Replace the auth and deployment layers.
              </dd>
            </div>
            <div>
              <dt>FINDINGS</dt>
              <dd className={c("sev-sum")}>
                <span className={c("sev", "critical")}>{counts.CRITICAL} CRITICAL</span>
                <span className={c("sev", "high")}>{counts.HIGH} HIGH</span>
                <span className={c("sev", "medium")}>{counts.MEDIUM} MEDIUM</span>
              </dd>
            </div>
          </dl>

          <TriageBoard findings={FINDINGS} />

          <Scrub start={0.9} end={0.45} className={c("road")}>
            <p className={c("road-h")}>30 / 60 / 90-DAY PLAN</p>
            <div className={c("road-track")}>
              <span className={c("road-line")} aria-hidden="true">
                <i />
              </span>
              {ROADMAP.map((phase) => (
                <div className={c("ms")} key={phase.when}>
                  <b>{phase.when.toUpperCase()}</b>
                  <p>{phase.body}</p>
                </div>
              ))}
            </div>
          </Scrub>

          <div className={c("doc-cta")}>
            <Link href={contactRoute("help")} className={c("btn", "btn-primary")}>
              Request a Rescue Sprint
              <Arrow />
            </Link>
            <p>We do not quote a rescue before senior review, and we do not promise every product can be repaired.</p>
          </div>
        </article>
      </div>
      <div className={c("wrap")}>
        <UpNext next={EXPERIMENTS[5]} />
      </div>
    </section>
  );
}
