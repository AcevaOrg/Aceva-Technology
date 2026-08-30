import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import { LEGAL } from "@/lib/data/legal";
import LegalPage from "@/components/features/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description: "The terms governing use of this website and the relationship between Aceva and a client.",
  path: ROUTES.terms,
});

export default function TermsOfServicePage() {
  return <LegalPage doc={LEGAL.terms} />;
}
