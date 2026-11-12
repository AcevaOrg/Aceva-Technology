import { PageLoading } from "@/components/admin/pages/PageLoading";

/** A list-shaped skeleton: headline, the filter rows, then ruled rows. Streams in while the list loads. */
export default function DocumentsLoading() {
  return <PageLoading filters rows={7} label="Loading documents" />;
}
