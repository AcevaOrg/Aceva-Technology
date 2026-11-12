"use client";

import { memo, useCallback, useMemo } from "react";
import {
  STAMP_PAGE_LABELS,
  STAMP_PAGES,
  STAMP_POSITION_LABELS,
  STAMP_POSITIONS,
  STAMP_SIZE_LABELS,
  STAMP_SIZES,
  type FileStamp,
  type StampPages,
  type StampPosition,
  type StampSize,
} from "@/lib/documents/types";
import { FormField } from "../FormField";
import { SegmentedControl, type SegmentedOption } from "../SegmentedControl";
import { Switch } from "../Switch";
import ed from "./editor.module.css";
import { settingDomId } from "./editorErrors";
import type { EditorSettingKey, EditorValues } from "./editorModel";
import { InlineError } from "./FieldControl";

interface StampOptionsProps {
  /** The record has, or will get on this save, a verification code. Without one there is nothing to print. */
  hasCode: boolean;
  enabled: boolean;
  position: StampPosition;
  size: StampSize;
  pages: StampPages;
  /** MIME type of the file that would be stamped (a new pick, else the stored one); null when there is none. */
  fileMime: string | null;
  /** What the stored file carries now, and the code the record has now, to say whether the printed QR is current. */
  storedStamp: FileStamp | null;
  currentCode: string | null;
  error?: string;
  onSetting: (patch: Partial<Pick<EditorValues, EditorSettingKey>>) => void;
}

const STAMPABLE = new Set(["application/pdf", "image/png", "image/jpeg"]);

function choices<T extends string>(values: readonly T[], labels: Record<T, string>): SegmentedOption<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/**
 * "Print the QR and code on this file": the switch, and (when it is on) where, how big and on which pages.
 * Saving does the rest: the QR is drawn onto the uploaded file with this record's own code, and the original is kept.
 */
function StampOptionsImpl({ hasCode, enabled, position, size, pages, fileMime, storedStamp, currentCode, error, onSetting }: StampOptionsProps) {
  const positionChoices = useMemo(() => choices(STAMP_POSITIONS, STAMP_POSITION_LABELS), []);
  const sizeChoices = useMemo(() => choices(STAMP_SIZES, STAMP_SIZE_LABELS), []);
  const pageChoices = useMemo(() => choices(STAMP_PAGES, STAMP_PAGE_LABELS), []);

  const setEnabled = useCallback((next: boolean) => onSetting({ stampEnabled: next }), [onSetting]);
  const setPosition = useCallback((next: StampPosition) => onSetting({ stampPosition: next }), [onSetting]);
  const setSize = useCallback((next: StampSize) => onSetting({ stampSize: next }), [onSetting]);
  const setPages = useCallback((next: StampPages) => onSetting({ stampPages: next }), [onSetting]);

  const unsupported = enabled && fileMime !== null && !STAMPABLE.has(fileMime);
  const outOfDate = storedStamp !== null && currentCode !== null && storedStamp.code !== currentCode;

  return (
    <div className={ed.stampBox} data-enabled={enabled ? "" : undefined}>
      <Switch
        id={settingDomId("stamp")}
        checked={enabled}
        onChange={setEnabled}
        disabled={!hasCode}
        label="Print the QR code and verification code on this file"
        hint={
          hasCode
            ? "Added when you save, with this document's own code, on a white panel so it scans on any page. Your original file is kept, so changing the code or the corner never stacks a second QR."
            : "Turn on QR verification under Publishing first. The code is what gets printed on the file."
        }
      />
      {error ? <InlineError message={error} /> : null}

      {unsupported ? (
        <p className={ed.stampWarn} role="note">
          This file is a {fileMime === "image/webp" ? "WEBP image" : "format"} that cannot carry the QR. Choose a PDF, PNG or JPEG, or switch this off.
        </p>
      ) : null}

      {enabled && hasCode ? (
        <div className={ed.stampGrid}>
          <FormField id={settingDomId("stampPosition")} label="Corner">
            <SegmentedControl<StampPosition> options={positionChoices} value={position} onChange={setPosition} label="Corner" />
          </FormField>
          <FormField id={settingDomId("stampSize")} label="Size">
            <SegmentedControl<StampSize> options={sizeChoices} value={size} onChange={setSize} label="Size" />
          </FormField>
          <FormField id={settingDomId("stampPages")} label="Pages">
            <SegmentedControl<StampPages> options={pageChoices} value={pages} onChange={setPages} label="Pages" />
          </FormField>
          <p className={ed.note}>
            Images (PNG, JPEG) are saved as a one-page PDF so the QR can sit on them. If the corner covers something, pick another and save again.
          </p>
        </div>
      ) : null}

      {storedStamp ? (
        <p className={ed.stampStatus} data-tone={outOfDate ? "warn" : undefined} role="status">
          {outOfDate
            ? "The QR on the stored file is for an older code. Save to refresh it."
            : `The stored file carries this document's QR (${STAMP_POSITION_LABELS[storedStamp.position].toLowerCase()}, ${STAMP_SIZE_LABELS[storedStamp.size].toLowerCase()}, ${STAMP_PAGE_LABELS[storedStamp.pages].toLowerCase()}).`}
        </p>
      ) : null}
    </div>
  );
}

export const StampOptions = memo(StampOptionsImpl);
