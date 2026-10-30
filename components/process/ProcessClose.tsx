import Link from "next/link";
import { ROUTES, contactRoute } from "@/lib/nav";
import { HOME_PATHS } from "@/components/home/content";
import { ArrowRightIcon } from "@/components/ui/icons";
import ui from "@/components/home/home.module.css";
import styles from "./process.module.css";

/** The first step, as one ink section that runs straight into the dark footer. */
export default function ProcessClose() {
  return (
    <section id="start" className={`${ui.ink} ${styles.close}`} aria-labelledby="start-title">
      <div className={ui.wrap}>
        <div className={styles.closeHead}>
          <p className={ui.eyebrow}>
            <span className={ui.slash} aria-hidden="true" />
            <b>Next</b> / Phase 01
          </p>
          <h2 id="start-title" className={`${ui.h2} ${styles.h2}`}>
            Start with Understand.
          </h2>
          <p className={ui.lede}>
            Tell us what is costing you the most time, money or customer trust. A senior reads it, checks feasibility, and
            proposes either a Proof Sprint, a Rescue Sprint or a full engagement.
          </p>
        </div>
        <div className={styles.paths} data-reveal="up">
          {HOME_PATHS.map((path) => (
            <Link key={path.key} className={styles.path} href={contactRoute(path.key)}>
              <span>{path.key.toUpperCase()}</span>
              {path.sentence}
              <ArrowRightIcon width={22} height={22} strokeWidth={1.8} />
            </Link>
          ))}
        </div>
        <div className={styles.closeFoot}>
          <Link className={`${ui.btn} ${ui.btnPrimary}`} href={ROUTES.contact}>
            Start a project
            <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
          </Link>
          <Link className={ui.textLink} href={ROUTES.work}>
            See the proof
            <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
