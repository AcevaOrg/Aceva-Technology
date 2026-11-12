import Link from "next/link";
import { LogoMark } from "@/components/ui/icons";
import { ADMIN_ROUTES } from "@/lib/nav";
import s from "./admin.module.css";

interface AdminBrandProps {
  /**
   * The logo's gradient is referenced by id, so every instance on the page needs its own. The sidebar,
   * the mobile topbar and the drawer each pass a different suffix.
   */
  idSuffix: string;
  /** Called when the link is followed (the drawer uses it to close itself). */
  onNavigate?: () => void;
}

/** The ACEVA lockup with an "Admin console" sub-label, linking to the overview. */
export function AdminBrand({ idSuffix, onNavigate }: AdminBrandProps) {
  return (
    <Link href={ADMIN_ROUTES.root} className={s.brand} aria-label="ACEVA Admin console, overview" onClick={onNavigate}>
      <LogoMark id={`acevaStrokeAdmin-${idSuffix}`} />
      <span className={s.brandText}>
        <span className={s.brandName}>ACEVA</span>
        <span className={s.brandSub}>Admin console</span>
      </span>
    </Link>
  );
}
