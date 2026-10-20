import type { ActionItem } from "./action-items.types";
/**
 * Returns the current items.
 *
 * @param items The action items to filter.
 * @returns The current items.
 */
export function getActiveActionItems(items: ActionItem[]): ActionItem[] {
  return items;
}

/**
 * Returns the current items for one team.
 *
 * @param items The action items to filter.
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @returns The team's current items.
 */
export function getActiveActionItemsForTeam(
  items: ActionItem[],
  teamId: string,
): ActionItem[] {
  return getActiveActionItems(items).filter((item) => item.teamId === teamId);
}
