"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { CATEGORY_LIST } from "@/lib/documents/categories";
import { ADMIN_ROUTES, ROUTES } from "@/lib/nav";
import s from "./admin.module.css";
import {
  CATEGORY_ICONS,
  ChevronDownIcon,
  ClockIcon,
  DocumentsIcon,
  ExternalIcon,
  GridIcon,
  LockIcon,
  QrIcon,
  type AdminIcon,
} from "./icons";
import { SignOutButton } from "./SignOutButton";

interface AdminNavProps {
  /** Landmark name. The sidebar and the drawer each render a nav, so they must be told apart. */
  label?: string;
  /** Called when any link is followed (the drawer closes itself). */
  onNavigate?: () => void;
}

interface SimpleItem {
  href: string;
  label: string;
  Icon: AdminIcon;
}

const BEFORE_DOCUMENTS: SimpleItem[] = [{ href: ADMIN_ROUTES.root, label: "Overview", Icon: GridIcon }];
const AFTER_DOCUMENTS: SimpleItem[] = [
  { href: ADMIN_ROUTES.verification, label: "Verification", Icon: QrIcon },
  { href: ADMIN_ROUTES.activity, label: "Activity", Icon: ClockIcon },
  { href: ADMIN_ROUTES.settings, label: "Settings", Icon: LockIcon },
];

function isWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavList({ category, label, onNavigate }: AdminNavProps & { category: string | null }) {
  const pathname = usePathname();
  const groupId = useId();
  const inDocuments = isWithin(pathname, ADMIN_ROUTES.documents);

  // The category group follows the route until the person toggles it by hand; entering or leaving the
  // Documents section hands control back to the route. (State adjusted during render, not in an effect.)
  const [manual, setManual] = useState<boolean | null>(null);
  const [wasInDocuments, setWasInDocuments] = useState(inDocuments);
  if (wasInDocuments !== inDocuments) {
    setWasInDocuments(inDocuments);
    setManual(null);
  }
  const groupOpen = manual ?? inDocuments;

  const activeCategory = inDocuments && category ? (CATEGORY_LIST.find((spec) => spec.slug === category) ?? null) : null;
  const documentsCurrent = !inDocuments ? undefined : pathname === ADMIN_ROUTES.documents && !activeCategory ? "page" : "true";

  function renderSimple(item: SimpleItem) {
    const active = item.href === ADMIN_ROUTES.root ? pathname === item.href : isWithin(pathname, item.href);
    return (
      <li key={item.href}>
        <Link href={item.href} className={s.navItem} aria-current={active ? "page" : undefined} onClick={onNavigate}>
          <item.Icon className={s.navIcon} />
          <span className={s.navLabel}>{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <nav className={s.nav} aria-label={label ?? "Admin"}>
      <ul className={s.navList}>
        {BEFORE_DOCUMENTS.map(renderSimple)}

        <li>
          <div className={s.navRow}>
            <Link href={ADMIN_ROUTES.documents} className={s.navItem} aria-current={documentsCurrent} onClick={onNavigate}>
              <DocumentsIcon className={s.navIcon} />
              <span className={s.navLabel}>Documents</span>
            </Link>
            <button
              type="button"
              className={s.navToggle}
              aria-expanded={groupOpen}
              aria-controls={groupId}
              aria-label={groupOpen ? "Hide document categories" : "Show document categories"}
              onClick={() => setManual(!groupOpen)}
            >
              <ChevronDownIcon width={16} height={16} />
            </button>
          </div>
          <div id={groupId} className={s.navSub} data-open={groupOpen ? "" : undefined}>
            {/* inert keeps a collapsed group's links out of the tab order and the accessibility tree */}
            <ul className={s.navSubInner} inert={!groupOpen}>
              {CATEGORY_LIST.map((spec) => {
                const Icon = CATEGORY_ICONS[spec.key];
                return (
                  <li key={spec.key}>
                    <Link
                      href={`${ADMIN_ROUTES.documents}?category=${spec.slug}`}
                      className={s.navItem}
                      aria-current={activeCategory?.key === spec.key ? "page" : undefined}
                      onClick={onNavigate}
                    >
                      <Icon className={s.navIcon} />
                      <span className={s.navLabel}>{spec.plural}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </li>

        {AFTER_DOCUMENTS.map(renderSimple)}
      </ul>

      <ul className={s.navFoot}>
        <li>
          <a href={ROUTES.home} className={s.navItem} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
            <ExternalIcon className={s.navIcon} />
            <span className={s.navLabel}>View site</span>
            <span className={s.srOnly}>(opens in a new tab)</span>
          </a>
        </li>
        <li>
          <SignOutButton />
        </li>
      </ul>
    </nav>
  );
}

/** Reads the `category` query value. Split out so it can sit behind a Suspense boundary. */
function NavWithCategory(props: AdminNavProps) {
  const category = useSearchParams().get("category");
  return <NavList {...props} category={category} />;
}

/**
 * The console's navigation landmark: Overview, Documents (expanding to the five categories, each linking
 * to /admin/documents?category=<slug>), Verification, Activity and Settings, then View site and Sign out.
 * The current page carries aria-current="page"; a parent of the current page carries aria-current="true".
 */
export function AdminNav(props: AdminNavProps) {
  // useSearchParams needs a Suspense boundary; the fallback is the same nav without a highlighted category.
  return (
    <Suspense fallback={<NavList {...props} category={null} />}>
      <NavWithCategory {...props} />
    </Suspense>
  );
}
