import PathRows from "./PathRows";
import { HOME_PATHS } from "./content";
import ui from "./home.module.css";
import styles from "./paths.module.css";

export default function PathsSection() {
  return (
    <section id="paths" className={`${ui.paper} ${ui.section} ${styles.paths}`} aria-labelledby="paths-title">
      <span className={styles.trail} aria-hidden="true" />
      <div className={ui.wrap}>
        <header className={ui.head}>
          <div data-reveal="up">
            <p className={ui.eyebrow}>
              <span className={ui.slash} aria-hidden="true" />
              <b>01</b> Where you are starting from
            </p>
            <h2 id="paths-title" className={ui.h2}>
              Where are you right now?
            </h2>
          </div>
          <div className={ui.headAside} data-reveal="up" style={{ "--d": "90ms" } as React.CSSProperties}>
            <p className={ui.lede}>
              Choose the sentence that fits. Each one leads to a different first engagement — sized to prove value before
              large money is committed.
            </p>
          </div>
        </header>
        <PathRows paths={HOME_PATHS} />
      </div>
    </section>
  );
}
