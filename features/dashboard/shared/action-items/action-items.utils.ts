import type { ActionItem } from "./action-items.types";

/** Items undetected for this long are flagged as "no longer detected". */
export const ACTION_ITEM_STALE_AFTER_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ACTIVE_STATUSES = new Set(["OPEN", "ACKNOWLEDGED"]);

/**
 * Returns the items that still require follow-up.
 *
 * @param items The action items to filter.
 * @returns The open and acknowledged items.
 */
export function getActiveActionItems(items: ActionItem[]): ActionItem[] {
  return items.filter((item) => ACTIVE_STATUSES.has(item.status));
}

/**
 * Returns the active items for one team.
 *
 * @param items The action items to filter.
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @returns The team's active items.
 */
export function getActiveActionItemsForTeam(
  items: ActionItem[],
  teamId: string,
): ActionItem[] {
  return getActiveActionItems(items).filter((item) => item.teamId === teamId);
}

/**
 * Whether the rule behind an item stopped firing recently, meaning the item is
 * probably fixed and only needs confirmation.
 *
 * @param item The action item to check.
 * @param now Optional anchor time for testing.
 * @returns True when the item has not been detected recently.
 */
export function isStaleActionItem(
  item: ActionItem,
  now: Date = new Date(),
): boolean {
  const lastDetectedAt = new Date(item.lastDetectedAt);

  return (
    now.getTime() - lastDetectedAt.getTime() >=
    ACTION_ITEM_STALE_AFTER_DAYS * MS_PER_DAY
  );
}
