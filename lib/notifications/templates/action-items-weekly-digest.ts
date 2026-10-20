import type { ActionItemPriority } from "@/lib/domain/action-items.types";
import type { NotificationMessage } from "@/lib/domain/notifications.types";

/** An action item rendered into the daily digest. */
export type WeeklyDigestItem = {
  id: string;
  message: string;
  reason: string;
  priority: ActionItemPriority;
  detectedAt: Date;
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
 * Escapes HTML special characters so dynamic copy cannot break the layout.
 *
 * @param value The raw text.
 * @returns The escaped HTML-safe text.
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
 * Formats an IST date key for display.
 *
 * @param dateKey The `YYYY-MM-DD` date key.
 * @returns A human-readable label such as `19 Oct 2026`.
 */
function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  return DATE_FORMAT.format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Builds the absolute deep link for a single action item.
 *
 * @param appBaseUrl The app base URL.
 * @param itemId The action item id.
 * @returns The full URL that opens the dashboard with the item highlighted.
 */
function buildItemLink(appBaseUrl: string, itemId: string): string {
  return `${appBaseUrl}${ACTION_ITEMS_DEEP_LINK_PATH}?actionItem=${encodeURIComponent(itemId)}`;
}

/**
 * Builds the daily digest message for one team.
 *
 * @param input The team, period, and items to render.
 * @returns The rendered message ready for any channel.
 */
export function buildWeeklyActionItemsDigest(
  input: WeeklyDigestInput,
): NotificationMessage {
  const { teamName, dateKey, appBaseUrl, items } = input;
  const dateLabel = formatDateLabel(dateKey);
  const countLabel = `${items.length} current action item${items.length === 1 ? "" : "s"}`;

  const subject = `Action items for ${teamName}: ${countLabel} (${dateLabel})`;
  const title = `${countLabel} for ${teamName}.`;
  const deepLinkPath = ACTION_ITEMS_DEEP_LINK_PATH;

  const textLines: string[] = [
    `Action items for ${teamName} — ${dateLabel}`,
    "",
  ];

  if (items.length > 0) {
    textLines.push(`Needs action (${items.length}):`);
    items.forEach((item, index) => {
      textLines.push(
        `${index + 1}. [${item.priority.toUpperCase()}] ${item.message}`,
      );
      textLines.push(`   Why: ${item.reason}`);
      textLines.push(
        `   Detected since ${DATE_FORMAT.format(item.detectedAt)}`,
      );
      textLines.push(`   ${buildItemLink(appBaseUrl, item.id)}`);
    });
    textLines.push("");
  }

  textLines.push(`Open the dashboard to work on these items:`);
  textLines.push(`${appBaseUrl}${deepLinkPath}`);
  textLines.push("");
  textLines.push("Do not reply to this email — respond on the dashboard.");

  const renderListItems = (list: WeeklyDigestItem[]): string =>
    list
      .map((item) => {
        const isHigh = item.priority === "high";
        const badgeColor = isHigh ? "#dc2626" : "#d97706";
        const badgeLabel = isHigh ? "HIGH" : "MEDIUM";
        return `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
              <span style="display:inline-block;background:${badgeColor};color:#ffffff;font-size:10px;font-weight:700;letter-spacing:0.06em;padding:2px 8px;border-radius:999px;">${badgeLabel}</span>
              <p style="margin:8px 0 0;font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(item.message)}</p>
              <p style="margin:4px 0 0;font-size:13px;color:#475569;">${escapeHtml(item.reason)}</p>
              <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">Detected since ${DATE_FORMAT.format(item.detectedAt)}</p>
              <p style="margin:8px 0 0;">
                <a href="${buildItemLink(appBaseUrl, item.id)}" style="font-size:13px;color:#2563eb;font-weight:600;">Open this item →</a>
              </p>
            </td>
          </tr>`;
      })
      .join("");

  const sectionsHtml: string[] = [];

  if (items.length > 0) {
    sectionsHtml.push(`
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#334155;text-transform:uppercase;letter-spacing:0.08em;">Needs action (${items.length})</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        ${renderListItems(items)}
      </table>`);
  }

  const bodyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <p style="margin:0;font-size:12px;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;">Oppia Community Dashboard</p>
    <h1 style="margin:8px 0 4px;font-size:20px;color:#0f172a;">Action items</h1>
    <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(teamName)} · ${dateLabel}</p>
    <p style="margin:16px 0 0;font-size:14px;color:#334155;">You have <strong>${countLabel}</strong> waiting for follow-up. Work on these items in the dashboard.</p>
    <div style="margin-top:20px;">
      ${sectionsHtml.join("")}
    </div>
    <p style="margin:24px 0 0;">
      <a href="${appBaseUrl}${deepLinkPath}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;text-decoration:none;">Open dashboard overview</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Do not reply to this email — respond on the dashboard. You receive this digest because you are a lead for this team; working on these items there keeps future notifications focused.</p>
  </div>
</div>`;

  return {
    subject,
    title,
    bodyText: textLines.join("\n"),
    bodyHtml,
    deepLinkPath,
  };
}
