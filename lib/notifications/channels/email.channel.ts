import nodemailer from "nodemailer";
import {
  getActionItemsEmailFrom,
  getActionItemsEmailReplyTo,
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  getGoogleOAuthRefreshToken,
  getSmtpHost,
  getSmtpPassword,
  getSmtpPort,
  getSmtpUser,
  hasEmailCredentials,
  isActionItemEmailEnabled,
} from "@/lib/config";
import type {
  NotificationChannel,
  NotificationChannelResult,
  NotificationMessage,
  NotificationRecipient,
} from "@/lib/domain/notifications.types";

/** Timeout for each SMTP phase so a hung connection cannot stall a cron run. */
const SMTP_TIMEOUT_MS = 10_000;

/** Truncates provider error bodies so delivery logs stay readable. */
const MAX_ERROR_DETAIL_LENGTH = 300;

/** Authentication shapes accepted by nodemailer's SMTP transport. */
type SmtpAuth =
  | {
      type: "OAuth2";
      user: string;
      clientId: string;
      clientSecret: string;
      refreshToken: string;
    }
  | { user: string; pass: string };

/** Cached transport; reused across warm serverless invocations. */
let cachedTransport: nodemailer.Transporter | null = null;

/**
 * Gmail shows App Passwords grouped with spaces for readability, but SMTP
 * expects the 16-character value without them.
 *
 * @param password The configured SMTP password.
 * @param host The SMTP host.
 * @returns The password to hand to the SMTP server.
 */
function normalizeSmtpPassword(password: string, host: string): string {
  return host === "smtp.gmail.com" ? password.replace(/\s+/g, "") : password;
}

/**
 * Resolves SMTP authentication. OAuth2 is preferred because it is scoped to
 * sending and survives password changes; an App Password remains supported for
 * mailboxes that can still create one.
 *
 * @returns The authentication options, or null when neither method is set up.
 */
function getSmtpAuth(): SmtpAuth | null {
  const user = getSmtpUser();

  if (!user) {
    return null;
  }

  const clientId = getGoogleOAuthClientId();
  const clientSecret = getGoogleOAuthClientSecret();
  const refreshToken = getGoogleOAuthRefreshToken();

  // Nodemailer exchanges the refresh token for an access token on demand.
  if (clientId && clientSecret && refreshToken) {
    return { type: "OAuth2", user, clientId, clientSecret, refreshToken };
  }

  const password = getSmtpPassword();

  if (!password) {
    return null;
  }

  return {
    user,
    pass: normalizeSmtpPassword(password, getSmtpHost()),
  };
}

/**
 * Builds (or returns) the SMTP transport. Credentials are read lazily so the
 * channel can report "not configured" without throwing at module load.
 *
 * @returns The transport, or null when SMTP is not configured.
 */
function getTransport(): nodemailer.Transporter | null {
  if (cachedTransport) {
    return cachedTransport;
  }

  const auth = getSmtpAuth();

  if (!auth) {
    return null;
  }

  const port = getSmtpPort();

  cachedTransport = nodemailer.createTransport({
    host: getSmtpHost(),
    port,
    // Port 465 uses implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  return cachedTransport;
}

/**
 * Sends a single email to one recipient through SMTP.
 *
 * @param email The recipient email address.
 * @param message The rendered message.
 * @returns Nothing. Throws when the SMTP server rejects the message.
 */
async function sendEmailToRecipient(
  email: string,
  message: NotificationMessage,
): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    throw new Error(
      "SMTP auth is not configured (set SMTP_PASS or the GOOGLE_OAUTH_* values).",
    );
  }

  await transport.sendMail({
    from: getActionItemsEmailFrom(),
    replyTo: getActionItemsEmailReplyTo() ?? undefined,
    to: email,
    subject: message.subject,
    text: message.bodyText,
    html: message.bodyHtml,
  });
}

/**
 * Email transport backed by SMTP (Gmail by default). Each recipient gets an
 * individual email so addresses stay private and failures are attributable per
 * recipient.
 */
export const emailNotificationChannel: NotificationChannel = {
  key: "EMAIL",

  isAvailable(): boolean {
    return (
      isActionItemEmailEnabled() &&
      hasEmailCredentials() &&
      Boolean(getActionItemsEmailFrom())
    );
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

    const transport = getTransport();

    if (!transport) {
      return {
        channel: "EMAIL",
        deliveredTo: [],
        failed: recipients.map((recipient) => ({
          uid: recipient.uid,
          reason:
            "Email is not configured. Set SMTP_USER plus either SMTP_PASS or the GOOGLE_OAUTH_* values.",
        })),
      };
    }

    if (!getActionItemsEmailFrom()) {
      return {
        channel: "EMAIL",
        deliveredTo: [],
        failed: recipients.map((recipient) => ({
          uid: recipient.uid,
          reason: "ACTION_ITEMS_EMAIL_FROM is not configured.",
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

    // Bounded parallelism: teams have a handful of leads, and sending in
    // parallel keeps the whole run inside the cron function timeout.
    await Promise.all(
      Array.from(recipientsByEmail.entries()).map(
        async ([email, emailRecipients]) => {
          try {
            await sendEmailToRecipient(email, message);
            result.deliveredTo.push(
              ...emailRecipients.map((recipient) => recipient.uid),
            );
          } catch (error) {
            const rawReason =
              error instanceof Error ? error.message : "Email send failed.";
            const reason = rawReason.slice(0, MAX_ERROR_DETAIL_LENGTH);

            result.failed.push(
              ...emailRecipients.map((recipient) => ({
                uid: recipient.uid,
                reason,
              })),
            );
          }
        },
      ),
    );

    return result;
  },
};
