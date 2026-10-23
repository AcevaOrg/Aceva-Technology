import Link from "next/link";
import { ROUTES, capabilityRoute } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import HeroField from "./HeroField";
import Scrub from "./Scrub";
import { CAPABILITIES, HERO } from "./content";
import ui from "./home.module.css";
import styles from "./hero.module.css";

export default function HomeHero() {
  return (
    <section data-home-hero className={`${ui.ink} ${styles.hero}`} aria-labelledby="home-hero-title">
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.beam}>
          <span className={styles.beamGlow} />
          <span className={styles.beamLines} />
          <span className={styles.beamCore} />
        </div>
        <HeroField className={styles.field} />
        <div className={styles.scrim} />
      </div>

      <Scrub start={0} end={0} className={styles.inner}>
        <p className={styles.kicker}>
          <span className={styles.kickerRule} aria-hidden="true" />
          {HERO.kicker}
          <span className={styles.kickerDot} aria-hidden="true" />
        </p>

        <h1 id="home-hero-title" className={styles.title}>
          {HERO.lines.map((line, i) => (
            <span key={line.verb} className={styles.line}>
              <span className={styles.lineInner} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={styles.verb}>{line.verb}</span> {line.rest}
              </span>
            </span>
          ))}
        </h1>

        <div className={styles.foot}>
          <p className={styles.lede}>{HERO.lede}</p>
          <div className={`${ui.actions} ${styles.actions}`}>
            <Link href={ROUTES.contact} className={`${ui.btn} ${ui.btnPrimary}`}>
              Start a project
              <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
            </Link>
            <Link href={ROUTES.work} className={`${ui.btn} ${ui.btnGhost}`}>
              See the proof
              <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </Scrub>

      <nav className={styles.index} aria-label="Capabilities">
        <ul className={styles.indexList}>
          {CAPABILITIES.map((cap) => (
            <li key={cap.key}>
              <Link href={capabilityRoute(cap.key)} className={styles.indexLink}>
                <span className={styles.indexNum}>{cap.num}</span>
                <span className={styles.indexName}>{cap.name}</span>
                <ArrowRightIcon className={styles.indexArrow} width={14} height={14} strokeWidth={2.2} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
