import Scrub from "@/components/home/Scrub";
import LoopRing from "./LoopRing";
import styles from "./hero-visual.module.css";

/**
 * "The Loop" hero: the five phases as one ring that draws itself in, with a light that keeps
 * travelling round it. As the hero scrolls away the ring turns and settles (Scrub --p).
 */
export default function HeroVisual() {
  return (
    <Scrub start={0} end={0} className={styles.visual}>
      <div className={styles.turn}>
        <LoopRing variant="hero" />
      </div>
    </Scrub>
  );
}
