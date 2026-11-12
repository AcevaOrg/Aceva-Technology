"use client";

import { memo, useCallback, type ReactNode } from "react";
import { CATEGORIES } from "@/lib/documents/categories";
import type { BaseFieldSpec, DocumentCategory } from "@/lib/documents/types";
import {
  MAX_HOLDER_LENGTH,
  MAX_REFERENCE_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
} from "@/lib/documents/validate";
import { Button } from "../Button";
import { FormField } from "../FormField";
import { FormSection } from "../FormSection";
import { RefreshIcon } from "../icons";
import { DateInput, TextArea, TextInput } from "../inputs";
import ed from "./editor.module.css";
import { baseDomId } from "./editorErrors";
import { BASE_KEYS, type EditorBaseKey, type EditorValues } from "./editorModel";
import { VisibilityMark, lengthError } from "./FieldControl";

const TEXT_LIMITS: Partial<Record<EditorBaseKey, number>> = {
  title: MAX_TITLE_LENGTH,
  summary: MAX_SUMMARY_LENGTH,
  holderName: MAX_HOLDER_LENGTH,
  referenceNo: MAX_REFERENCE_LENGTH,
};

const WIDE: ReadonlySet<EditorBaseKey> = new Set<EditorBaseKey>(["title", "summary"]);

interface BaseFieldProps {
  name: EditorBaseKey;
  spec: BaseFieldSpec;
  value: string;
  error?: string;
  onChange: (key: EditorBaseKey, value: string) => void;
  onSuggest?: () => void;
  suggesting?: boolean;
}

/** One of the six columns every record has, labelled and flagged required exactly as the category says. */
const BaseField = memo(function BaseField({ name, spec, value, error, onChange, onSuggest, suggesting }: BaseFieldProps) {
  const id = baseDomId(name);
  const set = useCallback((next: string) => onChange(name, next), [onChange, name]);
  const limit = TEXT_LIMITS[name];

  const hint: ReactNode = (
    <>
      <VisibilityMark publicField />
      {spec.help}
    </>
  );

  let control: ReactNode;
  if (name === "summary") {
    control = <TextArea value={value} onChange={set} maxLength={limit} rows={3} placeholder={spec.placeholder} />;
  } else if (name === "issuedOn" || name === "expiresOn") {
    control = <DateInput value={value} onChange={set} clearable={!spec.required} />;
  } else if (name === "referenceNo" && onSuggest) {
    control = (
      <div className={ed.withAction}>
        <TextInput value={value} onChange={set} autoComplete="off" spellCheck={false} placeholder={spec.placeholder} />
        <Button
          variant="ghost"
          size="sm"
          shine={false}
          loading={suggesting}
          iconLeading={<RefreshIcon width={16} height={16} />}
          onClick={onSuggest}
          aria-label="Suggest the next reference number"
        >
          Suggest
        </Button>
      </div>
    );
  } else {
    control = <TextInput value={value} onChange={set} autoComplete="off" placeholder={spec.placeholder} />;
  }

  return (
    <FormField
      id={id}
      label={spec.label}
      hint={hint}
      error={error ?? (name === "summary" ? undefined : lengthError(value, limit))}
      required={spec.required}
      wide={WIDE.has(name)}
    >
      {control}
    </FormField>
  );
});

interface BasicsSectionProps {
  category: DocumentCategory;
  values: Pick<EditorValues, EditorBaseKey>;
  errors: Record<string, string>;
  onChange: (key: EditorBaseKey, value: string) => void;
  onSuggest: () => void;
  suggesting: boolean;
}

/** Title, summary, holder, reference and dates, minus whatever the category hides. */
function BasicsSectionImpl({ category, values, errors, onChange, onSuggest, suggesting }: BasicsSectionProps) {
  const spec = CATEGORIES[category];
  return (
    <FormSection title="Basics" description={spec.adminHelp}>
      {BASE_KEYS.filter((key) => !spec.base[key].hidden).map((key) => (
        <BaseField
          key={key}
          name={key}
          spec={spec.base[key]}
          value={values[key]}
          error={errors[key]}
          onChange={onChange}
          onSuggest={key === "referenceNo" ? onSuggest : undefined}
          suggesting={key === "referenceNo" ? suggesting : undefined}
        />
      ))}
    </FormSection>
  );
}

export const BasicsSection = memo(BasicsSectionImpl);
