import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import s from "./admin.module.css";
import { cx } from "./utils";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label"> & {
  /** Required: an icon alone has no accessible name. Also used as the hover tooltip. */
  label: string;
  /** The icon, usually one from ./icons. */
  children: ReactNode;
  /** danger tints the icon red and the hover state with it. */
  tone?: "default" | "danger";
  /** Toggle state (show/hide, favourite). Sets aria-pressed and the accent colour. */
  pressed?: boolean;
  /** Drop the hairline ring until hover (dense rows, inside inputs). */
  bare?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
};

/** A 44px round icon button. Always give it a `label`. */
export function IconButton({ label, children, tone = "default", pressed, bare, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(s.iconBtn, className)}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      data-tone={tone === "danger" ? "danger" : undefined}
      data-bare={bare ? "" : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
