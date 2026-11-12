"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import s from "./admin.module.css";
import { AdminBrand } from "./AdminBrand";
import { AdminNav } from "./AdminNav";
import { useModalBehaviour } from "./hooks";
import { CloseIcon, MenuIcon } from "./icons";
import { IconButton } from "./IconButton";
import { SessionClock } from "./SessionClock";

interface AdminTopbarProps {
  /** Session end, epoch milliseconds. Omit to hide the session chip. */
  expiresAt?: number;
}

/**
 * The sticky bar above every console page, and (under 900px) the menu button and drawer that replace the
 * sidebar. The drawer behaves like the marketing site's: focus moves in and is trapped, Escape and the
 * scrim close it, the page behind stops scrolling and focus returns to the menu button.
 */
export function AdminTopbar({ expiresAt }: AdminTopbarProps) {
  const pathname = usePathname();
  const drawerId = useId();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Following a link closes the drawer without pulling focus back to the menu button: the new page owns focus.
  const followedLink = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const closeAfterNavigating = useCallback(() => {
    followedLink.current = true;
    setOpen(false);
  }, []);

  // Navigating by any other route (browser back, a link in the page) also closes the drawer.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Growing the window past the breakpoint hides the drawer with CSS; release the scroll lock with it.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const onChange = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useModalBehaviour({
    active: open,
    containerRef: drawerRef,
    onEscape: close,
    initialFocus: () => closeRef.current,
    returnFocus: () => {
      const skip = followedLink.current;
      followedLink.current = false;
      return skip ? null : menuRef.current;
    },
  });

  return (
    <>
      <div className={s.topbar}>
        <IconButton ref={menuRef} className={s.menuBtn} label="Open menu" aria-expanded={open} aria-controls={drawerId} onClick={() => setOpen(true)}>
          <MenuIcon />
        </IconButton>
        <div className={s.topBrand}>
          <AdminBrand idSuffix="topbar" />
        </div>
        <p className={s.topLabel}>
          <i className={s.slash} aria-hidden="true" />
          Internal console
        </p>
        {expiresAt ? <SessionClock expiresAt={expiresAt} /> : null}
      </div>

      <div className={s.drawerScrim} data-open={open ? "" : undefined} onClick={close} aria-hidden="true" />
      {/* Kept mounted so it can animate out as well as in; `inert` removes it from the tab order and accessibility tree while closed. */}
      <div
        id={drawerId}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Console menu"
        data-open={open ? "" : undefined}
        inert={!open}
        className={s.drawer}
      >
        <div className={s.drawerHead}>
          <AdminBrand idSuffix="drawer" onNavigate={closeAfterNavigating} />
          <IconButton ref={closeRef} label="Close menu" onClick={close}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className={s.drawerBody}>
          <AdminNav label="Admin menu" onNavigate={closeAfterNavigating} />
        </div>
      </div>
    </>
  );
}
