"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/components/admin/hooks";
import { IconButton } from "@/components/admin/IconButton";
import { placeMenu, type MenuPlacement } from "./menuPlacement";
import s from "./pages.module.css";

/**
 * A popover menu opened from a three-dot button, following the WAI-ARIA menu-button pattern: the
 * button is `aria-haspopup="menu"`, focus moves into the menu on open, arrow keys / Home / End move
 * between items, Escape closes and returns focus to the button, and Tab closes it.
 *
 * The menu is portalled into the admin root and positioned with `position: fixed`, so a ledger row's
 * stacking context or overflow can never clip it or let the row beneath paint over it. It closes on
 * an outside click, on resize and when the page scrolls, because a fixed menu would otherwise drift
 * away from its button.
 */

export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  tone?: "danger";
  /** A link item. Without it the item is a button that calls `onSelect`. */
  href?: string;
  /** Open the link in a new tab (an off-console page). */
  newTab?: boolean;
  /** Download the link instead of navigating (QR images). */
  download?: boolean;
  onSelect?: () => void;
}

interface ActionMenuProps {
  /** Names the button and the menu: "Actions for Certificate of Incorporation". */
  label: string;
  groups: MenuItem[][];
  disabled?: boolean;
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="5.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="18.5" r="1.7" />
    </svg>
  );
}

export function ActionMenu({ label, groups, disabled }: ActionMenuProps) {
  const mounted = useMounted();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);
  const open = placement !== null;

  const visibleGroups = groups.filter((group) => group.length > 0);
  const itemCount = visibleGroups.reduce((sum, group) => sum + group.length, 0);

  function close(returnFocus: boolean) {
    setPlacement(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  function openMenu() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPlacement(placeMenu(trigger.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, itemCount, visibleGroups.length));
  }

  // Dismissal that depends on the page outside the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setPlacement(null);
    };
    const onScroll = (event: Event) => {
      // Scrolling inside a tall menu is fine; scrolling the page would leave it floating.
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      setPlacement(null);
    };
    const onResize = () => setPlacement(null);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Focus lands on the first item as soon as the menu exists.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [open]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown":
        focusAt(index + 1);
        break;
      case "ArrowUp":
        focusAt(index <= 0 ? items.length - 1 : index - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        close(true);
        break;
      case "Tab":
        // The menu is portalled to the end of the document, so letting Tab run would strand focus there.
        event.preventDefault();
        close(true);
        break;
      default:
    }
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openMenu();
    }
  }

  function renderItem(item: MenuItem) {
    const content = (
      <>
        <span className={s.menuIcon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={s.menuLabel}>{item.label}</span>
      </>
    );
    const common = { role: "menuitem", tabIndex: -1, className: s.menuItem, "data-tone": item.tone } as const;

    if (item.href && item.newTab) {
      return (
        <a key={item.id} {...common} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => close(false)}>
          {content}
        </a>
      );
    }
    if (item.href && item.download) {
      // A plain anchor: a download must not be intercepted by the client router.
      return (
        <a key={item.id} {...common} href={item.href} download onClick={() => close(true)}>
          {content}
        </a>
      );
    }
    if (item.href) {
      return (
        <Link key={item.id} {...common} href={item.href} prefetch={false} onClick={() => close(false)}>
          {content}
        </Link>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        {...common}
        onClick={() => {
          // Focus goes back to the button first so a confirmation dialog hands it back there when it closes.
          close(true);
          item.onSelect?.();
        }}
      >
        {content}
      </button>
    );
  }

  const host = mounted ? (document.querySelector<HTMLElement>("[data-admin-root]") ?? document.body) : null;

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <DotsIcon />
      </IconButton>
      {open && host && placement
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              className={s.menu}
              data-above={placement.above ? "" : undefined}
              style={{ left: placement.left, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight }}
              onKeyDown={onMenuKeyDown}
            >
              {visibleGroups.map((group, index) => (
                <div key={group[0]?.id ?? index} role="none">
                  {index > 0 ? <hr className={s.menuSep} /> : null}
                  {group.map(renderItem)}
                </div>
              ))}
            </div>,
            host,
          )
        : null}
    </>
  );
}
