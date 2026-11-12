import type { PublicDocument } from "@/lib/documents/public";
import { CATEGORIES, optionLabel } from "@/lib/documents/categories";
import DocumentActions from "./DocumentActions";
import { fieldString, formatDate } from "./format";
import { Fact, StateChip, stagger } from "./parts";
import styles from "./documents.module.css";

const BASE = CATEGORIES.company_identity.base;

/**
 * Company identity as hairline rows with an accent bar on hover, the same vocabulary as the
 * proof rows on /about. Labels come from the category's own specs, so they match the admin editor.
 */
export default function IdentityRows({ docs }: { docs: PublicDocument[] }) {
  return (
    <ul className={styles.idRows}>
      {docs.map((doc, i) => {
        const { fields } = doc;
        const type = optionLabel("company_identity", "identity_type", fields.identity_type);
        const address = fieldString(fields, "registered_address");
        const issued = formatDate(doc.issuedOn);
        const until = formatDate(doc.expiresOn);

        return (
          <li key={doc.id} className={styles.idRow} data-reveal="wipe" style={stagger(i)}>
            <span className={styles.n} aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className={styles.idMain}>
              {type ? <span className={styles.kind}>{type}</span> : null}
              <h3>{doc.title}</h3>
              {doc.summary ? <p className={styles.summary}>{doc.summary}</p> : null}
            </div>
            <dl className={styles.facts}>
              <Fact label={BASE.holderName.label}>{doc.holderName}</Fact>
              <Fact label={BASE.referenceNo.label}>{doc.referenceNo}</Fact>
              <Fact label="Issuing authority">{fieldString(fields, "issuing_authority")}</Fact>
              <Fact label="Jurisdiction">{fieldString(fields, "jurisdiction")}</Fact>
              <Fact label={BASE.issuedOn.label}>{issued}</Fact>
              <Fact label={BASE.expiresOn.label}>
                {until ? (
                  <>
                    {until} {doc.state === "expired" ? <StateChip state="expired" /> : null}
                  </>
                ) : null}
              </Fact>
            </dl>
            <DocumentActions doc={doc} />
            {address ? <p className={styles.address}>{address}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
