import {
  getNotificationDeliveryById,
  recordNotificationDelivery,
} from "@/db/notification-deliveries/notification-deliveries.db";
import {
  getActionItems,
  markActionItemsNotified,
} from "@/db/action-items/action-items.db";
import { getUsersByTeam } from "@/db/users/users.db";
import { getAppBaseUrl, isActionItemsDigestEnabled } from "@/lib/config";
import { resolveLeadEmail } from "@/lib/config/lead-emails";
import {
  isActiveActionItem,
  syncActionItems,
} from "@/lib/action-items/action-items.service";
import {
  ACTION_ITEM_RESOLVE_AFTER_DAYS,
  type ActionItemModel,
  type ActionItemSyncSummary,
} from "@/lib/domain/action-items.types";
import type {
  NotificationChannelKey,
  NotificationDeliveryStatus,
} from "@/lib/domain/notifications.types";
import { NOTIFICATION_CHANNELS } from "@/lib/notifications/channels";
import {
  buildWeeklyActionItemsDigest,
  type WeeklyDigestItem,
} from "@/lib/notifications/templates/action-items-weekly-digest";
import { getIstWeekStartDateKey } from "@/lib/utils/date.utils";

/** Delivery kind recorded for weekly digests. */
export const WEEKLY_ACTION_ITEMS_DIGEST_KIND = "weekly_action_items_digest";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type DigestChannelOutcome = {
  channel: NotificationChannelKey;
  status: NotificationDeliveryStatus;
  detail: string;
};

export type DigestTeamOutcome = {
  teamKey: string;
  teamName: string;
  itemCount: number;
  recipientCount: number;
  /** Recipients without a usable email address (in-app still reached them). */
  recipientsWithoutEmail: number;
  channelOutcomes: DigestChannelOutcome[];
};

export type ActionItemDigestSummary = {
  enabled: boolean;
  force: boolean;
  periodKey: string;
  synced: ActionItemSyncSummary;
  teamsConsidered: number;
  teamsNotified: number;
  skippedTeamKeys: string[];
  teams: DigestTeamOutcome[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Builds the deterministic delivery id used for idempotency.
 *
 * @param periodKey The IST week-start date key.
 * @param teamKey The team key.
 * @param channel The notification channel key.
 * @returns The delivery document id.
 */
function buildDeliveryId(
  periodKey: string,
  teamKey: string,
  channel: NotificationChannelKey,
): string {
  return [WEEKLY_ACTION_ITEMS_DIGEST_KIND, periodKey, teamKey, channel]
    .map((part) => part.trim().replace(/[^A-Za-z0-9_-]+/g, "_"))
    .join("__");
}

/**
 * Resolves digest recipients: the team's leads, with their best-known email.
 *
 * @param teamKey The team key stored on user records.
 * @returns The lead recipients for the team.
 */
async function getDigestRecipientsForTeam(
  teamKey: string,
): Promise<Array<{ uid: string; email: string | null; fullName: string }>> {
  const users = await getUsersByTeam(teamKey);

  return users
    .filter((user) => user.role === "TEAM_LEAD" || user.role === "LEAD_TRAINEE")
    .map((user) => ({
      uid: user.id,
      email: resolveLeadEmail(user.githubUsername, user.email ?? null),
      fullName: user.fullName?.trim() || user.githubUsername,
    }));
}

/**
 * Groups active action items by team key.
 *
 * @param items All persisted action items.
 * @returns Active items keyed by team key.
 */
function groupActiveItemsByTeam(
  items: ActionItemModel[],
): Map<string, ActionItemModel[]> {
  const groups = new Map<string, ActionItemModel[]>();

  for (const item of items) {
    if (!isActiveActionItem(item)) {
      continue;
    }

    const existing = groups.get(item.teamKey);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(item.teamKey, [item]);
    }
  }

  return groups;
}

/**
 * Syncs action items and sends the weekly digest to each team's leads through
 * every registered channel. Delivery is idempotent per (week, team, channel)
 * unless `force` is set, so overlapping cron/manual runs never double-send.
 *
 * @param options Optional run options.
 * @returns A summary of the run for cron/control-panel reporting.
 */
export async function sendWeeklyActionItemDigest(
  options: { force?: boolean } = {},
): Promise<ActionItemDigestSummary> {
  const force = options.force ?? false;
  const startedAt = new Date();
  const periodKey = getIstWeekStartDateKey(startedAt);

  const synced = await syncActionItems();
  const enabled = isActionItemsDigestEnabled();

  const base: Omit<
    ActionItemDigestSummary,
    "teamsConsidered" | "teamsNotified" | "skippedTeamKeys" | "teams"
  > = {
    enabled,
    force,
    periodKey,
    synced,
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
  };

  if (!enabled) {
    return {
      ...base,
      teamsConsidered: 0,
      teamsNotified: 0,
      skippedTeamKeys: [],
      teams: [],
      finishedAt: new Date().toISOString(),
    };
  }

  const items = await getActionItems();
  const groupedItems = groupActiveItemsByTeam(items);
  const appBaseUrl = getAppBaseUrl();
  const teams: DigestTeamOutcome[] = [];
  const skippedTeamKeys: string[] = [];
  let teamsNotified = 0;

  for (const [teamKey, teamItems] of groupedItems) {
    const recipients = await getDigestRecipientsForTeam(teamKey);

    if (recipients.length === 0) {
      skippedTeamKeys.push(teamKey);
      continue;
    }

    const teamName = teamItems[0].teamName;
    const now = new Date();
    const digestItems: WeeklyDigestItem[] = teamItems.map((item) => ({
      id: item.id,
      message: item.message,
      reason: item.reason,
      priority: item.priority,
      detectedAt: item.detectedAt,
      isStale:
        now.getTime() - item.lastDetectedAt.getTime() >=
        ACTION_ITEM_RESOLVE_AFTER_DAYS * MS_PER_DAY,
    }));

    const message = buildWeeklyActionItemsDigest({
      teamName,
      weekStartDateKey: periodKey,
      appBaseUrl,
      items: digestItems,
    });

    const channelOutcomes: DigestChannelOutcome[] = [];
    let anyDelivered = false;

    for (const channel of NOTIFICATION_CHANNELS) {
      const deliveryId = buildDeliveryId(periodKey, teamKey, channel.key);

      if (!force) {
        const existingDelivery = await getNotificationDeliveryById(deliveryId);

        if (existingDelivery) {
          channelOutcomes.push({
            channel: channel.key,
            status: "SKIPPED",
            detail: `Already delivered for week ${periodKey}.`,
          });
          continue;
        }
      }

      if (!channel.isAvailable()) {
        await recordNotificationDelivery({
          id: deliveryId,
          kind: WEEKLY_ACTION_ITEMS_DIGEST_KIND,
          channel: channel.key,
          teamKey,
          periodKey,
          recipientUids: [],
          itemCount: teamItems.length,
          status: "SKIPPED",
          error: "Channel is not configured or is disabled.",
          recordedAt: new Date(),
        });
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
          kind: WEEKLY_ACTION_ITEMS_DIGEST_KIND,
          channel: channel.key,
          teamKey,
          periodKey,
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
          kind: WEEKLY_ACTION_ITEMS_DIGEST_KIND,
          channel: channel.key,
          teamKey,
          periodKey,
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

    if (anyDelivered) {
      await markActionItemsNotified(teamItems, new Date());
      teamsNotified += 1;
    }

    teams.push({
      teamKey,
      teamName,
      itemCount: teamItems.length,
      recipientCount: recipients.length,
      recipientsWithoutEmail: recipients.filter((recipient) => !recipient.email)
        .length,
      channelOutcomes,
    });
  }

  return {
    ...base,
    teamsConsidered: groupedItems.size,
    teamsNotified,
    skippedTeamKeys,
    teams,
    finishedAt: new Date().toISOString(),
  };
}
