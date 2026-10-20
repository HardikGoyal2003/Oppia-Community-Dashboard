import {
  getActionItemById,
  getActionItems,
  upsertActionItems,
} from "@/db/action-items/action-items.db";
import {
  ACTION_ITEM_ACTIVE_STATUSES,
  ACTION_ITEM_RESOLVE_AFTER_DAYS,
  type ActionItemModel,
  type ActionItemSyncSummary,
} from "@/lib/domain/action-items.types";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import { getTeamReportsSnapshot } from "@/lib/team-reports/team-reports.service";
import { getIstDateKey } from "@/lib/utils/date.utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Builds the document id for an action item. Items live at
 * `teams/{teamId}/actionItems/{id}`, so the id only has to be unique within
 * one team: the rule key plus any parameter suffix.
 *
 * @param ruleKey The stable rule identifier from the team report.
 * @param params Optional rule parameter.
 * @returns The action item document id.
 */
export function buildActionItemId(ruleKey: string, params?: string): string {
  return [ruleKey, params]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim().replace(/[^A-Za-z0-9_-]+/g, "-"))
    .join("-");
}

/**
 * Resolves the team key for a team report id (e.g. `WEB_CORE` -> `CORE`).
 *
 * @param teamId The team document id.
 * @returns The matching team key, or the team id when no definition matches.
 */
function getTeamKeyForTeamId(teamId: string): string {
  return (
    TEAM_DEFINITIONS.find((definition) => definition.teamId === teamId)
      ?.teamKey ?? teamId
  );
}

/**
 * Resolves the team document id for a team key stored on user records
 * (e.g. `CORE` -> `WEB_CORE`).
 *
 * @param teamKey The team key stored on user records.
 * @returns The matching team document id, or null when no definition matches.
 */
export function getTeamIdForKey(teamKey: string): string | null {
  return (
    TEAM_DEFINITIONS.find((definition) => definition.teamKey === teamKey)
      ?.teamId ?? null
  );
}

/**
 * Whether an item still requires follow-up.
 *
 * @param item The action item to check.
 * @returns True when the item is open.
 */
export function isActiveActionItem(item: ActionItemModel): boolean {
  return ACTION_ITEM_ACTIVE_STATUSES.includes(item.status);
}

/**
 * Derives action items from the current team reports and persists them.
 *
 * The sync engine is the only writer of an item's status:
 *
 * - A firing rule creates an OPEN item, or refreshes `lastDetectedAt` on an
 *   existing one.
 * - A rule that stopped firing is not visited at all, so its item keeps the
 *   last `lastDetectedAt` it was given — that is what marks it as healed.
 * - Once an item has been silent for `ACTION_ITEM_RESOLVE_AFTER_DAYS` it
 *   resolves itself, which also restarts its escalation ladder.
 *
 * @returns A summary of what the sync changed.
 */
export async function syncActionItems(): Promise<ActionItemSyncSummary> {
  const [snapshot, existingItems] = await Promise.all([
    getTeamReportsSnapshot(),
    getActionItems(),
  ]);

  const existingByKey = new Map(
    existingItems.map((item) => [`${item.teamId}/${item.id}`, item]),
  );
  const now = new Date();
  const itemsToUpsert: ActionItemModel[] = [];
  const touchedKeys = new Set<string>();

  let createdCount = 0;
  let updatedCount = 0;
  let reopenedCount = 0;
  let resolvedCount = 0;

  for (const report of snapshot.reports) {
    const teamKey = getTeamKeyForTeamId(report.id);

    for (const step of report.nextSteps) {
      const id = buildActionItemId(step.ruleKey, step.params);
      const compositeKey = `${report.id}/${id}`;
      const prior = existingByKey.get(compositeKey);
      touchedKeys.add(compositeKey);

      if (!prior) {
        createdCount += 1;
        itemsToUpsert.push({
          id,
          teamId: report.id,
          teamKey,
          teamName: report.teamName,
          platform: report.platform,
          ruleKey: step.ruleKey,
          params: step.params ?? null,
          message: step.message,
          priority: step.priority,
          reason: step.reason,
          status: "OPEN",
          detectedAt: now,
          lastDetectedAt: now,
          resolvedAt: null,
          firstNotifiedAt: null,
          lastNotifiedAt: null,
          notificationCount: 0,
          escalationLevel: 0,
          lastEscalatedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        continue;
      }

      const daysSinceLastDetected =
        (now.getTime() - prior.lastDetectedAt.getTime()) / MS_PER_DAY;
      const wasResolved = prior.status === "RESOLVED";
      // A rule that fires again after the item resolved is a regression, so
      // the item reopens with a fresh escalation ladder.
      const shouldReopen = wasResolved && daysSinceLastDetected >= 1;
      const alreadyRefreshedToday =
        getIstDateKey(prior.lastDetectedAt) === getIstDateKey(now);
      const contentUnchanged =
        prior.message === step.message &&
        prior.priority === step.priority &&
        prior.reason === step.reason &&
        prior.teamName === report.teamName;

      // Reads trigger syncs, so skip no-op writes to keep Firestore usage low.
      if (alreadyRefreshedToday && contentUnchanged && !shouldReopen) {
        continue;
      }

      updatedCount += 1;

      if (shouldReopen) {
        reopenedCount += 1;
      }

      itemsToUpsert.push({
        ...prior,
        teamName: report.teamName,
        message: step.message,
        priority: step.priority,
        reason: step.reason,
        status: "OPEN",
        resolvedAt: null,
        // A reopened item starts a fresh escalation ladder.
        escalationLevel: shouldReopen ? 0 : prior.escalationLevel,
        lastEscalatedAt: shouldReopen ? null : prior.lastEscalatedAt,
        lastDetectedAt: now,
        updatedAt: now,
      });
    }
  }

  // Items whose rule stopped firing are not visited above, so they are
  // resolved here once they have been silent past the threshold.
  for (const prior of existingItems) {
    const compositeKey = `${prior.teamId}/${prior.id}`;

    if (touchedKeys.has(compositeKey)) {
      continue;
    }

    if (prior.status === "RESOLVED") {
      continue;
    }

    const daysSinceLastDetected =
      (now.getTime() - prior.lastDetectedAt.getTime()) / MS_PER_DAY;

    if (daysSinceLastDetected < ACTION_ITEM_RESOLVE_AFTER_DAYS) {
      continue;
    }

    resolvedCount += 1;

    itemsToUpsert.push({
      ...prior,
      status: "RESOLVED",
      resolvedAt: now,
      // A resolved item starts a fresh escalation ladder if it regresses.
      escalationLevel: 0,
      lastEscalatedAt: null,
      updatedAt: now,
    });
  }

  await upsertActionItems(itemsToUpsert);

  const finalItems = existingItems.map(
    (item) =>
      itemsToUpsert.find(
        (updated) => updated.id === item.id && updated.teamId === item.teamId,
      ) ?? item,
  );
  const detectedItems = itemsToUpsert.filter(
    (item) => !existingByKey.has(`${item.teamId}/${item.id}`),
  );
  const activeCount =
    finalItems.filter((item) => isActiveActionItem(item)).length +
    detectedItems.length;

  return {
    detectedCount: touchedKeys.size,
    createdCount,
    updatedCount,
    reopenedCount,
    resolvedCount,
    activeCount,
    syncedAt: now.toISOString(),
  };
}

/**
 * Loads a single action item.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @param itemId The action item document id (the rule key).
 * @returns The action item, or null when it does not exist.
 */
export async function getActionItem(
  teamId: string,
  itemId: string,
): Promise<ActionItemModel | null> {
  return getActionItemById(teamId, itemId);
}

/**
 * Orders action items for display: active before closed, escalated items
 * first (highest level first), then high priority, then newest detections.
 *
 * @param left The first item.
 * @param right The second item.
 * @returns The sort comparison result.
 */
export function compareActionItemsForDisplay(
  left: ActionItemModel,
  right: ActionItemModel,
): number {
  const activeRank = (item: ActionItemModel) =>
    isActiveActionItem(item) ? 0 : 1;

  const activeDiff = activeRank(left) - activeRank(right);

  if (activeDiff !== 0) {
    return activeDiff;
  }

  const escalationDiff = right.escalationLevel - left.escalationLevel;

  if (escalationDiff !== 0) {
    return escalationDiff;
  }

  const priorityRank = (item: ActionItemModel) =>
    item.priority === "high" ? 0 : 1;
  const priorityDiff = priorityRank(left) - priorityRank(right);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return right.detectedAt.getTime() - left.detectedAt.getTime();
}
