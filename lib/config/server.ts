/**
 * @fileoverview Barrel exports for server-only configuration.
 *
 * These modules read process environment variables or are only meaningful on
 * the server. Importing this module from a client component would pull server
 * configuration into the browser bundle, so client code must use
 * `@/lib/config` instead.
 */

export {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  readNumberEnv,
  requireEnv,
} from "./env";
export { isMaintenanceModeEnabled } from "./maintenance";
export {
  getActionItemsEmailFrom,
  getActionItemsEmailReplyTo,
  getAppBaseUrl,
  getResendApiKey,
} from "./notifications";
