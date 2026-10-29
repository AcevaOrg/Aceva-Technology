import type { CSSProperties } from "react";
import Link from "next/link";
import { ROUTES, contactRoute } from "@/lib/nav";
import { EXPERIMENTS, PULSE_GREETING, PULSE_INTENTS } from "@/lib/data/experiments";
import { c } from "./cx";
import { Arrow, ProvChip } from "./Placard";
import AskPulse from "./AskPulse";

const exp = EXPERIMENTS[5];

const PATHS = [
  { tag: "NEW", label: "I am starting something new", href: contactRoute("new") },
  { tag: "IMPROVE", label: "I need to improve my business", href: contactRoute("improve") },
  { tag: "HELP", label: "I already built something, but it needs help", href: contactRoute("help") },
] as const;

/** Chapter 06 and the close are one ink section, which runs straight into the dark footer. */
export default function PulseClose() {
  return (
    <section id={exp.slug} data-chapter className={c("ink", "onInk")} aria-labelledby={`${exp.slug}-title`}>
      <div className={c("pulse-band")}>
        <div className={c("wrap", "pulse-grid")}>
          <div className={c("placard")}>
            <span className={c("num")} aria-hidden="true">
              {exp.num}
            </span>
            <ProvChip exp={exp} />
            <h2 className={c("h2")} id={`${exp.slug}-title`}>
              Aceva Pulse runs on every page of this site.
            </h2>
            <p className={c("brief")}>
              Our own AI assistant. It asks what you want to build or improve and helps map out the project before you talk to us.
            </p>
            <div>
              <AskPulse />
            </div>
          </div>

          <div className={c("chatw")} aria-hidden="true" data-reveal="up">
            <div className={c("chatw-h")}>
              <span className={c("av")}>AP</span>
              <span>
                <b>Aceva Pulse</b>
                <small>
                  <i />
                  Online
                </small>
              </span>
            </div>
            <div className={c("chatw-b")}>
              <p className={c("bub")}>{PULSE_GREETING}</p>
              <div className={c("intents")}>
                {PULSE_INTENTS.map((intent, n) => (
                  <span key={intent} style={{ "--n": n } as CSSProperties}>
                    {intent}
                  </span>
                ))}
              </div>
            </div>
            <div className={c("chatw-f")}>
              Type your message…
              <i>
                <Arrow size={14} />
              </i>
            </div>
          </div>
        </div>

        <div className={c("wrap", "close")}>
          <div className={c("close-h")}>
            <p className={c("eyebrow")}>
              <span className={c("slash")} aria-hidden="true" />
              <b>Next</b> / Your turn
            </p>
            <h2 className={c("h2")}>What should we prove for you?</h2>
          </div>
          <div className={c("paths")} data-reveal="up">
            {PATHS.map((path) => (
              <Link key={path.tag} className={c("path")} href={path.href}>
                <span className={c("n")}>{path.tag}</span>
                {path.label}
                <Arrow size={22} />
              </Link>
            ))}
          </div>
          <div className={c("close-f")}>
            <Link className={c("btn", "btn-primary")} href={ROUTES.contact}>
              Start a project
            </Link>
            <Link className={c("tlink")} href={ROUTES.home}>
              Back to the homepage
              <Arrow size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
