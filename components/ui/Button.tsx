import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRightIcon } from "./icons";

interface BaseProps {
  variant?: "primary" | "ghost";
  icon?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

interface LinkButtonProps extends BaseProps {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
}

interface ActionButtonProps extends BaseProps {
  href?: undefined;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

type ButtonProps = LinkButtonProps | ActionButtonProps;

export default function Button({ variant = "primary", icon = true, className, style, children, ...rest }: ButtonProps) {
  const cls = `${variant === "primary" ? "ac-btn-primary" : "ac-btn-ghost"}${className ? ` ${className}` : ""}`;
  const content = (
    <>
      {children}
      {icon && <ArrowRightIcon />}
    </>
  );

  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} className={cls} style={style}>
        {content}
      </Link>
    );
  }

  const { onClick, type = "button", disabled } = rest as ActionButtonProps;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={style}>
      {content}
    </button>
  );
}
