import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusBadge, VisibilityBadge } from "@/components/admin/Badge";
import { ButtonLink } from "@/components/admin/Button";
import { DocumentEditor } from "@/components/admin/editor/DocumentEditor";
import { formatDateTimeUtc } from "@/components/admin/editor/editorPreview";
import { DatabaseSetupNotice, SetupNotice } from "@/components/admin/editor/SetupNotice";
import { VerificationPanel } from "@/components/admin/editor/VerificationPanel";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/lib/admin/auth";
import { getMaxUploadBytes } from "@/lib/admin/config";
import { isDatabaseConfigured } from "@/lib/db";
import { CATEGORIES } from "@/lib/documents/categories";
import { verificationUrl } from "@/lib/documents/qr";
import { getDocument, isDocumentId } from "@/lib/documents/store";
import type { DocumentRecord } from "@/lib/documents/types";
import { ADMIN_ROUTES, adminDocumentRoute } from "@/lib/nav";

// Reads the database and the session on every request; `next build` must never need either.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit document" };

/** The address the QR encodes, or null when there is no code or the stored one is not a valid code. */
function publicUrlFor(code: string | null): string | null {
  if (!code) return null;
  try {
    return verificationUrl(code);
  } catch {
    // RangeError: not a canonical code, so nothing a scanner could resolve.
    return null;
  }
}

/** Edit one document: the form on the left, the live preview and the verification tools on the right. */
export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Layouts do not re-render on client navigation, so the page proves the session itself.
  await requireAdminPage(adminDocumentRoute(id));
  if (!isDocumentId(id)) notFound();

  if (!isDatabaseConfigured()) {
    return (
      <>
        <PageHeader eyebrow="Documents" title="Edit document" />
        <DatabaseSetupNotice />
      </>
    );
  }

  let record: DocumentRecord | null;
  try {
    record = await getDocument(id);
  } catch {
    // The database is configured but did not answer. Say so calmly; the details stay in the server log.
    return (
      <>
        <PageHeader
          eyebrow="Documents"
          title="Edit document"
          actions={
            <ButtonLink href={ADMIN_ROUTES.documents} variant="ghost" size="sm">
              All documents
            </ButtonLink>
          }
        />
        <SetupNotice tone="error" title="The database did not answer.">
          This document could not be loaded. Reload the page in a moment.
        </SetupNotice>
      </>
    );
  }
  if (!record) notFound();

  const spec = CATEGORIES[record.category];
  const updated = formatDateTimeUtc(record.updatedAt);

  return (
    <>
      <PageHeader
        eyebrow={spec.label}
        title={record.title || "Untitled document"}
        lede={
          <>
            <StatusBadge status={record.status} /> <VisibilityBadge visibility={record.visibility} />
            {updated ? <> Updated {updated}.</> : null}
          </>
        }
        actions={
          <ButtonLink href={`${ADMIN_ROUTES.documents}?category=${spec.slug}`} variant="ghost" size="sm">
            All {spec.plural.toLowerCase()}
          </ButtonLink>
        }
      />
      <DocumentEditor
        key={record.id}
        mode="edit"
        category={record.category}
        record={record}
        maxUploadBytes={getMaxUploadBytes()}
        cancelHref={`${ADMIN_ROUTES.documents}?category=${spec.slug}`}
        aside={<VerificationPanel record={record} publicUrl={publicUrlFor(record.verificationCode)} />}
      />
    </>
  );
}
