import {
  getActionItems,
  updateActionItemsEscalation,
} from "@/db/action-items/action-items.db";
import {
  getNotificationDeliveryById,
  getLatestNotificationDelivery,
  recordNotificationDelivery,
} from "@/db/notification-deliveries/notification-deliveries.db";
import { getUsersByTeam } from "@/db/users/users.db";
import {
  getAppBaseUrl,
  getActionItemEscalationDays,
  isActionItemEscalationEnabled,
} from "@/lib/config";
import {
  resolveLeadEmail,
  resolveTeamLeadEmail,
} from "@/lib/config/lead-emails";
import {
  type ActionItemModel,
  type ActionItemSyncSummary,
} from "@/lib/domain/action-items.types";
import type {
  NotificationChannelKey,
  NotificationDeliveryStatus,
} from "@/lib/domain/notifications.types";
import { syncActionItems } from "@/lib/action-items/action-items.service";
import { NOTIFICATION_CHANNELS } from "@/lib/notifications/channels";
import {
  buildActionItemsEscalation,
  type EscalationItem,
} from "@/lib/notifications/templates/action-items-escalation";
import { DAILY_ACTION_ITEMS_DIGEST_KIND } from "@/lib/notifications/action-item-digest.service";
import { getIstDateKey } from "@/lib/utils/date.utils";

/** Delivery kind recorded for escalation nudges. */
export const ACTION_ITEM_ESCALATION_KIND = "action_item_escalation";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type EscalationTeamOutcome = {
  teamKey: string;
  teamName: string;
  itemCount: number;
  recipientCount: number;
  /** Escalation level the items were bumped to in this run. */
  newEscalationLevel: number;
  channelOutcomes: Array<{
    channel: NotificationChannelKey;
    status: NotificationDeliveryStatus;
    detail: string;
  }>;
};

export type ActionItemEscalationSummary = {
  enabled: boolean;
  escalationAfterDays: number;
  /** IST date key; escalation is idempotent per (day, team, channel). */
  periodKey: string;
  synced: ActionItemSyncSummary;
  itemsDueCount: number;
  teamsNotified: number;
  teams: EscalationTeamOutcome[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Builds the deterministic delivery id used for idempotency and audit.
 *
 * @param periodKey The IST date key of the escalation run.
 * @param teamKey The team key.
 * @param channel The notification channel key.
 * @returns The delivery document id.
 */
function buildDeliveryId(
  periodKey: string,
  teamKey: string,
  channel: NotificationChannelKey,
): string {
  return [ACTION_ITEM_ESCALATION_KIND, periodKey, teamKey, channel]
    .map((part) => part.trim().replace(/[^A-Za-z0-9_-]+/g, "_"))
    .join("__");
}

/**
 * Resolves escalation recipients: the team's leads, with their best-known
 * email (explicit override first, then the user record).
 *
 * @param teamKey The team key stored on user records.
 * @returns The lead recipients for the team.
 */
async function getEscalationRecipientsForTeam(
  teamKey: string,
): Promise<Array<{ uid: string; email: string | null; fullName: string }>> {
  const users = await getUsersByTeam(teamKey);

  return users
    .filter((user) => user.role === "TEAM_LEAD" || user.role === "LEAD_TRAINEE")
    .map((user) => ({
      uid: user.id,
      email:
        resolveTeamLeadEmail(teamKey) ??
        resolveLeadEmail(user.githubUsername, user.email ?? null),
      fullName: user.fullName?.trim() || user.githubUsername,
    }));
}

/**
 * Whether an item is due for its next escalation nudge.
 *
 * An item escalates when it is still present in the latest report, was
 * included in at least one digest, and no action has landed for
 * `escalationAfterDays` since the last nudge (or first digest).
 *
 * @param item The action item to check.
 * @param escalationAfterDays The required idle days between nudges.
 * @param now Optional anchor time for testing.
 * @returns True when the item is due for escalation.
 */
export function isActionItemDueForEscalation(
  item: ActionItemModel,
  escalationAfterDays: number,
  now: Date = new Date(),
): boolean {
  // Never nudged about an item the lead has not been told about yet.
  if (item.notificationCount <= 0 || !item.firstNotifiedAt) {
    return false;
  }

  const anchor = item.lastEscalatedAt ?? item.firstNotifiedAt;
  const idleMs = now.getTime() - anchor.getTime();

  return idleMs >= escalationAfterDays * MS_PER_DAY;
}

/**
 * Syncs action items and sends escalation nudges for every item that crossed
 * its idle boundary since the last nudge. Delivery is idempotent per
 * (IST day, team, channel) so overlapping cron/manual runs never double-send;
 * the per-item level/timestamp guard decides *whether* an item escalates.
 *
 * @param options Optional run options.
 * @returns A summary of the run for cron/control-panel reporting.
 */
export async function escalateDueActionItems(
  options: { force?: boolean } = {},
): Promise<ActionItemEscalationSummary> {
  const force = options.force ?? false;
  const startedAt = new Date();
  const periodKey = getIstDateKey(startedAt);

  const synced = await syncActionItems();
  const enabled = isActionItemEscalationEnabled();
  const escalationAfterDays = getActionItemEscalationDays();

  if (!enabled) {
    return {
      enabled,
      escalationAfterDays,
      periodKey,
      synced,
      itemsDueCount: 0,
      teamsNotified: 0,
      teams: [],
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  const items = await getActionItems();
  const now = new Date();
  const currentItemsByTeam = new Map<string, ActionItemModel[]>();

  for (const item of items) {
    const existing = currentItemsByTeam.get(item.teamKey);

    if (existing) {
      existing.push(item);
    } else {
      currentItemsByTeam.set(item.teamKey, [item]);
    }
  }

  const dueByTeam = new Map<string, ActionItemModel[]>();

  for (const [teamKey, teamItems] of currentItemsByTeam) {
    const latestDigest = await getLatestNotificationDelivery(
      DAILY_ACTION_ITEMS_DIGEST_KIND,
      teamKey,
    );
    const notifiedItemIds = new Set(latestDigest?.actionItemIds ?? []);
    const dueItems = teamItems.filter(
      (item) =>
        notifiedItemIds.has(item.id) &&
        isActionItemDueForEscalation(item, escalationAfterDays, now),
    );

    if (dueItems.length > 0) {
      dueByTeam.set(teamKey, dueItems);
    }
  }

  const dueItems = Array.from(dueByTeam.values()).flat();

  const appBaseUrl = getAppBaseUrl();
  const teams: EscalationTeamOutcome[] = [];
  let teamsNotified = 0;

  for (const [teamKey, teamItems] of dueByTeam) {
    const recipients = await getEscalationRecipientsForTeam(teamKey);

    // No leads to nudge; leave the items untouched so the boundary check
    // simply retries on the next run.
    if (recipients.length === 0) {
      continue;
    }

    const teamName = teamItems[0].teamName;
    const newEscalationLevel = Math.max(
      ...teamItems.map((item) => item.escalationLevel + 1),
    );
    const escalationItems: EscalationItem[] = teamItems.map((item) => ({
      id: item.id,
      message: item.message,
      reason: item.reason,
      priority: item.priority,
      detectedAt: item.detectedAt,
      daysOpen: Math.max(
        1,
        Math.floor(
          (now.getTime() - item.firstNotifiedAt!.getTime()) / MS_PER_DAY,
        ),
      ),
    }));

    const message = buildActionItemsEscalation({
      teamName,
      escalationLevel: newEscalationLevel,
      escalationAfterDays,
      appBaseUrl,
      items: escalationItems,
    });

    const channelOutcomes: EscalationTeamOutcome["channelOutcomes"] = [];
    let anyDelivered = false;

    for (const channel of NOTIFICATION_CHANNELS) {
      const deliveryId = buildDeliveryId(periodKey, teamKey, channel.key);

      if (!force) {
        const existingDelivery = await getNotificationDeliveryById(deliveryId);

        if (existingDelivery) {
          channelOutcomes.push({
            channel: channel.key,
            status: "SKIPPED",
            detail: `Already delivered for ${periodKey}.`,
          });
          continue;
        }
      }

      if (!channel.isAvailable()) {
        channelOutcomes.push({
          channel: channel.key,
          status: "SKIPPED",
          detail: "Channel is not configured or is disabled.",
        });
        continue;
      }

      try {
        const result = await channel.send(recipients, message);
        const failureSummary =
          result.failed.map((failure) => failure.reason).join(" | ") || null;
        const status: NotificationDeliveryStatus =
          result.deliveredTo.length > 0
            ? "SENT"
            : result.failed.length > 0
              ? "FAILED"
              : "SKIPPED";

        await recordNotificationDelivery({
          id: deliveryId,
          kind: ACTION_ITEM_ESCALATION_KIND,
          channel: channel.key,
          teamKey,
          periodKey,
          actionItemIds: teamItems.map((item) => item.id),
          recipientUids: result.deliveredTo,
          itemCount: teamItems.length,
          status,
          error: failureSummary,
          recordedAt: new Date(),
        });

        if (status === "SENT") {
          anyDelivered = true;
        }

        channelOutcomes.push({
          channel: channel.key,
          status,
          detail:
            status === "SENT"
              ? `Delivered to ${result.deliveredTo.length} recipient(s).`
              : (failureSummary ?? "No recipients reached."),
        });
      } catch (error) {
        const errorDetail =
          error instanceof Error ? error.message : "Channel send failed.";

        await recordNotificationDelivery({
          id: deliveryId,
          kind: ACTION_ITEM_ESCALATION_KIND,
          channel: channel.key,
          teamKey,
          periodKey,
          actionItemIds: teamItems.map((item) => item.id),
          recipientUids: [],
          itemCount: teamItems.length,
          status: "FAILED",
          error: errorDetail,
          recordedAt: new Date(),
        });

        channelOutcomes.push({
          channel: channel.key,
          status: "FAILED",
          detail: errorDetail,
        });
      }
    }

    // Only bump levels once a nudge actually landed, so a fully failed run
    // retries on the next check instead of silently skipping the boundary.
    if (anyDelivered) {
      await updateActionItemsEscalation(
        teamItems.map((item) => ({
          teamId: item.teamId,
          itemId: item.id,
          escalationLevel: item.escalationLevel + 1,
          lastEscalatedAt: new Date(),
        })),
      );
      teamsNotified += 1;
    }

    teams.push({
      teamKey,
      teamName,
      itemCount: teamItems.length,
      recipientCount: recipients.length,
      newEscalationLevel,
      channelOutcomes,
    });
  }

  return {
    enabled,
    escalationAfterDays,
    periodKey,
    synced,
    itemsDueCount: dueItems.length,
    teamsNotified,
    teams,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}
