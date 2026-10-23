import Link from "next/link";
import { ROUTES } from "@/lib/nav";
import { ArrowRightIcon } from "@/components/ui/icons";
import CapabilityStory from "./CapabilityStory";
import { DigitalVisual, IntelligenceVisual, MobileVisual, RescueVisual, SoftwareVisual } from "./capVisuals";
import { CAPABILITIES } from "./content";
import ui from "./home.module.css";
import styles from "./capabilities.module.css";

export default function CapabilitiesSection() {
  return (
    <section id="capabilities" className={`${ui.paper2} ${ui.section} ${styles.section}`} aria-labelledby="caps-title">
      <div className={ui.wrap}>
        <header className={ui.head}>
          <div data-reveal="up">
            <p className={ui.eyebrow}>
              <span className={ui.slash} aria-hidden="true" />
              <b>02</b> Capabilities
            </p>
            <h2 id="caps-title" className={ui.h2}>
              Five capabilities. One accountable engineering partner.
            </h2>
          </div>
          <div className={ui.headAside} data-reveal="up" style={{ "--d": "90ms" } as React.CSSProperties}>
            <p className={ui.lede}>
              From the first customer touchpoint to the systems behind it, we design, build and improve the technology your
              business depends on.
            </p>
            <Link href={ROUTES.services} className={ui.textLink}>
              All capabilities in detail
              <ArrowRightIcon width={15} height={15} strokeWidth={2.2} />
            </Link>
          </div>
        </header>

        <CapabilityStory
          items={CAPABILITIES}
          visuals={[
            <DigitalVisual key="digital" />,
            <SoftwareVisual key="software" />,
            <MobileVisual key="mobile" />,
            <IntelligenceVisual key="intelligence" />,
            <RescueVisual key="rescue" />,
          ]}
        />
      </div>
    </section>
  );
}
