/**
 * @fileoverview Barrel exports for shared application configuration utilities.
 */

export { ANNOUNCEMENT_BANNER } from "./announcement.constants";
export {
  CONTRIBUTOR_JOURNEY_CONTENT,
  type ContributorJourneyChecklistItem,
  type ContributorJourneyRichNote,
} from "./contributor-journey.constants";
export { readEnv } from "./env";
export { CONTRIBUTING_DOCS, GITHUB_REPOS } from "./github.constants";
export { isMaintenanceModeEnabled } from "./maintenance";
export {
  getActionItemsEmailFrom,
  getActionItemsEmailReplyTo,
  getAppBaseUrl,
  getResendApiKey,
} from "./notifications";
export { ANDROID_TEAMS, WEB_TEAMS } from "./teams.constants";
