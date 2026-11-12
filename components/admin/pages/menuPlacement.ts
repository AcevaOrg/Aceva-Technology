/**
 * Where to put the row-actions popover. Pure geometry: the component feeds it the trigger's rectangle
 * and the viewport size, and gets back inline style values. Nothing is measured after render, so the
 * menu never flashes in the wrong place first.
 */

export const MENU_WIDTH = 264;
export const MENU_ITEM_HEIGHT = 44;
const MENU_PADDING = 12; // 6px top and bottom
const MENU_BORDER = 2;
const SEPARATOR_HEIGHT = 13; // 1px rule and 6px margins
const GAP = 6;
const EDGE = 8;
const MIN_HEIGHT = 160;

export interface MenuPlacement {
  left: number;
  /** Set when the menu opens downwards from the trigger. */
  top?: number;
  /** Set when it opens upwards: anchored to the viewport's bottom so its height need not be known. */
  bottom?: number;
  maxHeight: number;
  above: boolean;
}

export interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function estimateMenuHeight(itemCount: number, groupCount: number): number {
  const separators = Math.max(0, groupCount - 1);
  return itemCount * MENU_ITEM_HEIGHT + separators * SEPARATOR_HEIGHT + MENU_PADDING + MENU_BORDER;
}

/**
 * Right-aligned to the trigger, clamped inside the viewport. Opens downwards when it fits, upwards when
 * there is more room above, and otherwise downwards with a scrollable height.
 */
export function placeMenu(
  trigger: Rect,
  viewport: { width: number; height: number },
  itemCount: number,
  groupCount: number,
): MenuPlacement {
  const width = Math.min(MENU_WIDTH, Math.max(0, viewport.width - EDGE * 2));
  const left = Math.max(EDGE, Math.min(trigger.right - width, viewport.width - width - EDGE));

  const needed = estimateMenuHeight(itemCount, groupCount);
  const spaceBelow = viewport.height - trigger.bottom - GAP - EDGE;
  const spaceAbove = trigger.top - GAP - EDGE;

  if (needed <= spaceBelow || spaceBelow >= spaceAbove) {
    return {
      left,
      top: Math.round(trigger.bottom + GAP),
      maxHeight: Math.max(MIN_HEIGHT, Math.floor(spaceBelow)),
      above: false,
    };
  }
  return {
    left,
    bottom: Math.round(viewport.height - trigger.top + GAP),
    maxHeight: Math.max(MIN_HEIGHT, Math.floor(spaceAbove)),
    above: true,
  };
}
