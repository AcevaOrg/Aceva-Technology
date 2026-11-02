import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { experimentHref, type ExperimentKey } from "@/lib/data/experiments";
import { ArrowRightIcon } from "@/components/ui/icons";
import PulseTile from "./PulseTile";
import { PROOF_ITEMS, type ProofKind } from "./content";
import ui from "./home.module.css";
import styles from "./proof.module.css";

const KIND_TO_EXPERIMENT: Record<ProofKind, ExperimentKey> = {
  site: "site",
  dashboard: "dashboard",
  mobile: "mobile",
  automation: "automation",
  report: "rescue",
};

const BARS = [38, 54, 46, 70, 62, 84, 58, 76];

const PREVIEWS: Record<ProofKind, ReactNode> = {
  site: (
    <div className={styles.pvSite}>
      <span className={styles.pvBeam} />
      <span className={styles.pvLine} style={{ width: "58%" }} />
      <span className={styles.pvLine} style={{ width: "64%" }} />
      <span className={styles.pvLine} style={{ width: "61%" }} />
      <span className={styles.pvCta} />
    </div>
  ),
  dashboard: (
    <div className={styles.pvDash}>
      <span className={styles.pvSide} />
      <span className={styles.pvKpis}>
        <span />
        <span />
        <span />
      </span>
      <span className={styles.pvBars}>
        {BARS.map((h, n) => (
          <span key={n} style={{ "--h": `${h}%`, "--i": n } as CSSProperties} />
        ))}
      </span>
    </div>
  ),
  mobile: (
    <div className={styles.pvPhone}>
      <span className={styles.pvNotch} />
      <span className={styles.pvRow} />
      <span className={`${styles.pvRow} ${styles.pvRowOn}`} />
      <span className={styles.pvRow} />
      <span className={styles.pvSteps}>
        {[0, 1, 2, 3].map((n) => (
          <span key={n} style={{ "--i": n } as CSSProperties} />
        ))}
      </span>
    </div>
  ),
  automation: (
    <div className={styles.pvFlow}>
      {["REQ", "LOOK", "PROP", "OK", "UPD"].map((label, n) => (
        <span key={label} className={n === 3 ? `${styles.pvNode} ${styles.pvGate}` : styles.pvNode}>
          {label}
        </span>
      ))}
      <span className={styles.pvPacket} />
    </div>
  ),
  report: (
    <div className={styles.pvMatrix}>
      <span className={styles.pvKeep}>Keep</span>
      <span className={styles.pvRemediate}>Remediate</span>
      <span className={styles.pvReplace}>Replace</span>
      <span className={styles.pvDefer}>Defer</span>
    </div>
  ),
};

export default function ProofSection() {
  return (
    <section id="proof" className={`${ui.paper2} ${ui.section} ${styles.proof}`} aria-labelledby="proof-title">
      <div className={ui.wrap}>
        <header className={ui.head}>
          <div data-reveal="up">
            <p className={ui.eyebrow}>
              <span className={ui.slash} aria-hidden="true" />
              <b>05</b> Proof, not portfolio
            </p>
            <h2 id="proof-title" className={ui.h2}>
              Honest demonstrations, clearly labeled. Never presented as client work.
            </h2>
          </div>
          <div className={ui.headAside} data-reveal="up" style={{ "--d": "90ms" } as CSSProperties}>
            <p className={ui.lede}>
              Aceva is new. Rather than invent a portfolio, we show how we think and build — our own work on fictional briefs,
              and products running on this site.
            </p>
            <Link href={ROUTES.work} className={ui.textLink}>
              Open Experiments
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <div className={styles.grid}>
          {PROOF_ITEMS.map((item, n) => (
            <Link
              key={item.kind}
              href={experimentHref(KIND_TO_EXPERIMENT[item.kind])}
              className={`${styles.tile} ${styles[item.kind]}`}
              data-reveal="up"
              style={{ "--d": `${(n % 3) * 80}ms` } as CSSProperties}
            >
              <span className={styles.preview} aria-hidden="true">
                {PREVIEWS[item.kind]}
              </span>
              <span className={styles.meta}>
                <span className={`${ui.label} ${styles.label}`}>{item.label}</span>
                <span className={styles.tileTitle}>{item.title}</span>
                <span className={styles.tileBody}>{item.body}</span>
              </span>
              <span className={styles.tileArrow} aria-hidden="true">
                <ArrowRightIcon width={16} height={16} strokeWidth={2.2} />
              </span>
            </Link>
          ))}

          <div className={`${styles.tile} ${styles.pulse}`} data-reveal="up">
            <div className={styles.pulseCopy}>
              <span className={`${ui.label} ${styles.label}`}>
                <span className={styles.liveDot} aria-hidden="true" />
                Live on this site · Intelligence &amp; Automation
              </span>
              <h3 className={styles.pulseTitle}>Aceva Pulse — our own AI assistant, running right here.</h3>
              <p className={styles.tileBody}>
                Tell it what you would like to build or improve, and it will help map out your project.
              </p>
            </div>
            <div className={styles.pulseAside}>
              <p className={styles.bubble} aria-hidden="true">
                Hello! I&apos;m Aceva Pulse. Tell me what you&apos;d like to build or improve…
              </p>
              <PulseTile />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
