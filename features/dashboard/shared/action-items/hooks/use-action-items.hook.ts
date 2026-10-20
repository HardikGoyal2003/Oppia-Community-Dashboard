"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionItem } from "../action-items.types";
import { fetchActionItems } from "../services/action-items-api.service";

/**
 * Loads the caller's action items. Status is derived by the sync engine, so
 * the list is read-only — there is nothing for a reviewer to submit.
 */
export function useActionItems() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return {
    items,
    loading,
    errorMessage,
    reload,
  };
}

export type UseActionItemsReturn = ReturnType<typeof useActionItems>;
