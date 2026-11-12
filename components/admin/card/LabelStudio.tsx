"use client";

import { useId, useMemo, useState, type CSSProperties } from "react";
import ui from "@/components/admin/admin.module.css";
import { FormField } from "@/components/admin/FormField";
import { Panel } from "@/components/admin/Panel";
import { SegmentedControl } from "@/components/admin/SegmentedControl";
import { QrLabel } from "./LabelFaces";
import { PrintButton } from "./PrintButton";
import { PrintSheets } from "./PrintSheets";
import { QrPanel } from "./QrPanel";
import { ReadinessBanner, ReadinessChecklist } from "./Readiness";
import { SheetDiagram } from "./SheetDiagram";
import s from "./card.module.css";
import type { CardData, Readiness } from "./cardData";
import { LABELS, LABEL_LIST, PAPER_LIST, planLabelSheet, type LabelCopies, type LabelKind, type PaperId } from "./cardLayout";

interface LabelStudioProps {
  data: CardData;
  readiness: Readiness;
  editorHref: string;
}

const LABEL_OPTIONS = LABEL_LIST.map((label) => ({ value: label.id, label: label.label, hint: label.hint }));
const PAPER_OPTIONS = PAPER_LIST.map((paper) => ({ value: paper.id, label: paper.label }));

/**
 * QR label workspace for certificates, team profiles and experience letters: pick one of the four label
 * designs, preview it at a fixed scale, and print one or a full sheet. The QR itself can also be downloaded.
 */
export function LabelStudio({ data, readiness, editorHref }: LabelStudioProps) {
  const [kind, setKind] = useState<LabelKind>("strip");
  const [copies, setCopies] = useState<LabelCopies>("fill");
  const [paperId, setPaperId] = useState<PaperId>("a4");
  const baseId = useId();
  const labelId = useId().replace(/[^a-zA-Z0-9]/g, "");

  const plan = useMemo(() => planLabelSheet({ label: kind, paper: paperId, copies }), [kind, paperId, copies]);
  const spec = LABELS[kind];
  const copiesOptions = [
    { value: "one" as const, label: "One label" },
    { value: "fill" as const, label: `Fill the sheet (${plan.capacity})` },
  ];

  return (
    <div className={ui.stackLg}>
      <ReadinessBanner readiness={readiness} editorHref={editorHref} />

      <div className={ui.split}>
        <div className={ui.stack}>
          <Panel eyebrow="Preview" title={`${spec.label} label`}>
            <div className={s.labelStage}>
              {/* key restarts the entrance animation when the design changes */}
              <div key={kind} className={s.labelBox} style={{ "--pw": spec.widthMm } as CSSProperties}>
                <QrLabel data={data} kind={kind} idPrefix={`${labelId}pv`} />
              </div>
            </div>
            <p className={s.stageNote}>
              {spec.widthMm} × {spec.heightMm} mm · shown at one fixed scale
            </p>
          </Panel>
        </div>

        <div className={ui.splitAside}>
          <Panel eyebrow="Print" title="Sheet">
            <div className={s.controls}>
              <FormField id={`${baseId}-kind`} label="Label size">
                <SegmentedControl label="Label size" options={LABEL_OPTIONS} value={kind} onChange={setKind} />
              </FormField>
              <FormField id={`${baseId}-copies`} label="How many">
                <SegmentedControl label="Labels to print" options={copiesOptions} value={copies} onChange={setCopies} />
              </FormField>
              <FormField id={`${baseId}-paper`} label="Paper">
                <SegmentedControl label="Paper size" options={PAPER_OPTIONS} value={paperId} onChange={setPaperId} />
              </FormField>

              <SheetDiagram paper={plan.paper} pages={plan.pages} />
              <p className={s.summary}>
                <b>
                  {plan.count} {plan.count === 1 ? "label" : "labels"}
                </b>{" "}
                on {plan.paper.label}. {plan.capacity} fit on a sheet at this size.
              </p>

              <PrintButton block disabled={!readiness.ready || plan.count === 0} label="Print" />
            </div>
            <ul className={s.tips}>
              <li>Choose scale 100% (Actual size) so labels print at their stated size.</li>
              <li>Turn off Headers and footers and turn on Background graphics.</li>
              <li>Use plain white paper or sticker stock. Cut along the corner marks.</li>
            </ul>
          </Panel>

          <QrPanel data={data} />
          <ReadinessChecklist readiness={readiness} />
        </div>
      </div>

      {readiness.ready && plan.count > 0 ? (
        <PrintSheets
          paper={plan.paper}
          pages={plan.pages}
          renderCell={(_placement, idPrefix) => <QrLabel data={data} kind={kind} idPrefix={idPrefix} />}
        />
      ) : null}
    </div>
  );
}
