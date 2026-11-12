"use client";

import { useId, type InputHTMLAttributes, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { FieldOption } from "@/lib/documents/types";
import s from "./admin.module.css";
import { Button } from "./Button";
import { useFieldContext } from "./FormField";
import { ChevronDownIcon } from "./icons";
import { cx } from "./utils";

/**
 * The id, aria-describedby, aria-invalid and aria-required a control should carry: taken from the
 * surrounding FormField, with an explicit prop always winning and a generated id as the last resort.
 */
function useControlProps(explicitId: string | undefined, explicitDescribedBy: string | undefined) {
  const field = useFieldContext();
  const fallbackId = useId();
  return {
    required: field?.required ?? false,
    props: {
      id: explicitId ?? field?.id ?? fallbackId,
      "aria-describedby": [explicitDescribedBy, field?.describedBy].filter(Boolean).join(" ") || undefined,
      "aria-invalid": field?.invalid ? (true as const) : undefined,
      "aria-required": field?.required ? (true as const) : undefined,
    },
  };
}

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type"> & {
  value: string;
  /** Receives the new string value, not the event. */
  onChange: (value: string) => void;
  type?: "text" | "email" | "url" | "number" | "password" | "search" | "tel";
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

/** A single-line input, 48px tall. Inside a FormField it is wired to the label, hint and error. */
export function TextInput({ value, onChange, type = "text", className, ...rest }: TextInputProps) {
  const { props } = useControlProps(rest.id, rest["aria-describedby"]);
  return <input {...rest} {...props} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cx(s.input, className)} />;
}

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className"> & {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ref?: Ref<HTMLTextAreaElement>;
};

/** A multi-line input. When `maxLength` is set, a live "120 / 2000" counter sits underneath. */
export function TextArea({ value, onChange, className, maxLength, rows = 5, ...rest }: TextAreaProps) {
  const { props } = useControlProps(rest.id, rest["aria-describedby"]);
  const near = maxLength !== undefined && value.length >= maxLength * 0.9;
  return (
    <div className={s.textareaWrap}>
      <textarea
        {...rest}
        {...props}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(s.textarea, className)}
      />
      {maxLength !== undefined ? (
        <span className={s.counter} data-near={near ? "" : undefined}>
          {value.length} / {maxLength}
        </span>
      ) : null}
    </div>
  );
}

export type SelectInputProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className" | "children"> & {
  value: string;
  onChange: (value: string) => void;
  options: readonly FieldOption[];
  /** Label of the empty first option. Without it, the empty option appears only while nothing is chosen. */
  placeholder?: string;
  className?: string;
  ref?: Ref<HTMLSelectElement>;
};

/** A native <select> (best on phones) restyled to match the inputs. */
export function SelectInput({ value, onChange, options, placeholder, className, ...rest }: SelectInputProps) {
  const { props, required } = useControlProps(rest.id, rest["aria-describedby"]);
  const showEmpty = placeholder !== undefined || value === "" || !options.some((option) => option.value === value);
  return (
    <div className={s.selectWrap}>
      <select {...rest} {...props} value={value} onChange={(event) => onChange(event.target.value)} className={cx(s.select, className)}>
        {showEmpty ? (
          <option value="" disabled={required}>
            {placeholder ?? "Select…"}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className={s.selectIcon} width={16} height={16} />
    </div>
  );
}

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "className"> & {
  /** YYYY-MM-DD, or "" for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Show a "Clear" button (iOS has no way to empty a date input). Defaults to on for optional fields. */
  clearable?: boolean;
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

/** A native date picker whose value is always a plain YYYY-MM-DD string, never a Date. */
export function DateInput({ value, onChange, clearable, className, disabled, ...rest }: DateInputProps) {
  const { props, required } = useControlProps(rest.id, rest["aria-describedby"]);
  const canClear = (clearable ?? !required) && value !== "" && !disabled;
  return (
    <div className={s.dateRow}>
      <input
        {...rest}
        {...props}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cx(s.input, className)}
      />
      {canClear ? (
        <Button variant="quiet" size="sm" aria-label="Clear date" onClick={() => onChange("")}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
