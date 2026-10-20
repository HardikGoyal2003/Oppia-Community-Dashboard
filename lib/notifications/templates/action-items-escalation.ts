import type { ActionItemPriority } from "@/lib/domain/action-items.types";
import type { NotificationMessage } from "@/lib/domain/notifications.types";
import { ACTION_ITEMS_DEEP_LINK_PATH } from "./action-items-weekly-digest";

/** An action item rendered into an escalation nudge. */
export type EscalationItem = {
  id: string;
  message: string;
  reason: string;
  priority: ActionItemPriority;
  /** When the rule was first detected (start of the untouched streak). */
  detectedAt: Date;
  /** Full days between the first notification and now. */
  daysOpen: number;
};

export type EscalationInput = {
  teamName: string;
  /** 1 for the first nudge, 2 for the second, and so on. */
  escalationLevel: number;
  /** Days an item must stay untouched before escalating (e.g. 3). */
  escalationAfterDays: number;
  /** Absolute app base URL; empty string yields relative links. */
  appBaseUrl: string;
  items: EscalationItem[];
};

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
 * Builds the escalation nudge for one team. The copy makes clear that this is
 * a repeated reminder, that no reply to the email is expected, and that the
 * dashboard is the place to act.
 *
 * @param input The team, escalation level, and items to render.
 * @returns The rendered message ready for any channel.
 */
export function buildActionItemsEscalation(
  input: EscalationInput,
): NotificationMessage {
  const { teamName, escalationLevel, escalationAfterDays, appBaseUrl, items } =
    input;
  const countLabel = `${items.length} action item${items.length === 1 ? "" : "s"}`;
  const levelLabel =
    escalationLevel === 1 ? "first reminder" : `reminder #${escalationLevel}`;

  const subject = `Reminder ${escalationLevel}: ${countLabel} still open for ${teamName}`;
  const title = `Reminder: ${countLabel} still open for ${teamName}.`;
  const deepLinkPath = ACTION_ITEMS_DEEP_LINK_PATH;

  const textLines: string[] = [
    `Escalation (${levelLabel}) for ${teamName}`,
    "",
    `${countLabel} ha${items.length === 1 ? "s" : "ve"} been open for more than ${escalationAfterDays} days without action:`,
    "",
  ];

  items.forEach((item, index) => {
    textLines.push(
      `${index + 1}. [${item.priority.toUpperCase()}] ${item.message}`,
    );
    textLines.push(`   Why: ${item.reason}`);
    textLines.push(
      `   First notified ${DATE_FORMAT.format(item.detectedAt)} · open for ${item.daysOpen} day${item.daysOpen === 1 ? "" : "s"}`,
    );
    textLines.push(`   ${buildItemLink(appBaseUrl, item.id)}`);
  });

  textLines.push("");
  textLines.push(
    "Do not reply to this email — updates happen on the dashboard.",
  );
  textLines.push(`Open the dashboard to resolve or dismiss items:`);
  textLines.push(`${appBaseUrl}${deepLinkPath}`);

  const rowsHtml = items
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
            <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">First notified ${DATE_FORMAT.format(item.detectedAt)} · open for ${item.daysOpen} day${item.daysOpen === 1 ? "" : "s"}</p>
            <p style="margin:8px 0 0;">
              <a href="${buildItemLink(appBaseUrl, item.id)}" style="font-size:13px;color:#2563eb;font-weight:600;">Open this item →</a>
            </p>
          </td>
        </tr>`;
    })
    .join("");

  const bodyHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
    <p style="margin:0;font-size:12px;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;">Oppia Community Dashboard</p>
    <h1 style="margin:8px 0 4px;font-size:20px;color:#0f172a;">Reminder: action items still open</h1>
    <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(teamName)} · ${levelLabel}</p>
    <p style="margin:16px 0 0;font-size:14px;color:#334155;">You have <strong>${countLabel}</strong> that ${items.length === 1 ? "has" : "have"} been open for more than ${escalationAfterDays} days without action. Resolve or dismiss ${items.length === 1 ? "it" : "them"} in the dashboard so this reminder does not repeat.</p>
    <div style="margin-top:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        ${rowsHtml}
      </table>
    </div>
    <p style="margin:24px 0 0;">
      <a href="${appBaseUrl}${deepLinkPath}" style="display:inline-block;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;text-decoration:none;">Open dashboard overview</a>
    </p>
    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">Do not reply to this email — respond on the dashboard. Items are tracked there, and acknowledging or resolving them stops these reminders.</p>
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
