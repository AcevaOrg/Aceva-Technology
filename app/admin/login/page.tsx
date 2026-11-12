import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import s from "@/components/admin/admin.module.css";
import { RisingWords } from "@/components/admin/RisingWords";
import { SlashStage } from "@/components/admin/SlashStage";
import { LogoMark } from "@/components/ui/icons";
import { isAdminEnabled, isAdminRequestHostAllowed } from "@/lib/admin/config";
import { getAdminSession, sanitizeNextPath } from "@/lib/admin/auth";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

// Whether the console exists depends on environment variables read at request time. Without this, a build made
// without ADMIN_PASSKEY would prerender the "does not exist" 404 for this page and keep serving it after the key is set.
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // With no usable pass key configured, or on a host the console is not allowed on, it must look like it does not exist at all.
  if (!isAdminEnabled() || !isAdminRequestHostAllowed(await headers())) notFound();

  const params = await searchParams;
  const requested = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = sanitizeNextPath(requested);

  if (await getAdminSession()) redirect(next);

  return (
    <SlashStage
      top={
        <div className={s.brand}>
          <LogoMark id="acevaStrokeAdminLogin" />
          <span className={s.brandText}>
            <span className={s.brandName}>ACEVA</span>
            <span className={s.brandSub}>Admin console</span>
          </span>
        </div>
      }
      foot="Authorised ACEVA staff only. Sessions end automatically after a few hours."
    >
      <p className={s.eyebrow}>
        <i className={s.slash} aria-hidden="true" />
        <b>Restricted</b>
      </p>
      <h1 className={s.stageTitle}>
        <RisingWords text="Internal console." accentLast={1} />
      </h1>
      <p className={s.lede}>Enter the pass key to manage ACEVA&apos;s documents and verification codes.</p>
      <LoginForm next={next} />
    </SlashStage>
  );
}
