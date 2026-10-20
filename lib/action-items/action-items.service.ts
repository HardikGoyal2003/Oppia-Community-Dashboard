import { DbNotFoundError } from "@/db/db.errors";
import {
  getActionItemById,
  getActionItems,
  updateActionItemStatusById,
  upsertActionItems,
} from "@/db/action-items/action-items.db";
import {
  ACTION_ITEM_ACTIVE_STATUSES,
  type ActionItemModel,
  type ActionItemReviewStatus,
  type ActionItemSyncSummary,
} from "@/lib/domain/action-items.types";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import { getTeamReportsSnapshot } from "@/lib/team-reports/team-reports.service";
import { getIstDateKey } from "@/lib/utils/date.utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A resolved or dismissed item reopens when its rule starts firing again after
 * this many days of inactivity, so a regressed metric re-enters the queue while
 * recently-closed items stay closed.
 */
export const ACTION_ITEM_REOPEN_AFTER_DAYS = 14;

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
 * @returns True when the item is open or acknowledged.
 */
export function isActiveActionItem(item: ActionItemModel): boolean {
  return ACTION_ITEM_ACTIVE_STATUSES.includes(item.status);
}

/**
 * Derives action items from the current team reports and persists them.
 *
 * New rules become OPEN items; healing rules simply stop refreshing
 * `lastDetectedAt`; closed items reopen only after
 * `ACTION_ITEM_REOPEN_AFTER_DAYS` without a detection. Reopening also resets
 * the escalation history, so a fresh regression restarts the nudge ladder.
 *
 * @returns A summary of what the sync changed.
 */
export async function syncActionItems(): Promise<ActionItemSyncSummary> {
  const [snapshot, existingItems] = await Promise.all([
    getTeamReportsSnapshot(),
    getActionItems(),
  ]);

  const existingById = new Map(
    existingItems.map((item) => [`${item.teamId}/${item.id}`, item]),
  );
  const now = new Date();
  const itemsToUpsert: ActionItemModel[] = [];
  const touchedIds = new Set<string>();

  let createdCount = 0;
  let updatedCount = 0;
  let reopenedCount = 0;

  for (const report of snapshot.reports) {
    const teamKey = getTeamKeyForTeamId(report.id);

    for (const step of report.nextSteps) {
      const id = buildActionItemId(step.ruleKey, step.params);
      const compositeKey = `${report.id}/${id}`;
      const prior = existingById.get(compositeKey);
      touchedIds.add(id);

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
          acknowledgedAt: null,
          resolvedAt: null,
          resolvedBy: null,
          resolutionNote: null,
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
      const isClosed =
        prior.status === "RESOLVED" || prior.status === "DISMISSED";
      const shouldReopen =
        isClosed && daysSinceLastDetected >= ACTION_ITEM_REOPEN_AFTER_DAYS;
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
        status: shouldReopen ? "OPEN" : prior.status,
        acknowledgedAt: shouldReopen ? null : prior.acknowledgedAt,
        resolvedAt: shouldReopen ? null : prior.resolvedAt,
        resolvedBy: shouldReopen ? null : prior.resolvedBy,
        resolutionNote: shouldReopen ? null : prior.resolutionNote,
        // A reopened item starts a fresh escalation ladder.
        escalationLevel: shouldReopen ? 0 : prior.escalationLevel,
        lastEscalatedAt: shouldReopen ? null : prior.lastEscalatedAt,
        lastDetectedAt: now,
        updatedAt: now,
      });
    }
  }

  await upsertActionItems(itemsToUpsert);

  const finalItems = existingItems.map(
    (item) =>
      itemsToUpsert.find(
        (updated) => updated.id === item.id && updated.teamId === item.teamId,
      ) ?? item,
  );
  const detectedItems = itemsToUpsert.filter(
    (item) => !existingById.has(`${item.teamId}/${item.id}`),
  );
  const activeCount =
    finalItems.filter((item) => isActiveActionItem(item)).length +
    detectedItems.length;

  return {
    detectedCount: touchedIds.size,
    createdCount,
    updatedCount,
    reopenedCount,
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

/** The session identity needed to authorize an action item review. */
export type ActionItemActor = {
  uid: string;
  role: string;
  team: string | null;
};

/**
 * Whether an actor may acknowledge, resolve, or dismiss an item. Leads may act
 * on their own team's items; admins may act on any team (override).
 *
 * @param item The item being reviewed.
 * @param actor The acting user.
 * @returns True when the review is permitted.
 */
export function canReviewActionItem(
  item: ActionItemModel,
  actor: Pick<ActionItemActor, "role" | "team">,
): boolean {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
    return true;
  }

  const isOwnTeamLead =
    actor.role === "TEAM_LEAD" || actor.role === "LEAD_TRAINEE";

  return isOwnTeamLead && Boolean(actor.team) && item.teamKey === actor.team;
}

/**
 * Applies a review status transition to an action item.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @param itemId The action item document id (the rule key).
 * @param status The review status to apply.
 * @param actorUid The uid of the lead or admin performing the transition.
 * @param note Optional resolution or dismissal note.
 * @returns The updated action item.
 * @throws {DbNotFoundError} When the action item does not exist.
 */
export async function updateActionItemStatus(
  teamId: string,
  itemId: string,
  status: ActionItemReviewStatus,
  actorUid: string,
  note?: string | null,
): Promise<ActionItemModel> {
  const existing = await getActionItemById(teamId, itemId);

  if (!existing) {
    throw new DbNotFoundError("ActionItem");
  }

  const now = new Date();
  const isClosing = status === "RESOLVED" || status === "DISMISSED";
  const trimmedNote = note?.trim() ? note.trim() : null;

  const update = {
    status,
    acknowledgedAt:
      status === "ACKNOWLEDGED"
        ? (existing.acknowledgedAt ?? now)
        : existing.acknowledgedAt,
    resolvedAt: isClosing ? now : null,
    resolvedBy: isClosing ? actorUid : null,
    resolutionNote: isClosing ? trimmedNote : null,
    updatedAt: now,
  };

  await updateActionItemStatusById(teamId, itemId, update, now);

  return { ...existing, ...update };
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
