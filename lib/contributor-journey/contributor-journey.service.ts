import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  CONTRIBUTOR_JOURNEY_CONTENT,
  type ContributorJourneyChecklistItem,
} from "@/lib/config/contributor-journey.constants";
import {
  DERIVED_JOURNEY_KEYS,
  type DerivedJourneyKey,
  type JourneyProgressSnapshot,
  type UserJourneyProgressModel,
} from "@/lib/domain/contributor-journey.types";
import { DbInvalidStateError, DbValidationError } from "@/db/db.errors";
import {
  getUserJourneyProgressByUid,
  markManualJourneyItemCompletedByUid,
  saveUserJourneyProgressByUid,
} from "@/db/user-journey-progress/user-journey-progress.db";

type ContributorJourneyItemSnapshot = ContributorJourneyChecklistItem & {
  completed: boolean;
  completedAt: string | null;
  locked: boolean;
};

type ContributorJourneyTaskSnapshot = {
  id: string;
  items: ContributorJourneyItemSnapshot[];
  title: string;
};

export type ContributorJourneySnapshot = {
  progress: {
    completedManualCount: number;
    completedRequiredCount: number;
    totalManualCount: number;
    totalRequiredCount: number;
  };
  rawProgress: JourneyProgressSnapshot;
  tasks: ContributorJourneyTaskSnapshot[];
};

/**
 * Resolves the effective completion type for a roadmap item.
 *
 * @param item The roadmap item to inspect.
 * @returns The explicit or default completion type.
 */
function getCompletionType(item: ContributorJourneyChecklistItem) {
  return item.completionType ?? "manual";
}

/**
 * Builds the default persisted journey progress model for a platform.
 *
 * @param platform The selected contribution platform.
 * @returns A new default journey progress model.
 */
function buildDefaultJourneyProgress(
  platform: ContributionPlatform,
): UserJourneyProgressModel {
  const items = CONTRIBUTOR_JOURNEY_CONTENT[platform].tasks.flatMap(
    (task) => task.items,
  );

  return {
    createdAt: new Date(),
    derivedState: Object.fromEntries(
      DERIVED_JOURNEY_KEYS.map((key) => [
        key,
        {
          completed: false,
          completedAt: null,
          sourceUrl: null,
        },
      ]),
    ) as UserJourneyProgressModel["derivedState"],
    manualProgress: Object.fromEntries(
      items
        .filter((item) => getCompletionType(item) === "manual")
        .map((item) => [
          item.id,
          {
            completed: false,
            completedAt: null,
          },
        ]),
    ),
    platform,
    updatedAt: new Date(),
  };
}

/**
 * Ensures a stored journey progress document matches the current roadmap shape.
 *
 * @param progress The currently stored progress model, if any.
 * @param platform The selected contribution platform.
 * @returns The normalized progress model plus whether it changed.
 */
function ensureJourneyProgressShape(
  progress: UserJourneyProgressModel | null,
  platform: ContributionPlatform,
): {
  changed: boolean;
  progress: UserJourneyProgressModel;
} {
  if (!progress || progress.platform !== platform) {
    return {
      changed: true,
      progress: buildDefaultJourneyProgress(platform),
    };
  }

  const defaults = buildDefaultJourneyProgress(platform);
  let changed = false;

  const manualProgress = { ...progress.manualProgress };
  for (const [itemId, state] of Object.entries(defaults.manualProgress)) {
    if (!(itemId in manualProgress)) {
      manualProgress[itemId] = state;
      changed = true;
    }
  }

  const derivedState = { ...progress.derivedState };
  for (const key of DERIVED_JOURNEY_KEYS) {
    if (!(key in derivedState)) {
      derivedState[key] = defaults.derivedState[key];
      changed = true;
    }
  }

  return {
    changed,
    progress: changed
      ? {
          ...progress,
          derivedState,
          manualProgress,
          platform,
          updatedAt: new Date(),
        }
      : progress,
  };
}

/**
 * Converts the normalized journey progress model to the API snapshot shape.
 *
 * @param progress The normalized stored progress model.
 * @returns The API-safe progress snapshot.
 */
function toJourneyProgressSnapshot(
  progress: UserJourneyProgressModel,
): JourneyProgressSnapshot {
  return {
    createdAt: progress.createdAt.toISOString(),
    derivedState: Object.fromEntries(
      DERIVED_JOURNEY_KEYS.map((key) => [
        key,
        {
          completed: progress.derivedState[key].completed,
          completedAt:
            progress.derivedState[key].completedAt?.toISOString() ?? null,
          sourceUrl: progress.derivedState[key].sourceUrl,
        },
      ]),
    ) as JourneyProgressSnapshot["derivedState"],
    manualProgress: Object.fromEntries(
      Object.entries(progress.manualProgress).map(([itemId, state]) => [
        itemId,
        {
          completed: state.completed,
          completedAt: state.completedAt?.toISOString() ?? null,
        },
      ]),
    ),
    platform: progress.platform,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

/**
 * Resolves the derived completion state backing a verification roadmap item.
 *
 * @param item The roadmap item whose derived state is needed.
 * @param progress The normalized stored journey progress model.
 * @returns The derived completion state for the item.
 */
function getDerivedCompletionState(
  item: ContributorJourneyChecklistItem,
  progress: UserJourneyProgressModel,
): {
  completed: boolean;
  completedAt: Date | null;
} {
  const derivedKey = item.derivedKey as DerivedJourneyKey | undefined;

  if (!derivedKey) {
    return { completed: false, completedAt: null };
  }

  return {
    completed: progress.derivedState[derivedKey].completed,
    completedAt: progress.derivedState[derivedKey].completedAt,
  };
}

/**
 * Builds per-task roadmap snapshots with completion and lock state.
 *
 * @param platform The selected contribution platform.
 * @param progress The normalized stored journey progress model.
 * @returns Snapshot tasks ready for API consumption.
 */
function buildJourneyTaskSnapshots(
  platform: ContributionPlatform,
  progress: UserJourneyProgressModel,
): ContributorJourneyTaskSnapshot[] {
  return CONTRIBUTOR_JOURNEY_CONTENT[platform].tasks.map((task) => {
    let previousBlockingManualCompleted = true;

    const items = task.items.map((item) => {
      const isVerification = getCompletionType(item) === "verification";
      const manualState = !isVerification
        ? progress.manualProgress[item.id]
        : undefined;
      const derivedState = isVerification
        ? getDerivedCompletionState(item, progress)
        : undefined;
      const completed = isVerification
        ? Boolean(derivedState?.completed)
        : Boolean(manualState?.completed);
      const completedAt = isVerification
        ? (derivedState?.completedAt ?? null)
        : (manualState?.completedAt ?? null);
      const locked =
        item.importance === "high" && !isVerification
          ? !previousBlockingManualCompleted
          : false;

      if (item.importance === "high" && !isVerification) {
        previousBlockingManualCompleted =
          previousBlockingManualCompleted && completed;
      }

      return {
        ...item,
        completed,
        completedAt: completedAt?.toISOString() ?? null,
        locked,
      };
    });

    return {
      id: task.id,
      items,
      title: task.title,
    };
  });
}

/**
 * Finds a manual roadmap item by stable id for the given platform.
 *
 * @param platform The selected contribution platform.
 * @param itemId The stable roadmap item id.
 * @returns The manual item when found, otherwise null.
 */
function getManualItemById(
  platform: ContributionPlatform,
  itemId: string,
): ContributorJourneyChecklistItem | null {
  const items = CONTRIBUTOR_JOURNEY_CONTENT[platform].tasks.flatMap(
    (task) => task.items,
  );
  const item = items.find((currentItem) => currentItem.id === itemId);

  if (!item) {
    return null;
  }

  return getCompletionType(item) === "manual" ? item : null;
}

/**
 * Computes whether a manual roadmap item is currently locked by earlier required steps.
 *
 * @param platform The selected contribution platform.
 * @param progress The normalized stored journey progress model.
 * @param itemId The stable roadmap item id.
 * @returns Whether the target manual item is locked.
 */
function isManualItemLocked(
  platform: ContributionPlatform,
  progress: UserJourneyProgressModel,
  itemId: string,
): boolean {
  for (const task of CONTRIBUTOR_JOURNEY_CONTENT[platform].tasks) {
    let previousBlockingManualCompleted = true;

    for (const item of task.items) {
      const isVerification = getCompletionType(item) === "verification";
      const completed = isVerification
        ? false
        : Boolean(progress.manualProgress[item.id]?.completed);
      const locked =
        item.importance === "high" && !isVerification
          ? !previousBlockingManualCompleted
          : false;

      if (item.id === itemId && !isVerification) {
        return locked;
      }

      if (item.importance === "high" && !isVerification) {
        previousBlockingManualCompleted =
          previousBlockingManualCompleted && completed;
      }
    }
  }

  return false;
}

/**
 * Returns the contributor journey snapshot for a user and platform.
 *
 * @param uid The user id whose roadmap progress is being loaded.
 * @param platform The selected contribution platform.
 * @returns The merged roadmap snapshot for API consumers.
 */
export async function getContributorJourneySnapshotByUid(
  uid: string,
  platform: ContributionPlatform,
): Promise<ContributorJourneySnapshot> {
  const currentProgress = await getUserJourneyProgressByUid(uid);
  const ensured = ensureJourneyProgressShape(currentProgress, platform);

  if (ensured.changed) {
    await saveUserJourneyProgressByUid(uid, ensured.progress);
  }

  const totalManualCount = Object.keys(ensured.progress.manualProgress).length;
  const completedManualCount = Object.values(
    ensured.progress.manualProgress,
  ).filter((state) => state.completed).length;
  const requiredManualItems = CONTRIBUTOR_JOURNEY_CONTENT[platform].tasks
    .flatMap((task) => task.items)
    .filter(
      (item) =>
        getCompletionType(item) === "manual" && item.importance === "high",
    );
  const completedRequiredCount = requiredManualItems.filter(
    (item) => ensured.progress.manualProgress[item.id]?.completed,
  ).length;

  return {
    progress: {
      completedManualCount,
      completedRequiredCount,
      totalManualCount,
      totalRequiredCount: requiredManualItems.length,
    },
    rawProgress: toJourneyProgressSnapshot(ensured.progress),
    tasks: buildJourneyTaskSnapshots(platform, ensured.progress),
  };
}

/**
 * Marks a manual roadmap item as completed for a user. Completion is one-way.
 *
 * @param uid The user id whose roadmap progress is being updated.
 * @param platform The selected contribution platform.
 * @param itemId The stable manual roadmap item id to complete.
 * @returns A promise that resolves when the update has been persisted.
 */
export async function markContributorJourneyManualItemCompletedByUid(
  uid: string,
  platform: ContributionPlatform,
  itemId: string,
): Promise<void> {
  const ensured = ensureJourneyProgressShape(
    await getUserJourneyProgressByUid(uid),
    platform,
  );

  if (ensured.changed) {
    await saveUserJourneyProgressByUid(uid, ensured.progress);
  }

  const item = getManualItemById(platform, itemId);

  if (!item) {
    throw new DbValidationError(
      "itemId",
      "Journey itemId must refer to an existing manual roadmap item.",
    );
  }

  if (isManualItemLocked(platform, ensured.progress, itemId)) {
    throw new DbInvalidStateError(
      "Contributor journey",
      "This journey step is locked until earlier required steps are completed.",
    );
  }

  await markManualJourneyItemCompletedByUid(uid, itemId);
}
