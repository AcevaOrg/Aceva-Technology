import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/nav";
import { LEGAL } from "@/lib/data/legal";
import LegalPage from "@/components/features/LegalPage";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: "How Aceva collects, uses and protects personal information through this website and client engagements.",
  path: ROUTES.privacy,
});

export default function PrivacyPolicyPage() {
  return <LegalPage doc={LEGAL.privacy} />;
}
