import {
  deleteActionItems,
  getActionItemById,
  getActionItems,
  upsertActionItems,
} from "@/db/action-items/action-items.db";
import {
  type ActionItemModel,
  type ActionItemSyncSummary,
} from "@/lib/domain/action-items.types";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import { getTeamReportsSnapshot } from "@/lib/team-reports/team-reports.service";

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
 * Derives action items from the current team reports and persists them.
 *
 * Items are existence-based: a rule present in the latest report is upserted,
 * while a rule absent from the report is deleted. If it appears again later,
 * it is created as a new item with a fresh notification history.
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
  let deletedCount = 0;

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
          detectedAt: now,
          lastDetectedAt: now,
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

      updatedCount += 1;

      itemsToUpsert.push({
        ...prior,
        teamName: report.teamName,
        message: step.message,
        priority: step.priority,
        reason: step.reason,
        lastDetectedAt: now,
        updatedAt: now,
      });
    }
  }

  const staleItems = existingItems.filter((prior) => {
    const compositeKey = `${prior.teamId}/${prior.id}`;
    return !touchedKeys.has(compositeKey);
  });
  deletedCount = staleItems.length;

  await Promise.all([
    upsertActionItems(itemsToUpsert),
    deleteActionItems(staleItems),
  ]);

  return {
    detectedCount: touchedKeys.size,
    createdCount,
    updatedCount,
    deletedCount,
    currentCount: touchedKeys.size,
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
 * Orders action items for display: escalated items first, then high priority,
 * then newest detections.
 *
 * @param left The first item.
 * @param right The second item.
 * @returns The sort comparison result.
 */
export function compareActionItemsForDisplay(
  left: ActionItemModel,
  right: ActionItemModel,
): number {
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
