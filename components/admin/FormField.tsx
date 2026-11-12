"use client";

import { createContext, useContext, type ReactNode } from "react";
import s from "./admin.module.css";
import { AlertIcon } from "./icons";
import { cx } from "./utils";

/** What a form control inherits from the FormField around it, so it never has to be wired by hand. */
export interface FieldContextValue {
  /** The id the control should use, so the <label htmlFor> reaches it. */
  id: string;
  /** Id of the visible label: composite controls (radiogroups) point aria-labelledby at it. */
  labelId: string;
  /** Space-separated ids of the hint and error text, for aria-describedby. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The surrounding FormField's wiring, or null when the control is used on its own. */
export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

interface FormFieldProps {
  /** Unique within the page; becomes the control's id and the prefix of the hint/error ids. */
  id: string;
  label: string;
  /** Help shown under the label, before the control. */
  hint?: ReactNode;
  /** A validation message. Announced when it appears, and tied to the control with aria-describedby. */
  error?: string;
  required?: boolean;
  /** Span both columns of a FormSection grid. */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label, hint, error and control as one unit. Controls placed inside (TextInput, TextArea, SelectInput,
 * DateInput, TagInput, SegmentedControl) pick up their id, aria-describedby, aria-invalid and
 * aria-required from here. Order follows the GOV.UK pattern: label, hint, error, control.
 */
export function FormField({ id, label, hint, error, required = false, wide, className, children }: FormFieldProps) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx(s.field, wide && s.span2, className)}>
      <div className={s.fieldHead}>
        <label id={labelId} htmlFor={id} className={s.fieldLabel}>
          {label}
          {required ? (
            <span className={s.req} aria-hidden="true">
              {" "}
              *
            </span>
          ) : null}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className={s.fieldHint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={s.fieldError} role="alert">
          <AlertIcon width={14} height={14} />
          <span>{error}</span>
        </p>
      ) : null}
      <FieldContext.Provider value={{ id, labelId, describedBy, invalid: Boolean(error), required }}>
        {children}
      </FieldContext.Provider>
    </div>
  );
}
