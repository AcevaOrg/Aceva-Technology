import type { Metadata } from "next";
import { LEGAL } from "@/lib/data/legal";
import LegalPage from "@/components/features/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — ACEVA Technology",
  description: "The terms governing use of this website and the relationship between Aceva and a client.",
};

export default function TermsOfServicePage() {
  return <LegalPage doc={LEGAL.terms} />;
}
