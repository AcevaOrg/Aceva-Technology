import { ButtonLink, CATEGORY_ICONS } from "@/components/admin";
import { CATEGORY_LIST } from "@/lib/documents/categories";
import { ADMIN_ROUTES } from "@/lib/nav";
import s from "./pages.module.css";

/** One button per category, each straight into the editor for that kind of document. */
export function QuickAdd() {
  return (
    <div>
      <p className={s.quickLead}>Start a new record in the right section. Everything begins as a draft and stays private until you publish it.</p>
      <div className={s.quick}>
        {CATEGORY_LIST.map((spec) => {
          const Icon = CATEGORY_ICONS[spec.key];
          return (
            <ButtonLink
              key={spec.key}
              href={`${ADMIN_ROUTES.newDocument}?category=${spec.slug}`}
              variant="ghost"
              size="sm"
              iconLeading={<Icon width={18} height={18} />}
            >
              {spec.label}
            </ButtonLink>
          );
        })}
      </div>
    </div>
  );
}
