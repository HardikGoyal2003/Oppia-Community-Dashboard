import {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  readNumberEnv,
} from "./env";

/**
 * Returns the Resend API key when configured.
 *
 * @returns The Resend API key, or undefined when email is not set up yet.
 */
export function getResendApiKey(): string | undefined {
  return readEnv("RESEND_API_KEY");
}

/**
 * Returns whether sending action item emails is enabled.
 *
 * @returns True unless `ACTION_ITEM_EMAIL_ENABLED` is set to "false".
 */
export function isActionItemEmailEnabled(): boolean {
  return readBooleanEnv("ACTION_ITEM_EMAIL_ENABLED", true);
}

/**
 * Returns the verified sender identity used for dashboard emails.
 *
 * @returns The From header value for outbound emails.
 */
export function getActionItemsEmailFrom(): string {
  return readEnvWithDefault(
    "ACTION_ITEMS_EMAIL_FROM",
    "Oppia Community Dashboard <onboarding@resend.dev>",
  );
}

/**
 * Returns whether the weekly action item digest cron is enabled.
 *
 * @returns True unless `ACTION_ITEMS_DIGEST_ENABLED` is set to "false".
 */
export function isActionItemsDigestEnabled(): boolean {
  return readBooleanEnv("ACTION_ITEMS_DIGEST_ENABLED", true);
}

/**
 * Returns whether escalation nudges are enabled.
 *
 * @returns True unless `ACTION_ITEM_ESCALATION_ENABLED` is set to "false".
 */
export function isActionItemEscalationEnabled(): boolean {
  return readBooleanEnv("ACTION_ITEM_ESCALATION_ENABLED", true);
}

/**
 * Returns how many days must pass without action before an item is escalated.
 *
 * @returns The escalation interval in days (default 3).
 */
export function getActionItemEscalationDays(): number {
  return readNumberEnv("ACTION_ITEM_ESCALATION_DAYS", 3);
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

  const vercelUrl = readEnv("VERCEL_URL");

  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  return "";
}
