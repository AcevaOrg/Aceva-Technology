"use client";

import { useId, useRef, type CSSProperties, type KeyboardEvent } from "react";
import s from "./admin.module.css";
import { useFieldContext } from "./FormField";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  /** Shown under the control while this option is selected (what choosing it means). */
  hint?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. Inside a FormField the visible label is used instead. */
  label: string;
  disabled?: boolean;
  id?: string;
}

/**
 * A pill-shaped radio group with a sliding thumb: the right control for status and visibility, where
 * every choice should be visible at once. Arrow keys, Home and End move the selection (roving tabindex).
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, disabled, id }: SegmentedControlProps<T>) {
  const field = useFieldContext();
  const generated = useId();
  const base = id ?? field?.id ?? generated;
  const hintId = `${base}-hint`;
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const hint = options[selectedIndex]?.hint;

  function select(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    buttons.current[index]?.focus();
  }

  /** Walks `step` places from `from`, skipping disabled options, wrapping at the ends. */
  function step(from: number, direction: 1 | -1) {
    const count = options.length;
    for (let offset = 1; offset <= count; offset += 1) {
      const index = (((from + direction * offset) % count) + count) % count;
      if (!options[index].disabled) return select(index);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        step(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        step(index, -1);
        break;
      case "Home":
        event.preventDefault();
        step(-1, 1);
        break;
      case "End":
        event.preventDefault();
        step(options.length, -1);
        break;
    }
  }

  return (
    <div>
      <div
        id={base}
        role="radiogroup"
        aria-label={field ? undefined : label}
        aria-labelledby={field?.labelId}
        aria-describedby={hint ? hintId : field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={s.seg}
        data-disabled={disabled ? "" : undefined}
        style={{ "--n": options.length, "--i": selectedIndex } as CSSProperties}
      >
        <span className={s.segThumb} aria-hidden="true" />
        {options.map((option, index) => (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            tabIndex={index === selectedIndex ? 0 : -1}
            disabled={disabled || option.disabled}
            className={s.segOption}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint ? (
        <p id={hintId} className={s.segHint} aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
