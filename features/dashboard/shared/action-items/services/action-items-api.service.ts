import type {
  ActionItem,
  ActionItemsResponse,
  ActionItemReviewStatus,
  ReviewActionItemResponse,
} from "../action-items.types";

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

/**
 * Applies a review transition (acknowledge / resolve / dismiss) to an item.
 *
 * @param teamId The team document id that owns the item (e.g. `WEB_CORE`).
 * @param id The action item id (the rule key).
 * @param status The status to apply.
 * @param note Optional resolution or dismissal note.
 * @returns The updated action item.
 */
export async function reviewActionItem(
  teamId: string,
  id: string,
  status: ActionItemReviewStatus,
  note?: string,
): Promise<ActionItem> {
  const response = await fetch(
    `/api/action-items/${encodeURIComponent(teamId)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, note }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string };
    throw new Error(payload.error ?? "Failed to update action item.");
  }

  const data = (await response.json()) as ReviewActionItemResponse;
  return data.item;
}
