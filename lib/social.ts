/**
 * Every public contact channel for ACEVA — email, phone and social profiles.
 *
 * This is the single source of truth. `app/layout.tsx` derives the JSON-LD `sameAs`
 * array from it, the footer and contact page render it directly, and the API routes
 * fall back to it, so the SEO signal, the visible UI and the server can never drift
 * apart. Change an address here and it changes everywhere.
 *
 * These are external values, which is why they do not live in `lib/nav.ts` — that
 * file holds internal paths consumed by `next/link`.
 */

/**
 * Where enquiries go. Server routes prefer the CONTACT_TO_EMAIL env var and use this
 * only as a fallback, so production can be redirected without a deploy.
 */
export const CONTACT_EMAIL = "acevatech.official@gmail.com";

export interface SocialLink {
  key: string;
  /** Accessible name for the link; the icon inside it is aria-hidden. */
  label: string;
  href: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    key: "linkedin",
    label: "ACEVA Technology on LinkedIn",
    // Public company page. Do NOT use the /admin/dashboard/ URL — that is the private
    // management view, it is not crawlable, and Google cannot verify it as this entity.
    href: "https://www.linkedin.com/company/143570032/",
  },
  {
    key: "instagram",
    label: "ACEVA Technology on Instagram",
    href: "https://www.instagram.com/acevatechnology",
  },
  {
    key: "facebook",
    label: "ACEVA Technology on Facebook",
    href: "https://www.facebook.com/share/1DJXzSK13W/",
  },
  {
    key: "x",
    label: "ACEVA Technology on X",
    href: "https://x.com/AcevaTechnology",
  },
];

/** Used for the twitter:site and twitter:creator card tags. */
export const X_HANDLE = "@AcevaTechnology";

/**
 * Reception / help line. `e164` is the machine form used by tel: links and by the
 * Organization schema; `display` is the spaced form shown to people.
 */
export const CONTACT_PHONE = {
  e164: "+923055552230",
  display: "+92 305 555 2230",
  whatsapp: "https://wa.me/923055552230",
} as const;
