import type { MetadataRoute } from "next";
import { ROUTES } from "@/lib/nav";
import { CAPS } from "@/lib/data/caps";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://acevatech.com";

const STATIC_ROUTES: Array<{ path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }> = [
  { path: ROUTES.home, changeFrequency: "weekly", priority: 1 },
  { path: ROUTES.services, changeFrequency: "monthly", priority: 0.8 },
  { path: ROUTES.work, changeFrequency: "monthly", priority: 0.6 },
  { path: ROUTES.process, changeFrequency: "monthly", priority: 0.6 },
  { path: ROUTES.about, changeFrequency: "monthly", priority: 0.6 },
  { path: ROUTES.company, changeFrequency: "monthly", priority: 0.6 },
  { path: ROUTES.technology, changeFrequency: "monthly", priority: 0.5 },
  { path: ROUTES.industries, changeFrequency: "monthly", priority: 0.5 },
  { path: ROUTES.testimonials, changeFrequency: "monthly", priority: 0.4 },
  { path: ROUTES.careers, changeFrequency: "monthly", priority: 0.4 },
  { path: ROUTES.insights, changeFrequency: "weekly", priority: 0.5 },
  { path: ROUTES.faq, changeFrequency: "monthly", priority: 0.4 },
  { path: ROUTES.contact, changeFrequency: "monthly", priority: 0.9 },
  { path: ROUTES.privacy, changeFrequency: "yearly", priority: 0.3 },
  { path: ROUTES.terms, changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const capabilityEntries: MetadataRoute.Sitemap = CAPS.map((cap) => ({
    url: `${SITE_URL}/services/${cap.key}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...capabilityEntries];
}
