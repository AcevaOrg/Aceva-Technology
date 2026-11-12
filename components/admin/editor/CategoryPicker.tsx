import Link from "next/link";
import { CATEGORY_LIST } from "@/lib/documents/categories";
import { VISIBILITY_LABELS, type CategorySpec } from "@/lib/documents/types";
import { ADMIN_ROUTES } from "@/lib/nav";
import ui from "../admin.module.css";
import { ArrowRightIcon, CATEGORY_ICONS } from "../icons";
import { cx } from "../utils";
import ed from "./editor.module.css";

/** One plain sentence on what verification a category gets, read from its spec. */
export function verificationLine(spec: CategorySpec): string {
  return spec.verifiable ? "QR verification built in" : "No QR verification";
}

/** One plain sentence on who sees a category by default. */
export function startsAsLine(spec: CategorySpec): string {
  const label = VISIBILITY_LABELS[spec.defaultVisibility].label;
  return spec.personal ? `Personal data. Starts ${label.toLowerCase()}.` : `Starts ${label.toLowerCase()}.`;
}

/**
 * Step one of creating a document: a card per category. Each is a plain link to
 * `?category=<slug>`, so the choice is a URL (back button, bookmarkable) and the picker needs no
 * JavaScript. What a card says comes from the category spec, not from copy written here.
 */
export function CategoryPicker() {
  return (
    <ul className={cx(ed.pickerGrid, ui.stagger)} aria-label="Document categories">
      {CATEGORY_LIST.map((spec) => {
        const Icon = CATEGORY_ICONS[spec.key];
        return (
          <li key={spec.key}>
            <Link href={`${ADMIN_ROUTES.newDocument}?category=${spec.slug}`} className={ed.pick}>
              <span className={ed.pickIcon} aria-hidden="true">
                <Icon width={22} height={22} />
              </span>
              <span className={ed.pickBody}>
                <span className={ed.pickLabel}>{spec.label}</span>
                <span className={ed.pickBlurb}>{spec.adminHelp}</span>
              </span>
              <span className={ed.pickMeta}>
                <span>{verificationLine(spec)}</span>
                <span>{startsAsLine(spec)}</span>
              </span>
              <span className={ed.pickGo} aria-hidden="true">
                <ArrowRightIcon width={18} height={18} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
