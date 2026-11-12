"use client";

import { memo, useCallback, type ReactNode } from "react";
import { MAX_TAGS } from "@/lib/documents/validate";
import type { FieldSpec } from "@/lib/documents/types";
import ui from "../admin.module.css";
import { FormField } from "../FormField";
import { AlertIcon } from "../icons";
import { DateInput, SelectInput, TextArea, TextInput } from "../inputs";
import { Switch } from "../Switch";
import { TagInput } from "../TagInput";
import ed from "./editor.module.css";
import { fieldDomId } from "./editorErrors";
import type { EditorFieldValue } from "./editorModel";

/** "Public" / "Admin only": the editor is explicit about which answers visitors can ever see. */
export function VisibilityMark({ publicField }: { publicField: boolean }) {
  return (
    <span
      className={ed.mark}
      data-scope={publicField ? "public" : "admin"}
      title={
        publicField
          ? "Visitors can see this once the document is published and visible."
          : "Only people signed in to this console ever see this."
      }
    >
      {publicField ? "Public" : "Admin only"}
    </span>
  );
}

/** Same message the server gives; shown as soon as the text is too long (a paste can exceed the limit). */
export function lengthError(value: string, maxLength: number | undefined): string | undefined {
  if (maxLength === undefined) return undefined;
  return Array.from(value).length > maxLength ? `Must be at most ${maxLength} characters.` : undefined;
}

export function InlineError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} className={ui.fieldError} role="alert">
      <AlertIcon width={14} height={14} />
      <span>{message}</span>
    </p>
  );
}

interface FieldControlProps {
  field: FieldSpec;
  value: EditorFieldValue | undefined;
  /** `required` or `requiredWhen` satisfied right now. */
  required: boolean;
  error?: string;
  /** Receives the field's key, so one stable callback serves every field. */
  onChange: (key: string, value: EditorFieldValue) => void;
}

function asText(value: EditorFieldValue | undefined): string {
  return typeof value === "string" ? value : "";
}

/**
 * One category field, rendered from its `FieldSpec`. Memoised on primitive props with a single
 * stable `onChange`, so typing in one field re-renders that field alone.
 */
function FieldControlImpl({ field, value, required, error, onChange }: FieldControlProps) {
  const key = field.key;
  const id = fieldDomId(key);
  const text = asText(value);

  const setText = useCallback((next: string) => onChange(key, next), [onChange, key]);
  const setFlag = useCallback((next: boolean) => onChange(key, next), [onChange, key]);
  const setTags = useCallback((next: string[]) => onChange(key, next), [onChange, key]);

  if (field.type === "boolean") {
    return (
      <div className={ed.switchCell}>
        <Switch id={id} checked={value === true} onChange={setFlag} label={field.label} hint={field.help} />
        <div className={ed.switchMeta}>
          <VisibilityMark publicField={field.public} />
        </div>
        {error ? <InlineError message={error} /> : null}
      </div>
    );
  }

  const hint: ReactNode = (
    <>
      <VisibilityMark publicField={field.public} />
      {field.help}
    </>
  );
  const live = field.type === "text" || field.type === "url" || field.type === "email" ? lengthError(text, field.maxLength) : undefined;
  const wide = field.type === "textarea" || field.type === "tags" || field.type === "url";

  let control: ReactNode;
  switch (field.type) {
    case "textarea":
      control = <TextArea value={text} onChange={setText} maxLength={field.maxLength} rows={4} placeholder={field.placeholder} />;
      break;
    case "select":
      control = (
        <SelectInput
          value={text}
          onChange={setText}
          options={field.options ?? []}
          placeholder={required ? "Select…" : "Not set"}
        />
      );
      break;
    case "date":
      control = <DateInput value={text} onChange={setText} clearable={!required} />;
      break;
    case "tags":
      control = (
        <TagInput
          value={Array.isArray(value) ? value : []}
          onChange={setTags}
          max={MAX_TAGS}
          maxLength={field.maxLength ?? 40}
          placeholder="Type a tag and press Enter"
        />
      );
      break;
    case "number":
      control = (
        <TextInput
          type="number"
          value={text}
          onChange={setText}
          min={field.min}
          max={field.max}
          step="any"
          inputMode="decimal"
          placeholder={field.placeholder}
        />
      );
      break;
    case "email":
      control = <TextInput type="email" value={text} onChange={setText} autoComplete="off" spellCheck={false} placeholder={field.placeholder} />;
      break;
    case "url":
      control = <TextInput type="url" value={text} onChange={setText} autoComplete="off" spellCheck={false} placeholder={field.placeholder} />;
      break;
    default:
      control = <TextInput value={text} onChange={setText} autoComplete="off" placeholder={field.placeholder} />;
  }

  return (
    <FormField id={id} label={field.label} hint={hint} error={error ?? live} required={required} wide={wide}>
      {control}
    </FormField>
  );
}

export const FieldControl = memo(FieldControlImpl);
