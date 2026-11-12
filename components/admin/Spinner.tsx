import s from "./admin.module.css";

interface SpinnerProps {
  /** Pixel size (square). */
  size?: number;
  /** Accessible name. Omit when the surrounding text already says what is loading (the usual case). */
  label?: string;
}

/** Indeterminate ring. Stops turning under prefers-reduced-motion, leaving a static arc. */
export function Spinner({ size = 18, label }: SpinnerProps) {
  return (
    <svg
      className={s.spinner}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.4" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
