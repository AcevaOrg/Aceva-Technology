import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normalizeVerificationCode } from "@/lib/documents/codes";
import { ROUTES, verifyRoute } from "@/lib/nav";
import { pageMetadata } from "@/lib/seo";
import { MAX_CODE_INPUT } from "@/components/documents/codeInput";
import VerifyLanding from "@/components/documents/VerifyLanding";

export const metadata: Metadata = pageMetadata({
  title: "Verify a Document",
  description: "Check a certificate, team profile or experience letter issued by ACEVA Technology by entering its verification code or scanning its QR code.",
  path: ROUTES.verify,
  noIndex: true,
});

const UNREADABLE_CODE =
  "That is not a full verification code yet. It starts with ACV and has 12 more letters and numbers.";

/**
 * The form posts here as a plain GET (?code=…) when JavaScript is unavailable, and the same URL works
 * as a link in an email. A readable code goes straight to its result page; anything else comes back
 * to the form with a message, never an error page.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const { code } = await searchParams;
  const raw = (Array.isArray(code) ? code[0] : code)?.slice(0, MAX_CODE_INPUT);

  if (raw) {
    const canonical = normalizeVerificationCode(raw);
    if (canonical) redirect(verifyRoute(canonical));
    return <VerifyLanding initialCode={raw} initialError={UNREADABLE_CODE} />;
  }
  return <VerifyLanding />;
}
