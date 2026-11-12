import type { Metadata } from "next";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/documents/access";
import { ROUTES } from "@/lib/nav";
import { pageMetadata } from "@/lib/seo";
import VerifyResult from "@/components/documents/VerifyResult";
import { runVerifyLookup } from "@/components/documents/verifyLookup";

// A verdict is only worth anything if it is fresh: never prerendered, never cached.
export const dynamic = "force-dynamic";

/**
 * One title for every outcome, so a shared link, a browser history entry or a search snippet says
 * nothing about whether a code exists. The canonical points at the bare form, not at the code.
 */
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Verification Result",
    description: "The result of checking a verification code against the ACEVA Technology registry.",
    path: ROUTES.verify,
    noIndex: true,
  }),
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    nocache: true,
    googleBot: { index: false, follow: false, noarchive: true, nosnippet: true },
  },
};

/** Route params are already decoded, but a double-encoded value from a pasted link is repaired once. */
function readCode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A malformed code renders the same friendly "could not verify" page as an unknown one, with a 200
 * and noindex, rather than calling notFound(): that page keeps the verdict seal, the form link and
 * the report button, and a 404 here would only distinguish "badly typed" from "well typed", which
 * helps no one.
 */
export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const requestHeaders = await headers();
  const rawCode = readCode(code).slice(0, 80);
  const outcome = await runVerifyLookup(rawCode, clientIpFromHeaders(requestHeaders));
  return <VerifyResult rawCode={rawCode} outcome={outcome} />;
}
