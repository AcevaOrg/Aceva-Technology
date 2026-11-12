import styles from "./seal.module.css";

export type SealKind = "valid" | "expired" | "revoked" | "not_found" | "rate_limited" | "unavailable";

interface SealProps {
  kind: SealKind;
  /** Pixel size. Anything under 64 is "compact": thicker strokes and no animation. */
  size?: number;
  /** "ink" for dark surfaces (default), "paper" for the light ones, where amber needs darkening. */
  tone?: "ink" | "paper";
}

/**
 * The verdict mark. Decorative by design: the words beside it carry the meaning, so colour is
 * never the only signal. Every shape is drawn in its finished state and only *animated from* an
 * undrawn one, which is what lets reduced motion (or no CSS animation support) show a complete seal.
 */
export default function Seal({ kind, size = 176, tone = "ink" }: SealProps) {
  const compact = size < 64;
  return (
    <svg
      className={`${styles.seal} ${styles[kind]}${compact ? ` ${styles.compact}` : ""}`}
      data-tone={tone}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle className={styles.halo} cx="60" cy="60" r="52" />
      <circle className={styles.disc} cx="60" cy="60" r="50" />
      {/* rotated so the ring starts drawing at twelve o'clock */}
      <circle className={styles.ring} cx="60" cy="60" r="52" pathLength={1} transform="rotate(-90 60 60)" />
      <g>{glyph(kind)}</g>
      {kind === "revoked" ? <polygon className={styles.slash} points="67.7,4 94,4 52.3,116 26,116" /> : null}
    </svg>
  );
}

function glyph(kind: SealKind) {
  switch (kind) {
    case "valid":
      return <path className={styles.draw} d="M38 62 L53 77 L83 43" pathLength={1} />;
    case "expired":
      return (
        <>
          <circle className={styles.draw} cx="60" cy="60" r="24" pathLength={1} />
          <path className={styles.draw} d="M60 46 V60 L70 67" pathLength={1} />
        </>
      );
    case "revoked":
      // the mark that was valid once, struck through by the slash
      return <path className={styles.ghost} d="M38 62 L53 77 L83 43" />;
    case "not_found":
      return (
        <text className={styles.question} x="60" y="79" textAnchor="middle">
          ?
        </text>
      );
    case "rate_limited":
      return (
        <>
          <rect className={styles.bar} x="45" y="43" width="10" height="34" rx="2" />
          <rect className={styles.bar} x="65" y="43" width="10" height="34" rx="2" />
        </>
      );
    case "unavailable":
      return (
        <>
          <circle className={styles.dot} cx="42" cy="60" r="5" />
          <circle className={styles.dot} cx="60" cy="60" r="5" />
          <circle className={styles.dot} cx="78" cy="60" r="5" />
        </>
      );
  }
}
