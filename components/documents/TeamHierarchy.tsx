import Link from "next/link";
import type { PublicDocument } from "@/lib/documents/public";
import { optionLabel } from "@/lib/documents/categories";
import { departmentCounts, departmentOf, foldText, groupTeamByLevel, reportsToLabel, type SortOrders } from "@/lib/documents/team";
import { verifyRoute } from "@/lib/nav";
import { fieldString, fieldTags, fileHref, initials, safeHref } from "./format";
import { TagList, stagger } from "./parts";
import TeamTiers, { type TeamTierView } from "./TeamTiers";
import styles from "./documents.module.css";

function Portrait({ doc }: { doc: PublicDocument }) {
  if (doc.hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- served by our own access-checked route, not an optimisable static asset
      <img
        className={styles.portraitImg}
        src={fileHref(doc.id, "photo")}
        width={112}
        height={112}
        alt={`Portrait of ${doc.holderName}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <span className={styles.monogram} aria-hidden="true">
      {initials(doc.holderName)}
    </span>
  );
}

interface TeamMemberCardProps {
  doc: PublicDocument;
  index: number;
  /** Who they report to, already resolved against the rest of the listed team; "" shows no line. */
  reportsTo: string;
  /** Leadership cards are a little larger than the rest. */
  leader: boolean;
}

/**
 * One person. Only a `PublicDocument` reaches it, so only fields marked `public` in the category
 * spec can appear; the photo shows only when the record opted in (`hasPhoto`).
 */
function TeamMemberCard({ doc, index, reportsTo, leader }: TeamMemberCardProps) {
  const { fields } = doc;
  const kind = optionLabel("program_record", "record_kind", fields.record_kind);
  const status = fields.record_status === "active" ? "" : optionLabel("program_record", "record_status", fields.record_status);
  // A profile saved before job titles were required still has its headline, which is the next best thing.
  const role = fieldString(fields, "role_title") || doc.title;
  const department = departmentOf(doc);
  const programme = [fieldString(fields, "program_name"), fieldString(fields, "cohort")].filter(Boolean).join(" · ");
  const bio = fieldString(fields, "bio");
  const linkedin = safeHref(fields.linkedin_url);

  return (
    <article className={styles.member} data-size={leader ? "lead" : undefined} aria-labelledby={`person-${doc.id}`} data-reveal="up" style={stagger(index)}>
      <div className={styles.portrait}>
        <Portrait doc={doc} />
      </div>
      <div className={styles.personBody}>
        {kind || status ? (
          <p className={styles.personKind}>
            {kind ? <span className={styles.kind}>{kind}</span> : null}
            {status ? <span className={styles.chip}>{status}</span> : null}
          </p>
        ) : null}
        <h3 id={`person-${doc.id}`}>{doc.holderName}</h3>
        {role ? <p className={styles.role}>{role}</p> : null}
        {department ? (
          <p className={styles.deptLine}>
            <span className={styles.chip}>{department}</span>
          </p>
        ) : null}
        {reportsTo ? <p className={styles.reportsTo}>{`Reports to ${reportsTo}`}</p> : null}
        {programme ? <p className={styles.programme}>{programme}</p> : null}
        {bio ? <p className={styles.bio}>{bio}</p> : null}
        <TagList tags={fieldTags(fields, "skills")} label={`${doc.holderName}'s skills`} />
        <p className={styles.personLinks}>
          {linkedin ? (
            <a className={styles.textLink} href={linkedin} target="_blank" rel="noopener noreferrer nofollow">
              LinkedIn<span className={styles.srOnly}> profile of {doc.holderName} (opens in a new tab)</span>
            </a>
          ) : null}
          {doc.verificationCode ? (
            <Link className={styles.textLink} href={verifyRoute(doc.verificationCode)} prefetch={false}>
              Verify record<span className={styles.srOnly}> for {doc.holderName}</span>
            </Link>
          ) : null}
        </p>
      </div>
    </article>
  );
}

/**
 * The Team section: people grouped into tiers from leadership down to interns, each with a count
 * and a connector, plus a department filter when there is more than one department.
 *
 * Everything is rendered here, on the server, so the page is complete without JavaScript. The cards
 * are handed to a small client component only so it can hide and show them; it never receives
 * anything that is not already public. Reporting lines are plain text ("Reports to Name"), never links
 * and never a tree: a profile that names a manager who is not listed simply prints the name.
 */
export default function TeamHierarchy({ docs, sortOrders }: { docs: PublicDocument[]; sortOrders?: SortOrders }) {
  const tiers = groupTeamByLevel(docs, sortOrders);
  const position = new Map(tiers.flatMap((tier) => tier.docs).map((doc, i) => [doc.id, i] as const));

  const views: TeamTierView[] = tiers.map((tier) => ({
    level: tier.level,
    heading: tier.heading,
    people: tier.docs.map((doc) => ({
      id: doc.id,
      department: foldText(departmentOf(doc)),
      card: (
        <TeamMemberCard doc={doc} index={position.get(doc.id) ?? 0} reportsTo={reportsToLabel(doc, docs)} leader={tier.level === "leadership"} />
      ),
    })),
  }));

  return <TeamTiers tiers={views} departments={departmentCounts(docs)} total={docs.length} />;
}
