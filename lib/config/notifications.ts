import { readEnv, readEnvWithDefault } from "./env";

/**
 * Returns the Resend API key when configured.
 *
 * @returns The Resend API key, or undefined when email is not set up yet.
 */
export function getResendApiKey(): string | undefined {
  return readEnv("RESEND_API_KEY");
}

/**
 * Returns the verified sender identity used for dashboard emails.
 *
 * @returns The From header value for outbound emails.
 */
export function getActionItemsEmailFrom(): string {
  return readEnvWithDefault(
    "ACTION_ITEMS_EMAIL_FROM",
    "Oppia Community Dashboard <noreply@notifications.oppia-community-dashboard.com>",
  );
}

/**
 * Returns the reply-to address for action-item emails. The address is intended
 * to be non-monitored; leads should act from the dashboard instead.
 *
 * @returns The configured no-reply address.
 */
export function getActionItemsEmailReplyTo(): string {
  return readEnvWithDefault(
    "ACTION_ITEMS_EMAIL_REPLY_TO",
    "noreply@notifications.oppia-community-dashboard.com",
  );
}

/**
 * Returns the public base URL of the dashboard for absolute links in emails.
 * Falls back to the Vercel deployment URL, then to relative paths.
 *
 * @returns The app base URL without a trailing slash, or an empty string.
 */
export function getAppBaseUrl(): string {
  const explicitUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (explicitUrl) {
    return explicitUrl.replace(/\/+$/, "");
  }

  return "http://oppia-community-dashboard.com";
}
