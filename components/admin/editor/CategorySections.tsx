"use client";

import { memo, useMemo } from "react";
import type { DocumentCategory } from "@/lib/documents/types";
import { FormSection } from "../FormSection";
import { evaluateFields, groupFields, type EditorFieldValue } from "./editorModel";
import { FieldControl } from "./FieldControl";

interface CategorySectionsProps {
  category: DocumentCategory;
  data: Record<string, EditorFieldValue>;
  errors: Record<string, string>;
  /** One stable callback for every field; it receives the field's key. */
  onChange: (key: string, value: EditorFieldValue) => void;
}

/**
 * The category's own fields, one fieldset per `FieldSpec.group`. Which fields show, and which are
 * required, is recomputed from the answers on every change, so `showWhen` and `requiredWhen`
 * react live. A group whose fields are all hidden disappears with them.
 */
function CategorySectionsImpl({ category, data, errors, onChange }: CategorySectionsProps) {
  const groups = useMemo(() => groupFields(category), [category]);
  const states = useMemo(() => new Map(evaluateFields(category, data).map((state) => [state.field.key, state])), [category, data]);

  return (
    <>
      {groups.map((group) => {
        const shown = group.fields.filter((field) => states.get(field.key)?.visible);
        if (shown.length === 0) return null;
        return (
          <FormSection key={group.title} title={group.title}>
            {shown.map((field) => (
              <FieldControl
                key={field.key}
                field={field}
                value={data[field.key]}
                required={states.get(field.key)?.required ?? false}
                error={errors[field.key]}
                onChange={onChange}
              />
            ))}
          </FormSection>
        );
      })}
    </>
  );
}

export const CategorySections = memo(CategorySectionsImpl);
