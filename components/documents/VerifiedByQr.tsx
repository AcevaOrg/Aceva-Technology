import { CATEGORIES } from "@/lib/documents/categories";
import { QR_PANELS, QR_PANEL_LABELS, type UnlistedCategory } from "./content";
import VerifyForm from "./VerifyForm";
import { describeVerifierView } from "./format";
import styles from "./documents.module.css";

/**
 * The stand-in for categories that are never listed. Rather than showing nothing, it explains how a
 * record is checked and what the person checking is shown versus what stays private. Both lists
 * are derived from the category's field specs, so this page cannot promise more or less than the
 * verify page does.
 */
export default function VerifiedByQr({ category }: { category: UnlistedCategory }) {
  const copy = QR_PANELS[category];
  const { sees, hidden } = describeVerifierView(category);

  return (
    <div className={styles.qrPanel} data-reveal="up">
      <div className={styles.qrCopy}>
        <p className={styles.panelKicker}>
          <i className={styles.slash} />
          {copy.kicker}
        </p>
        <h3>{copy.title}</h3>
        <p className={styles.panelBody}>{copy.body}</p>
        <div className={styles.seeGrid}>
          <div>
            <h4>{QR_PANEL_LABELS.sees}</h4>
            <ul className={styles.plainList}>
              {sees.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{QR_PANEL_LABELS.hidden}</h4>
            <ul className={styles.plainList} data-tone="muted">
              {hidden.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.qrForm}>
        <VerifyForm variant="panel" label={copy.codeLabel} buttonLabel="Verify" />
        <p className={styles.camera}>Or scan the QR on the {CATEGORIES[category].label.toLowerCase()} with a phone camera. It opens the same page.</p>
      </div>
    </div>
  );
}
