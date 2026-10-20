import type { ActionItem, ActionItemsResponse } from "../action-items.types";

/**
 * Fetches the action items visible to the current session, synced against the
 * latest team reports.
 *
 * @returns The action items for the caller's scope.
 */
export async function fetchActionItems(): Promise<ActionItem[]> {
  const response = await fetch("/api/action-items", { cache: "no-store" });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to fetch action items.");
  }

  const data = (await response.json()) as ActionItemsResponse;
  return data.items;
}
