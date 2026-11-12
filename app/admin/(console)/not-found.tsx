import s from "@/components/admin/admin.module.css";
import { ButtonLink } from "@/components/admin/Button";
import { ArrowRightIcon } from "@/components/admin/icons";
import { RisingWords } from "@/components/admin/RisingWords";
import { SlashStage } from "@/components/admin/SlashStage";
import { ADMIN_ROUTES } from "@/lib/nav";

/** Rendered when a console page calls notFound(): a missing or deleted record, or a stale link. */
export default function ConsoleNotFound() {
  return (
    <SlashStage size="inline">
      <p className={s.eyebrow}>
        <i className={s.slash} aria-hidden="true" />
        <b>404</b>
      </p>
      <h1 className={s.stageTitle}>
        <RisingWords text="Nothing here." accentLast={1} />
      </h1>
      <p className={s.lede}>That record does not exist any more, or the link is out of date. It may have been deleted.</p>
      <div className={s.stageActions}>
        <ButtonLink href={ADMIN_ROUTES.documents} iconTrailing={<ArrowRightIcon />}>
          All documents
        </ButtonLink>
        <ButtonLink href={ADMIN_ROUTES.root} variant="ghost">
          Back to overview
        </ButtonLink>
      </div>
    </SlashStage>
  );
}
