import {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  readNumberEnv,
} from "./env";

/**
 * Returns the SMTP host used for outbound email.
 *
 * @returns The SMTP host, defaulting to Gmail.
 */
export function getSmtpHost(): string {
  return readEnvWithDefault("SMTP_HOST", "smtp.gmail.com");
}

/**
 * Returns the SMTP port used for outbound email.
 *
 * @returns The SMTP port, defaulting to 465 (implicit TLS).
 */
export function getSmtpPort(): number {
  return readNumberEnv("SMTP_PORT", 465);
}

/**
 * Returns the SMTP username (the full sending email address).
 *
 * @returns The SMTP username, or undefined when email is not set up yet.
 */
export function getSmtpUser(): string | undefined {
  return readEnv("SMTP_USER")?.trim() || undefined;
}

/**
 * Returns the SMTP password (a Gmail App Password).
 *
 * @returns The SMTP password, or undefined when email is not set up yet.
 */
export function getSmtpPassword(): string | undefined {
  return readEnv("SMTP_PASS")?.trim() || undefined;
}

/**
 * Returns whether SMTP credentials are configured.
 *
 * @returns True when both `SMTP_USER` and `SMTP_PASS` are present.
 */
export function hasSmtpCredentials(): boolean {
  return Boolean(getSmtpUser() && getSmtpPassword());
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
 * Returns the sender identity used for dashboard emails. Falls back to the
 * SMTP username so a single dedicated mailbox is enough to start sending.
 *
 * @returns The From header value for outbound emails, or an empty string when
 *   neither the override nor the SMTP username is configured.
 */
export function getActionItemsEmailFrom(): string {
  const configuredFrom = readEnv("ACTION_ITEMS_EMAIL_FROM")?.trim();

  if (configuredFrom) {
    return configuredFrom;
  }

  const smtpUser = getSmtpUser();

  return smtpUser ? `Oppia Community Dashboard <${smtpUser}>` : "";
}

/**
 * Returns the reply-to address for action-item emails. The copy tells leads to
 * respond on the dashboard, so this is optional.
 *
 * @returns The configured reply-to address, or null when unset.
 */
export function getActionItemsEmailReplyTo(): string | null {
  return readEnv("ACTION_ITEMS_EMAIL_REPLY_TO")?.trim() || null;
}

/**
 * Returns whether the daily action item digest cron is enabled.
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
