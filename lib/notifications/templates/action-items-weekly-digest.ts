import type { ActionItemPriority } from "@/lib/domain/action-items.types";
import type { NotificationMessage } from "@/lib/domain/notifications.types";

/** An action item rendered into the weekly digest. */
export type WeeklyDigestItem = {
  id: string;
  message: string;
  reason: string;
  priority: ActionItemPriority;
  /** Number of earlier digest notifications sent for this item. */
  notificationCount: number;
};

export type WeeklyDigestInput = {
  teamName: string;
  /** IST date key (`YYYY-MM-DD`). */
  dateKey: string;
  /** Absolute app base URL; empty string yields relative links. */
  appBaseUrl: string;
  items: WeeklyDigestItem[];
};

/** Dashboard path that hosts the action item list for deep linking. */
export const ACTION_ITEMS_DEEP_LINK_PATH = "/dashboard/overview";

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Escapes dynamic copy for the HTML email body.
 *
 * @param value The dynamic text to escape.
 * @returns HTML-safe text.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formats an IST date key for the email subject.
 *
 * @param dateKey The `YYYY-MM-DD` date key.
 * @returns A human-readable date label.
 */
function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Returns the concise team label used in the greeting.
 *
 * @param teamName The full team name.
 * @returns The concise team label.
 */
function getTeamLabel(teamName: string): string {
  return teamName
    .replace(/^\[(web|android)\]\s*/i, "")
    .replace(/\s+team\b.*$/i, "")
    .trim();
}

/**
 * Builds the explanation shown when an item is repeated in the digest.
 *
 * @param notificationCount Number of earlier weekly digests containing item.
 * @returns The reminder explanation, or an empty string for new items.
 */
function getReminderExplanation(notificationCount: number): string {
  if (notificationCount === 0) {
    return "";
  }

  if (notificationCount === 1) {
    return "Reminder #1 — This item was included in the previous weekly digest but has not been addressed yet.";
  }

  return `Reminder #${notificationCount} — This item has been included in the last ${notificationCount} weekly digests but has not been addressed yet.`;
}

/**
 * Builds a concise weekly action-item email.
 *
 * @param input The team, date, and action items to render.
 * @returns The rendered notification message.
 */
export function buildWeeklyActionItemsDigest(
  input: WeeklyDigestInput,
): NotificationMessage {
  const { teamName, appBaseUrl, items } = input;
  const teamShortLabel = getTeamLabel(teamName);
  const teamLabel = `${teamShortLabel} Team`;
  const dateLabel = formatDateLabel(input.dateKey);
  const countLabel = `${items.length} action item${items.length === 1 ? "" : "s"}`;
  const attentionMessage = `You have ${countLabel} requiring your attention. Please review and address ${items.length === 1 ? "it" : "them"} in the dashboard as soon as possible.`;
  const dashboardLink = `${appBaseUrl}${ACTION_ITEMS_DEEP_LINK_PATH}`;

  const textLines = [`Hi ${teamShortLabel} leads,`, "", attentionMessage, ""];

  const sortedItems = [...items].sort(
    (left, right) => priorityRank(left.priority) - priorityRank(right.priority),
  );

  sortedItems.forEach((item) => {
    const reminderLabel = getReminderExplanation(item.notificationCount);
    textLines.push(
      `- [${item.priority.toUpperCase()}] ${item.message}${reminderLabel ? ` (${reminderLabel})` : ""}`,
    );
  });

  textLines.push(
    "",
    `Review all action items in the dashboard for a more detailed view: ${dashboardLink}`,
    "",
    "Please do not reply to this email. Use the dashboard.",
    "",
    "Thanks,",
    "Hardik",
  );

  const htmlItems = sortedItems
    .map(
      (item) => `
        <li style="margin:0 0 14px;">
          <strong style="color:${priorityColor(item.priority)};">[${item.priority.toUpperCase()}]</strong> ${escapeHtml(item.message)}${getReminderExplanation(item.notificationCount) ? ` <span style="color:#64748b;">(${escapeHtml(getReminderExplanation(item.notificationCount))})</span>` : ""}
        </li>`,
    )
    .join("");

  const bodyHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:14px;line-height:1.5;">
  <p>Hi ${escapeHtml(teamShortLabel)} Leads,</p>
  <p>${attentionMessage}</p>
  <ul style="padding-left:22px;">${htmlItems}</ul>
  <p><a href="${dashboardLink}">Review all action items in the dashboard for a more detailed view.</a></p>
  <p style="color:#64748b;font-size:12px;">Please do not reply to this email.</p>
  <p>Thanks,<br>Hardik</p>
</div>`;

  return {
    subject: `${teamLabel}: ${countLabel} need your attention — ${dateLabel}`,
    title: `${countLabel} need attention for ${teamName}.`,
    bodyText: textLines.join("\n"),
    bodyHtml,
    deepLinkPath: ACTION_ITEMS_DEEP_LINK_PATH,
  };
}

/**
 * Returns the sort rank for an action-item priority.
 *
 * @param priority The action-item priority.
 * @returns The priority sort rank.
 */
function priorityRank(priority: ActionItemPriority): number {
  return priority === "high" ? 0 : priority === "medium" ? 1 : 2;
}

/**
 * Returns the HTML color for an action-item priority.
 *
 * @param priority The action-item priority.
 * @returns The HTML color.
 */
function priorityColor(priority: ActionItemPriority): string {
  return priority === "high"
    ? "#dc2626"
    : priority === "medium"
      ? "#d97706"
      : "#64748b";
}
