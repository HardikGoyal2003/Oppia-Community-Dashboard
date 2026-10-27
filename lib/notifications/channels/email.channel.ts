import {
  getActionItemsEmailFrom,
  getActionItemsEmailReplyTo,
  getResendApiKey,
  isActionItemEmailEnabled,
} from "@/lib/config";
import type {
  NotificationChannel,
  NotificationChannelResult,
  NotificationMessage,
  NotificationRecipient,
} from "@/lib/domain/notifications.types";

const RESEND_API_ENDPOINT = "https://api.resend.com/emails";

/** Truncates provider error bodies so delivery logs stay readable. */
const MAX_ERROR_DETAIL_LENGTH = 300;

/**
 * Sends a single email to one recipient through the Resend REST API.
 *
 * @param email The recipient email address.
 * @param message The rendered message.
 * @param apiKey The Resend API key.
 * @returns Nothing. Throws when the provider rejects the request.
 */
async function sendEmailToRecipient(
  email: string,
  message: NotificationMessage,
  apiKey: string,
): Promise<void> {
  const response = await fetch(RESEND_API_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getActionItemsEmailFrom(),
      reply_to: getActionItemsEmailReplyTo(),
      to: [email],
      subject: message.subject,
      html: message.bodyHtml,
      text: message.bodyText,
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, MAX_ERROR_DETAIL_LENGTH);
    throw new Error(`Resend responded with ${response.status}: ${detail}`);
  }
}

/**
 * Email transport backed by Resend. Each recipient gets an individual email so
 * addresses stay private and failures are attributable per recipient.
 */
export const emailNotificationChannel: NotificationChannel = {
  key: "EMAIL",

  isAvailable(): boolean {
    return isActionItemEmailEnabled() && Boolean(getResendApiKey());
  },

  async send(
    recipients: NotificationRecipient[],
    message: NotificationMessage,
  ): Promise<NotificationChannelResult> {
    const result: NotificationChannelResult = {
      channel: "EMAIL",
      deliveredTo: [],
      failed: [],
    };

    const apiKey = getResendApiKey();

    if (!apiKey) {
      return {
        channel: "EMAIL",
        deliveredTo: [],
        failed: recipients.map((recipient) => ({
          uid: recipient.uid,
          reason: "RESEND_API_KEY is not configured.",
        })),
      };
    }

    const recipientsByEmail = new Map<string, NotificationRecipient[]>();

    for (const recipient of recipients) {
      if (!recipient.email) {
        result.failed.push({
          uid: recipient.uid,
          reason: "No email address on file (GitHub profile email is private).",
        });
        continue;
      }

      const emailRecipients = recipientsByEmail.get(recipient.email);

      if (emailRecipients) {
        emailRecipients.push(recipient);
      } else {
        recipientsByEmail.set(recipient.email, [recipient]);
      }
    }

    for (const [email, emailRecipients] of recipientsByEmail) {
      try {
        await sendEmailToRecipient(email, message, apiKey);
        result.deliveredTo.push(
          ...emailRecipients.map((recipient) => recipient.uid),
        );
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Email send failed.";
        result.failed.push(
          ...emailRecipients.map((recipient) => ({
            uid: recipient.uid,
            reason,
          })),
        );
      }
    }

    return result;
  },
};
