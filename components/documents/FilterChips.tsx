import { useId } from "react";
import styles from "./documents.module.css";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Shown beside the label; omit it (or pass null) where a number would mean nothing. */
  count?: number | null;
}

interface FilterChipsProps<T extends string> {
  /** Visible lead-in and the group's accessible name, e.g. "Show". */
  label: string;
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Collapses the whole row without unmounting it. */
  hidden?: boolean;
}

/**
 * One row of filter chips: a labelled group of toggle buttons where exactly one is pressed.
 * Pressed state is exposed with `aria-pressed` (not colour alone: the pressed chip also fills), every
 * chip is a 44px target with the page's focus ring, and the row is just buttons, so it needs no
 * arrow-key choreography. Used only inside client components, which own the state and the status line.
 */
export default function FilterChips<T extends string>({ label, options, value, onChange, hidden }: FilterChipsProps<T>) {
  const labelId = useId();
  return (
    <div className={styles.filterRow} role="group" aria-labelledby={labelId} hidden={hidden}>
      <span id={labelId} className={styles.filterLabel}>
        {label}
      </span>
      <div className={styles.filterChips}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.filterChip}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {typeof option.count === "number" ? <span className={styles.filterCount}>{option.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
