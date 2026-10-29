"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { JOURNEY_STEPS } from "@/lib/data/experiments";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { c } from "./cx";

const WIDE = "(min-width: 1000px) and (min-height: 640px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * One phone, four steps. On a large screen the phone sticks while the captions scroll past and
 * the one nearest the middle picks the screen. On phones and short windows the screens become a
 * swipeable strip with previous/next buttons. The phone is decorative: each caption carries the
 * screen's content as text, and nothing is announced while scrolling.
 */
export default function PhoneStepper() {
  const reduced = usePrefersReducedMotion();
  const wide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => true
  );
  const [step, setStep] = useState(0);
  const [secs, setSecs] = useState(24);
  const track = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const swipeTimer = useRef(0);

  const go = (next: number, source: "scroll" | "swipe" | "click" = "click") => {
    const i = Math.max(0, Math.min(JOURNEY_STEPS.length - 1, next));
    setStep(i);
    if (i === 1) setSecs(24);
    const box = track.current;
    if (!wide && box && source !== "swipe") {
      box.scrollTo({ left: i * box.clientWidth, behavior: reduced ? "auto" : "smooth" });
    }
  };

  // Desktop: the caption nearest the middle of the viewport picks the screen.
  useEffect(() => {
    if (!wide) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = items.current.indexOf(entry.target as HTMLLIElement);
          if (i >= 0) setStep(i);
        }
      },
      { rootMargin: "-46% 0px -46% 0px" }
    );
    for (const el of items.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [wide]);

  // The resend timer is real, but only runs on its own screen and never under reduced motion.
  useEffect(() => {
    if (step !== 1 || reduced) return;
    const timer = window.setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, reduced]);

  const onSwipe = () => {
    window.clearTimeout(swipeTimer.current);
    swipeTimer.current = window.setTimeout(() => {
      const box = track.current;
      if (!box || wide) return;
      const i = Math.round(box.scrollLeft / box.clientWidth);
      if (i !== step) go(i, "swipe");
    }, 60);
  };

  const timerText = secs > 0 ? `Resend in 0:${String(secs).padStart(2, "0")}` : "Resend code";
  const last = JOURNEY_STEPS.length - 1;

  return (
    <div className={c("journey")} style={{ "--step": step } as CSSProperties}>
      <ol className={c("jsteps")}>
        {JOURNEY_STEPS.map((s, i) => (
          <li
            key={i}
            className={c("jstep")}
            data-active={step === i ? "" : undefined}
            ref={(node) => {
              items.current[i] = node;
            }}
          >
            <button
              type="button"
              className={c("jbtn")}
              onClick={() => {
                if (wide) items.current[i]?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
                else go(i);
              }}
            >
              <span className={c("jk")}>
                Step {i + 1} of {JOURNEY_STEPS.length}
              </span>
              <span className={c("jc")}>{s.caption}</span>
              <span className={c("sr")}>Screen: {s.screen}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className={c("jphone-col")}>
        <div className={c("jphone-wrap")}>
          <div className={c("phone")} aria-hidden="true">
            <div className={c("scr-vp")}>
              <div className={c("track")} ref={track} onScroll={onSwipe}>
                <div className={c("scr")}>
                  <span className={c("st")}>
                    <span>9:41</span>
                    <span>▮▮▮</span>
                  </span>
                  <h4>Sign in to Freightline</h4>
                  <p className={c("mut")}>Use your work email. We send a code — no password to forget.</p>
                  <span className={c("fl")}>WORK EMAIL</span>
                  <span className={c("inp")}>amara@freightline.demo</span>
                  <span className={c("pbtn")}>Send code</span>
                </div>
                <div className={c("scr")}>
                  <span className={c("st")}>
                    <span>9:41</span>
                    <span>▮▮▮</span>
                  </span>
                  <h4>Enter the 6-digit code</h4>
                  <p className={c("mut")}>Sent to amara@freightline.demo</p>
                  <span className={c("digits")}>
                    <span>4</span>
                    <span>1</span>
                    <span>8</span>
                    <span className={c("cur")} />
                    <span />
                    <span />
                  </span>
                  <span className={c("timer")}>{timerText}</span>
                  <span className={c("pbtn")} style={{ opacity: 0.45 }}>
                    Verify
                  </span>
                </div>
                <div className={c("scr")}>
                  <span className={c("st")}>
                    <span>9:41</span>
                    <span>▮▮▮</span>
                  </span>
                  <p className={c("mut")}>Tuesday · 3 stops left</p>
                  <h4>Your route</h4>
                  <span className={c("stop", "next")}>
                    <i />
                    <span>
                      <b>JOB-4418 · Dock 3</b>
                      <span className={c("mut")}>Pier 12 · 10:15 window</span>
                    </span>
                  </span>
                  <span className={c("stop")}>
                    <i />
                    <span>
                      <b>JOB-4421 · Warehouse B</b>
                      <span className={c("mut")}>Bay 4 · 12:00 window</span>
                    </span>
                  </span>
                  <span className={c("stop")}>
                    <i />
                    <span>
                      <b>JOB-4425 · Cross-dock</b>
                      <span className={c("mut")}>Gate 2 · 14:30 window</span>
                    </span>
                  </span>
                  <span className={c("pbtn")}>Start JOB-4418</span>
                </div>
                <div className={c("scr")}>
                  <span className={c("st")}>
                    <span>10:22</span>
                    <span>▮▮▮</span>
                  </span>
                  <span className={c("ok")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <h4>JOB-4418 closed out</h4>
                  <p className={c("mut")}>Proof of delivery uploaded. Dispatch has been notified and the customer sees the update.</p>
                  <p className={c("mut")} style={{ fontFamily: "var(--x-mono)", fontSize: 11 }}>
                    Signed by M. Duarte · 10:22
                  </p>
                  <span className={c("pbtn")}>Next stop</span>
                </div>
              </div>
            </div>
          </div>

          <div className={c("jnav")}>
            <button type="button" aria-label="Previous step" disabled={step === 0} onClick={() => go(step - 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <span className={c("jdots")} aria-hidden="true">
              {JOURNEY_STEPS.map((_, i) => (
                <i key={i} className={step === i ? c("on") : undefined} />
              ))}
            </span>
            <span className={c("jcount")} aria-live="polite">
              Step {step + 1} of {JOURNEY_STEPS.length}
            </span>
            <button type="button" aria-label="Next step" disabled={step === last} onClick={() => go(step + 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
