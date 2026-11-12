import type { Metadata } from "next";
import { ButtonLink } from "@/components/admin/Button";
import { CategoryPicker } from "@/components/admin/editor/CategoryPicker";
import { DocumentEditor } from "@/components/admin/editor/DocumentEditor";
import { resolveCategoryParam } from "@/components/admin/editor/editorModel";
import { DatabaseSetupNotice, SetupNotice } from "@/components/admin/editor/SetupNotice";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdminPage } from "@/lib/admin/auth";
import { getMaxUploadBytes } from "@/lib/admin/config";
import { isDatabaseConfigured } from "@/lib/db";
import { ADMIN_ROUTES } from "@/lib/nav";

// Depends on the session and on the query string; `next build` must never need either.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New document" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Create a document. Step one is choosing a category (one card per category, linking to `?category=<slug>`);
 * with a valid category the editor opens in create mode, rendered entirely from that category's spec.
 */
export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requested = firstValue(query.category);
  const spec = resolveCategoryParam(requested);

  // Layouts do not re-render on client navigation, so the page proves the session itself.
  await requireAdminPage(spec ? `${ADMIN_ROUTES.newDocument}?category=${spec.slug}` : ADMIN_ROUTES.newDocument);

  const databaseReady = isDatabaseConfigured();

  return (
    <>
      <PageHeader
        eyebrow="New document"
        title={spec ? spec.label : "What are you adding?"}
        lede={spec ? spec.adminHelp : "Each kind has its own fields, checks and privacy rules. Pick one to start."}
        actions={
          <>
            {spec ? (
              <ButtonLink href={ADMIN_ROUTES.newDocument} variant="ghost" size="sm">
                Change category
              </ButtonLink>
            ) : null}
            <ButtonLink href={spec ? `${ADMIN_ROUTES.documents}?category=${spec.slug}` : ADMIN_ROUTES.documents} variant="quiet" size="sm">
              All documents
            </ButtonLink>
          </>
        }
      />

      {!databaseReady ? <DatabaseSetupNotice /> : null}

      {spec ? (
        <DocumentEditor
          key={spec.key}
          mode="create"
          category={spec.key}
          maxUploadBytes={getMaxUploadBytes()}
          cancelHref={`${ADMIN_ROUTES.documents}?category=${spec.slug}`}
        />
      ) : (
        <>
          {requested ? (
            <SetupNotice title="That category does not exist.">Choose one of the categories below.</SetupNotice>
          ) : null}
          <CategoryPicker />
        </>
      )}
    </>
  );
}
