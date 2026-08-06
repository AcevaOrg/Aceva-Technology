import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRightIcon } from "./icons";

interface ArrowLinkProps {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function ArrowLink({ href, onClick, children, style, className }: ArrowLinkProps) {
  const cls = `ac-link${className ? ` ${className}` : ""}`;
  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {children}
        <ArrowRightIcon />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
      <ArrowRightIcon />
    </button>
  );
}
