"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionItem, ActionItemReviewStatus } from "../action-items.types";
import {
  fetchActionItems,
  reviewActionItem,
} from "../services/action-items-api.service";

/**
 * Loads the caller's action items and exposes review transitions. Used by both
 * the team-lead overview and the admin team-reports view.
 */
export function useActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // No synchronous setState here: the effect-driven initial load must not
  // schedule renders directly, so state only updates after the fetch resolves.
  const fetchItems = useCallback(async () => {
    try {
      const loadedItems = await fetchActionItems();
      setItems(loadedItems);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load action items.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Mirrors the existing navbar pattern: the effect only kicks off an IIFE so
  // no setState runs synchronously within the effect body itself.
  useEffect(() => {
    (async () => {
      await fetchItems();
    })();
  }, [fetchItems]);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    await fetchItems();
  }, [fetchItems]);

  const reviewItem = useCallback(
    async (
      item: ActionItem,
      status: ActionItemReviewStatus,
      note?: string,
    ): Promise<void> => {
      setBusyItemId(item.id);
      setActionError(null);

      try {
        const updatedItem = await reviewActionItem(
          item.teamId,
          item.id,
          status,
          note,
        );

        setItems((previous) =>
          status === "ACKNOWLEDGED"
            ? previous.map((existing) =>
                existing.id === item.id && existing.teamId === item.teamId
                  ? updatedItem
                  : existing,
              )
            : previous.filter(
                (existing) =>
                  !(existing.id === item.id && existing.teamId === item.teamId),
              ),
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "Failed to update action item.",
        );
      } finally {
        setBusyItemId(null);
      }
    },
    [],
  );

  return {
    items,
    loading,
    errorMessage,
    actionError,
    busyItemId,
    reviewItem,
    reload,
  };
}

export type UseActionItemsReturn = ReturnType<typeof useActionItems>;
