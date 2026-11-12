import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import s from "./admin.module.css";
import { ExternalIcon } from "./icons";
import { Spinner } from "./Spinner";
import { cx } from "./utils";

export type ButtonVariant = "primary" | "ghost" | "danger" | "quiet";
export type ButtonSize = "md" | "sm";

interface ButtonLook {
  /** primary = brand blue pill, ghost = hairline outline, danger = destructive, quiet = text-only. */
  variant?: ButtonVariant;
  /** md is 48px tall, sm is 44px (the touch-target floor). */
  size?: ButtonSize;
  /** The slash-shine sweep on hover. On by default for primary and ghost. */
  shine?: boolean;
  /** Fill the container width (forms, dialogs on phones). */
  block?: boolean;
  /** Icon before the label. Replaced by a spinner while `loading`. */
  iconLeading?: ReactNode;
  /** Icon after the label; nudges right on hover. */
  iconTrailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: s.btnPrimary,
  ghost: s.btnGhost,
  danger: s.btnDanger,
  quiet: s.btnQuiet,
};

function buttonClass({ variant = "primary", size = "md", shine, block, className }: Omit<ButtonLook, "children">): string {
  const shineOn = shine ?? (variant === "primary" || variant === "ghost");
  return cx(s.btn, VARIANT_CLASS[variant], size === "sm" && s.btnSm, shineOn && s.btnShine, block && s.btnBlock, className);
}

function ButtonContent({
  iconLeading,
  iconTrailing,
  loading,
  children,
}: Pick<ButtonLook, "iconLeading" | "iconTrailing" | "children"> & { loading?: boolean }) {
  return (
    <>
      {loading ? (
        <span className={s.btnIcon}>
          <Spinner size={18} />
        </span>
      ) : iconLeading ? (
        <span className={s.btnIcon} aria-hidden="true">
          {iconLeading}
        </span>
      ) : null}
      <span className={s.btnLabel}>{children}</span>
      {iconTrailing ? (
        <span className={s.btnIcon} data-trailing="" aria-hidden="true">
          {iconTrailing}
        </span>
      ) : null}
    </>
  );
}

export type ButtonProps = ButtonLook &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    /** Shows a spinner and disables the button, so a slow save cannot be submitted twice. */
    loading?: boolean;
    ref?: Ref<HTMLButtonElement>;
  };

/** A pill button. `type` defaults to "button" so it never submits a form by accident. */
export function Button({
  variant,
  size,
  shine,
  block,
  iconLeading,
  iconTrailing,
  className,
  loading,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, shine, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <ButtonContent iconLeading={iconLeading} iconTrailing={iconTrailing} loading={loading}>
        {children}
      </ButtonContent>
    </button>
  );
}

export type ButtonLinkProps = ButtonLook &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
    /** Opens in a new tab with `noopener noreferrer` and an external-link glyph. */
    external?: boolean;
  };

/** A pill-styled link: client-side navigation for in-app hrefs, a plain anchor for external ones. */
export function ButtonLink({
  href,
  external,
  variant,
  size,
  shine,
  block,
  iconLeading,
  iconTrailing,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const classes = buttonClass({ variant, size, shine, block, className });
  const content = (
    <ButtonContent iconLeading={iconLeading} iconTrailing={iconTrailing ?? (external ? <ExternalIcon /> : undefined)}>
      {children}
    </ButtonContent>
  );

  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer" {...rest}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes} {...rest}>
      {content}
    </Link>
  );
}
