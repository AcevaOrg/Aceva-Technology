"use client";

import { useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import s from "./admin.module.css";
import { useFieldContext } from "./FormField";
import { CloseIcon } from "./icons";
import { addTags, type TagAddResult } from "./utils";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Most tags allowed. */
  max: number;
  /** Longest single tag, in characters. */
  maxLength: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Free-form tags as removable chips. Enter, a comma, a semicolon, a pasted list or leaving the field
 * adds them; Backspace on an empty field removes the last. Duplicates are ignored (case-insensitively)
 * and over-long tags are refused with a message rather than silently cut.
 */
export function TagInput({ value, onChange, max, maxLength, placeholder, disabled, id }: TagInputProps) {
  const field = useFieldContext();
  const generated = useId();
  const inputId = id ?? field?.id ?? generated;
  const metaId = `${inputId}-meta`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [issue, setIssue] = useState<TagAddResult["skipped"]>(null);
  const [announcement, setAnnouncement] = useState("");

  function commit(raw: string) {
    if (!raw.trim()) {
      setDraft("");
      return;
    }
    const result = addTags(value, raw, { max, maxLength });
    const added = result.next.slice(value.length);
    if (added.length > 0) {
      onChange(result.next);
      setAnnouncement(`${added.join(", ")} added`);
    }
    setIssue(result.skipped);
    // A tag that was too long stays in the box so it can be shortened instead of retyped.
    setDraft(result.skipped === "length" && added.length === 0 ? raw : "");
  }

  function remove(tag: string) {
    onChange(value.filter((existing) => existing !== tag));
    setAnnouncement(`${tag} removed`);
    setIssue(null);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      // Enter must add a tag, never submit the surrounding form.
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    // A multi-line paste would be flattened by the input; take it as a list instead.
    if (/[\n\r]/.test(text)) {
      event.preventDefault();
      commit(`${draft},${text}`);
    }
  }

  const issueText =
    issue === "limit" ? `Up to ${max} tags.` : issue === "length" ? `Tags can be up to ${maxLength} characters.` : "";

  return (
    <div>
      <div
        className={s.tagBox}
        data-invalid={field?.invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span key={tag} className={s.tag}>
            {tag}
            <button type="button" className={s.tagRemove} aria-label={`Remove ${tag}`} disabled={disabled} onClick={() => remove(tag)}>
              <CloseIcon width={14} height={14} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className={s.tagInput}
          value={draft}
          disabled={disabled || value.length >= max}
          placeholder={value.length === 0 ? placeholder : undefined}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={[field?.describedBy, metaId].filter(Boolean).join(" ")}
          aria-invalid={field?.invalid || undefined}
          onChange={(event) => {
            const next = event.target.value;
            // Mobile keyboards often report an unidentified key for the comma, so watch the text itself.
            if (/[,;]/.test(next)) commit(next);
            else {
              setDraft(next);
              setIssue(null);
            }
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => commit(draft)}
        />
      </div>
      <p id={metaId} className={s.tagMeta}>
        <span>
          {value.length} of {max} tags
        </span>
        {issueText ? <span data-issue="">{issueText}</span> : null}
      </p>
      <span role="status" className={s.srOnly}>
        {announcement}
      </span>
    </div>
  );
}
