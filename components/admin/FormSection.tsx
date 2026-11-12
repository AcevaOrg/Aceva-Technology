import { useId, type ReactNode } from "react";
import s from "./admin.module.css";
import { cx } from "./utils";

interface FormSectionProps {
  /** The fieldset's legend: matches a `FieldSpec.group` heading ("Report", "Recipient"). */
  title: string;
  /** One line of guidance under the legend. */
  description?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A <fieldset> whose fields flow in a responsive two-column grid (one column on phones). A FormField
 * with `wide` spans both columns. Stack several inside `<div className={adminStyles.formSections}>`.
 */
export function FormSection({ title, description, className, children }: FormSectionProps) {
  const descriptionId = useId();
  return (
    <fieldset className={cx(s.fieldset, className)} aria-describedby={description ? descriptionId : undefined}>
      <legend className={s.legend}>
        <span className={s.legendInner}>
          <i className={s.slash} aria-hidden="true" />
          {title}
        </span>
      </legend>
      {description ? (
        <p id={descriptionId} className={s.fieldsetHelp}>
          {description}
        </p>
      ) : null}
      <div className={s.fieldGrid}>{children}</div>
    </fieldset>
  );
}

interface ActionBarProps {
  /** Left side: what is happening ("3 unsaved changes", "Draft saved 2 min ago"). Pair with `dirty`. */
  status?: ReactNode;
  /** Pulses an amber dot beside `status` to flag unsaved work. */
  dirty?: boolean;
  /** Right side: the form's buttons. */
  children: ReactNode;
}

/** A floating bar pinned to the bottom of the viewport while a long form scrolls. */
export function ActionBar({ status, dirty, children }: ActionBarProps) {
  return (
    <div className={s.actionBar} role="group" aria-label="Form actions">
      <div className={s.actionBarText}>
        {dirty ? <span className={s.dirtyDot} aria-hidden="true" /> : null}
        {status ? <span>{status}</span> : null}
      </div>
      <div className={s.actionBarButtons}>{children}</div>
    </div>
  );
}
