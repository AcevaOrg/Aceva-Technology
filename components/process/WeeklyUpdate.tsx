import { phaseByKey, SAMPLE_UPDATE } from "@/lib/data/process";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";

const build = phaseByKey("build");

/** Build's promise made visible: a sample of the written weekly update, labelled as a sample. */
export default function WeeklyUpdate() {
  return (
    <section id="weekly-update" className={`${ui.ink} ${ui.section} ${styles.weekly}`} aria-labelledby="weekly-update-title">
      <div className={`${ui.wrap} ${styles.weekGrid}`}>
        <div className={styles.weekCopy}>
          <p className={ui.eyebrow} data-reveal="up">
            <span className={ui.slash} aria-hidden="true" />
            <b>02</b> The week, in writing
          </p>
          <h2 id="weekly-update-title" className={`${ui.h2} ${styles.h2}`} data-reveal="up">
            Proof arrives every week.
          </h2>
          <p className={ui.lede} data-reveal="up">
            While we build, you never wait for a deadline to see where things stand. This is the shape of what you get.
          </p>
          <ul className={styles.weekPoints} data-reveal="up">
            {build.receive.slice(0, 2).map((item) => (
              <li key={item}>
                <span className={ui.slash} aria-hidden="true" />
                {item}
              </li>
            ))}
            <li>
              <span className={ui.slash} aria-hidden="true" />
              No junior change reaches production without a named senior review.
            </li>
          </ul>
        </div>

        <div className={styles.docWrap} data-reveal="up">
          <figure className={styles.doc} aria-labelledby="sample-update-title">
            <div className={styles.docHead}>
              <p className={styles.docTitle}>
                <b id="sample-update-title">{SAMPLE_UPDATE.title}</b>
                <span>{SAMPLE_UPDATE.project}</span>
              </p>
              <span className={styles.sampleChip}>
                <i aria-hidden="true" />
                {SAMPLE_UPDATE.label}
              </span>
            </div>
            <p className={styles.docDemo}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
              {SAMPLE_UPDATE.demo}
            </p>
            <dl className={styles.docBody}>
              {SAMPLE_UPDATE.sections.map((section) => (
                <div key={section.heading}>
                  <dt>{section.heading}</dt>
                  {section.items.map((item) => (
                    <dd key={item}>{item}</dd>
                  ))}
                </div>
              ))}
            </dl>
            <figcaption className={styles.docSign}>
              {SAMPLE_UPDATE.signoff}
              <span className={styles.stamp} aria-hidden="true">
                <i />
                Senior reviewed
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
