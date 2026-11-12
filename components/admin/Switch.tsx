"use client";

import { useId } from "react";
import s from "./admin.module.css";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The setting's name: "Allow public download". */
  label: string;
  /** What flipping it does, in one sentence. Read out as the switch's description. */
  hint?: string;
  disabled?: boolean;
  id?: string;
}

/** An on/off setting. The whole row is the 56px-tall button; the label is its accessible name. */
export function Switch({ checked, onChange, label, hint, disabled, id }: SwitchProps) {
  const generated = useId();
  const base = id ?? generated;
  const labelId = `${base}-label`;
  const hintId = hint ? `${base}-hint` : undefined;

  return (
    <button
      id={base}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={hintId}
      disabled={disabled}
      className={s.switch}
      onClick={() => onChange(!checked)}
    >
      <span className={s.switchText}>
        <span id={labelId} className={s.switchLabel}>
          {label}
        </span>
        {hint ? (
          <span id={hintId} className={s.switchHint}>
            {hint}
          </span>
        ) : null}
      </span>
      <span className={s.switchTrack} aria-hidden="true">
        <span className={s.switchThumb} />
      </span>
    </button>
  );
}
