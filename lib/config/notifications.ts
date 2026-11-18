import { LibConfigError } from "@/lib/lib.errors";
import { readEnv, readEnvWithDefault, requireEnv } from "./env";

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
 *
 * The URL must be configured explicitly and use HTTPS so emailed links never
 * point at an insecure or guessed host.
 *
 * @returns The app base URL without a trailing slash.
 * @throws {LibConfigError} When NEXT_PUBLIC_APP_URL is missing, malformed, or
 *   not HTTPS.
 */
export function getAppBaseUrl(): string {
  const explicitUrl = requireEnv("NEXT_PUBLIC_APP_URL").trim();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(explicitUrl);
  } catch {
    throw new LibConfigError(
      "NEXT_PUBLIC_APP_URL",
      `Invalid NEXT_PUBLIC_APP_URL: ${explicitUrl}`,
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new LibConfigError(
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_APP_URL must use HTTPS for email links",
    );
  }

  return explicitUrl.replace(/\/+$/, "");
}
