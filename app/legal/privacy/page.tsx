import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { LEGAL } from "@/lib/data/legal";
import LegalPage from "@/components/features/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy — ACEVA Technology",
  description: "How Aceva collects, uses and protects personal information through this website and client engagements.",
});

export default function PrivacyPolicyPage() {
  return <LegalPage doc={LEGAL.privacy} />;
}
