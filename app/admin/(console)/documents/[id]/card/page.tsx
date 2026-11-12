import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/admin/Button";
import { EmptyState } from "@/components/admin/EmptyState";
import { ArrowRightIcon, EditIcon } from "@/components/admin/icons";
import { PageHeader } from "@/components/admin/PageHeader";
import { LabelStudio } from "@/components/admin/card/LabelStudio";
import { PrintButton } from "@/components/admin/card/PrintButton";
import { assessReadiness, buildCardData } from "@/components/admin/card/cardData";
import { cardRoute } from "@/components/admin/card/cardFormat";
import { requireAdminPage } from "@/lib/admin/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { CATEGORIES } from "@/lib/documents/categories";
import { verificationUrl } from "@/lib/documents/qr";
import { getDocument, isDocumentId } from "@/lib/documents/store";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";

// Reads the database and the session on every request; `next build` must never need either.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "QR labels" };

/** The record's verification URL, or null when it has no code or a stored value that is not a valid one. */
function usableVerifyUrl(code: string | null): string | null {
  if (!code) return null;
  try {
    return verificationUrl(code);
  } catch {
    // RangeError: not a canonical verification code, so there is nothing a scanner could resolve.
    return null;
  }
}

export default async function DocumentCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Layouts do not re-render on client navigation, so the page proves the session itself.
  await requireAdminPage(cardRoute(id));
  if (!isDocumentId(id)) notFound();

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Print" title="QR labels" />
        <EmptyState
          title="The document registry is not connected"
          body="Set DATABASE_URL (or ACEVA_LOCAL_DB=1 for the local database), run npm run migrate:documents, then reload this page."
          action={
            <ButtonLink href={ADMIN_ROUTES.documents} variant="ghost">
              Back to documents
            </ButtonLink>
          }
        />
      </>
    );
  }

  const record = await getDocument(id);
  if (!record) notFound();

  const category = CATEGORIES[record.category];
  const editorHref = adminDocumentRoute(record.id);
  const verifyUrl = usableVerifyUrl(record.verificationCode);

  // A record that already carries a code gets labels whatever its category; otherwise only verifiable
  // categories do. The rest are told, kindly, how to turn verification on.
  if (!category.verifiable && verifyUrl === null) {
    return (
      <>
        <PageHeader
          eyebrow={category.label}
          title="No QR for this one"
          lede="Labels exist to carry a verification QR code. This record does not have one."
          actions={
            <ButtonLink href={editorHref} variant="ghost" size="sm" iconLeading={<EditIcon width={16} height={16} />}>
              Back to the editor
            </ButtonLink>
          }
        />
        <EmptyState
          title={`${category.plural} are not verified by QR`}
          body="There is nothing to print here. If you want this document to carry a verification code anyway, turn on QR verification in the editor, then come back for the label sheet."
          action={
            <ButtonLink href={editorHref} iconTrailing={<ArrowRightIcon />}>
              Enable verification in the editor
            </ButtonLink>
          }
        />
      </>
    );
  }

  const data = buildCardData(record, verifyUrl);
  const readiness = assessReadiness(record, { hasUsableCode: verifyUrl !== null });
  const who = data.holderName || data.title || "this record";

  return (
    <>
      <PageHeader
        eyebrow={category.label}
        title="QR labels"
        lede={`Labels for ${who}. Stick one on the paper copy so anyone can scan it to confirm the record is genuine.`}
        actions={
          <>
            <ButtonLink href={editorHref} variant="ghost" size="sm" iconLeading={<EditIcon width={16} height={16} />}>
              Back to the editor
            </ButtonLink>
            <PrintButton disabled={!readiness.ready} />
          </>
        }
      />
      <LabelStudio data={data} readiness={readiness} editorHref={editorHref} />
    </>
  );
}
