import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import { CATEGORIES } from "@/lib/documents/categories";
import ui from "@/components/home/home.module.css";
import HomeMotion from "@/components/home/HomeMotion";
import CategorySection, { EmptyState, type SectionCopy } from "@/components/documents/CategorySection";
import CertificateGrid from "@/components/documents/CertificateGrid";
import CertificationsAndLetters from "@/components/documents/CertificationsAndLetters";
import DocumentsClose from "@/components/documents/DocumentsClose";
import DocumentsHero from "@/components/documents/DocumentsHero";
import DocumentsIndex from "@/components/documents/DocumentsIndex";
import FinancialLedger from "@/components/documents/FinancialLedger";
import HowVerificationWorks from "@/components/documents/HowVerificationWorks";
import IdentityRows from "@/components/documents/IdentityRows";
import TeamHierarchy from "@/components/documents/TeamHierarchy";
import VerifiedByQr from "@/components/documents/VerifiedByQr";
import { CERTS_LETTERS_SECTION, PUBLIC_SECTIONS, REGISTRY_NOTICE, type ListedCategory, type PublicSection } from "@/components/documents/content";
import { countDirections } from "@/components/documents/filters";
import { loadRegistry, type RegistrySnapshot } from "@/components/documents/registry";
import styles from "@/components/documents/documents.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Documents & Records",
  description:
    "Financial reports, company registrations, certifications and the people who have built with ACEVA, with a QR code on every record so anyone can verify it.",
  path: ROUTES.documents,
});

// The listing reads the database on every request, so the build must never try to prerender it.
export const dynamic = "force-dynamic";

/** The words each section is framed with. Certifications and experience letters share one. */
const SECTION_COPY: Record<PublicSection, SectionCopy> = {
  financial_report: CATEGORIES.financial_report,
  company_identity: CATEGORIES.company_identity,
  certifications_letters: CERTS_LETTERS_SECTION,
  program_record: CATEGORIES.program_record,
};

/** Alternating surfaces, in page order. */
const SURFACE: Record<PublicSection, "paper" | "paper2" | "ink"> = {
  financial_report: "paper",
  company_identity: "paper2",
  certifications_letters: "ink",
  program_record: "paper",
};

function publishedBadge(count: number): string | undefined {
  return count > 0 ? `${count} published` : undefined;
}

function ListedContent({ category, registry }: { category: ListedCategory; registry: RegistrySnapshot }) {
  if (registry.status === "unavailable") return <EmptyState category={category} unavailable />;
  const docs = registry.byCategory[category];
  if (docs.length === 0) return <EmptyState category={category} />;

  switch (category) {
    case "financial_report":
      return <FinancialLedger docs={docs} />;
    case "company_identity":
      return <IdentityRows docs={docs} />;
    case "certification":
      return <CertificateGrid docs={docs} />;
    case "program_record":
      return <TeamHierarchy docs={docs} sortOrders={registry.sortOrders} />;
  }
}

/**
 * Certifications (listed) and experience letters (never listed, only explained) in one section.
 * Both panels are rendered here, on the server; the client wrapper only filters between them.
 */
function CertificationsAndLettersContent({ registry }: { registry: RegistrySnapshot }) {
  const docs = registry.status === "ok" ? registry.byCategory.certification : [];
  return (
    <CertificationsAndLetters
      certificateCount={registry.status === "ok" ? docs.length : null}
      directionCounts={countDirections(docs)}
      certificates={<ListedContent category="certification" registry={registry} />}
      letters={<VerifiedByQr category="experience_letter" />}
    />
  );
}

function sectionBadge(section: PublicSection, registry: RegistrySnapshot): string | undefined {
  const listed = (category: ListedCategory) => (registry.status === "ok" ? registry.byCategory[category].length : 0);
  switch (section) {
    case "financial_report":
    case "company_identity":
    case "program_record":
      return publishedBadge(listed(section));
    case "certifications_letters": {
      const count = listed("certification");
      return count > 0 ? `${count} published · letters never listed` : "Letters never listed";
    }
  }
}

/**
 * The public documents hub, in four sections: financial reports, company identity, certifications
 * and letters (one section, filterable), and the team. Experience letters are unlisted by design, so
 * their half of the combined section explains QR verification instead of listing anyone. Like every
 * page that reads the database, it renders a calm notice, never an error, when the registry cannot
 * be reached.
 */
export default async function DocumentsPage() {
  const registry = await loadRegistry();
  const indexItems = PUBLIC_SECTIONS.map((section) => ({ slug: SECTION_COPY[section].slug, label: SECTION_COPY[section].plural }));

  return (
    <div data-documents-root className={`${ui.root} ${styles.page}`}>
      <DocumentsHero />
      <div className={styles.body}>
        <DocumentsIndex items={indexItems} />
        {registry.status === "unavailable" ? (
          <div className={`${ui.ink} ${styles.notice}`} role="status">
            <div className={styles.wrap}>
              <p className={styles.noticeTitle}>{REGISTRY_NOTICE.title}</p>
              <p>{REGISTRY_NOTICE.body}</p>
            </div>
          </div>
        ) : null}
        {PUBLIC_SECTIONS.map((section, index) => (
          <CategorySection
            key={section}
            category={SECTION_COPY[section]}
            index={index}
            surface={SURFACE[section]}
            badge={sectionBadge(section, registry)}
          >
            {section === "certifications_letters" ? (
              <CertificationsAndLettersContent registry={registry} />
            ) : (
              <ListedContent category={section} registry={registry} />
            )}
          </CategorySection>
        ))}
      </div>
      <HowVerificationWorks />
      <DocumentsClose />
      <HomeMotion root="[data-documents-root]" />
    </div>
  );
}
